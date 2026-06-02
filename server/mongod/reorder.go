package mongod

import (
	"context"
	"errors"
	"faynoSync/server/model"

	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// reorder 相关的 sentinel error,供 handler 区分 400(客户端输入问题)与 500(其它)。
var (
	// ErrReorderInvalidID 表示请求里包含非法 hex 的 ObjectID。
	ErrReorderInvalidID = errors.New("reorder request contains an invalid id")
	// ErrReorderDuplicateID 表示请求里包含重复 id。
	ErrReorderDuplicateID = errors.New("reorder request contains duplicate ids")
	// ErrReorderUnknownIDs 表示请求里包含当前作用域内不存在的 id(外来/未知 id)。
	ErrReorderUnknownIDs = errors.New("reorder request contains ids that do not exist in this scope")
)

// reorderAssignment 表示一个 id 应被赋予的 sort 值。
type reorderAssignment struct {
	ID   primitive.ObjectID
	Sort int
}

// computeReorderAssignments 是 reorder 的纯校验/赋值逻辑,无 DB 依赖,便于单测。
//   - orderedIDs:客户端给定的目标顺序(hex 字符串)。
//   - existing:作用域内实际存在的 _id 集合(由 DB 层查询后传入)。
//
// 校验:任何非法 hex → ErrReorderInvalidID;重复 id → ErrReorderDuplicateID;
// 任何不在 existing 中的 id → ErrReorderUnknownIDs。
// 通过后,第 i 个 id 赋予 sort=i。
func computeReorderAssignments(orderedIDs []string, existing map[primitive.ObjectID]struct{}) ([]reorderAssignment, error) {
	assignments := make([]reorderAssignment, 0, len(orderedIDs))
	seen := make(map[primitive.ObjectID]struct{}, len(orderedIDs))

	for i, idStr := range orderedIDs {
		oid, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return nil, ErrReorderInvalidID
		}
		if _, dup := seen[oid]; dup {
			return nil, ErrReorderDuplicateID
		}
		seen[oid] = struct{}{}
		if _, ok := existing[oid]; !ok {
			return nil, ErrReorderUnknownIDs
		}
		assignments = append(assignments, reorderAssignment{ID: oid, Sort: i})
	}

	return assignments, nil
}

// resolveOwnerScope 复制 listItems/createMetaDocument 里的 team-user 解析逻辑:
// 若 owner 是 team user,则归并到其 admin owner;否则原样返回。
// 故意内联复制而非抽公共 helper,保持最小改动、不触碰既有调用点。
func (c *appRepository) resolveOwnerScope(ctx context.Context, owner string) string {
	teamUsersCollection := c.client.Database(c.config.Database).Collection("team_users")
	var teamUser model.TeamUser
	if err := teamUsersCollection.FindOne(ctx, bson.M{"username": owner}).Decode(&teamUser); err == nil {
		return teamUser.Owner
	}
	return owner
}

// reorderMeta 是四类 reorder 的共用实现,按 (owner, discriminatorField) 作用域批量写入 sort。
// 这是打 mongo 的薄包装层,需在 staging 验证;纯校验逻辑已抽到 computeReorderAssignments。
func (c *appRepository) reorderMeta(ctx context.Context, owner, discriminatorField string, ids []string) error {
	// 空或单元素:no-op(单元素重排无意义,且不触库,无副作用)。
	if len(ids) <= 1 {
		return nil
	}

	scopedOwner := c.resolveOwnerScope(ctx, owner)
	collection := c.client.Database(c.config.Database).Collection("apps_meta")

	// 查询该作用域内这些 _id 实际存在的集合,用于外来/未知 id 校验。
	oids := make([]primitive.ObjectID, 0, len(ids))
	for _, idStr := range ids {
		oid, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			return ErrReorderInvalidID
		}
		oids = append(oids, oid)
	}

	existFilter := bson.M{
		"owner":            scopedOwner,
		discriminatorField: bson.M{"$exists": true},
		"_id":              bson.M{"$in": oids},
	}
	cur, err := collection.Find(ctx, existFilter)
	if err != nil {
		logrus.Errorf("Error querying existing meta for reorder: %v", err)
		return err
	}
	defer cur.Close(ctx)

	existing := make(map[primitive.ObjectID]struct{}, len(oids))
	for cur.Next(ctx) {
		var doc struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err := cur.Decode(&doc); err != nil {
			logrus.Errorf("Error decoding meta id for reorder: %v", err)
			return err
		}
		existing[doc.ID] = struct{}{}
	}
	if err := cur.Err(); err != nil {
		return err
	}

	assignments, err := computeReorderAssignments(ids, existing)
	if err != nil {
		return err
	}

	models := make([]mongo.WriteModel, 0, len(assignments))
	for _, a := range assignments {
		filter := bson.M{
			"_id":              a.ID,
			"owner":            scopedOwner,
			discriminatorField: bson.M{"$exists": true},
		}
		update := bson.M{"$set": bson.M{"sort": a.Sort}}
		models = append(models, mongo.NewUpdateOneModel().SetFilter(filter).SetUpdate(update))
	}

	if _, err := collection.BulkWrite(ctx, models); err != nil {
		logrus.Errorf("Error bulk-writing reorder for %s: %v", discriminatorField, err)
		return err
	}
	return nil
}

// ReorderChannels 按给定顺序持久化 channel 的 sort。
func (c *appRepository) ReorderChannels(ctx context.Context, owner string, ids []string) error {
	return c.reorderMeta(ctx, owner, "channel_name", ids)
}

// ReorderPlatforms 按给定顺序持久化 platform 的 sort。
func (c *appRepository) ReorderPlatforms(ctx context.Context, owner string, ids []string) error {
	return c.reorderMeta(ctx, owner, "platform_name", ids)
}

// ReorderArchs 按给定顺序持久化 arch 的 sort。
func (c *appRepository) ReorderArchs(ctx context.Context, owner string, ids []string) error {
	return c.reorderMeta(ctx, owner, "arch_id", ids)
}

// ReorderApps 按给定顺序持久化 app 的 sort。
func (c *appRepository) ReorderApps(ctx context.Context, owner string, ids []string) error {
	return c.reorderMeta(ctx, owner, "app_name", ids)
}
