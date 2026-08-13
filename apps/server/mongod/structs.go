package mongod

import (
	"context"

	"faynoSync/server/model"

	"github.com/go-redis/redis/v8"
	"github.com/spf13/viper"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/x/mongo/driver/connstring"
)

type AppRepository interface {
	Get(ctx context.Context, limit int64, owner string) ([]*model.SpecificAppWithoutIDs, error)
	GetAppByName(appName string, ctx context.Context, page, limit int64, owner string, filters map[string]interface{}) (*model.PaginatedResponse, error)
	DeleteSpecificVersionOfApp(id primitive.ObjectID, owner string, ctx context.Context) ([]string, int64, string, error)
	DeleteChannel(id primitive.ObjectID, owner string, ctx context.Context) (int64, error)
	CheckUploadAvailable(ctxQuery map[string]interface{}, extension string, owner string, ctx context.Context) error
	PrepareUpload(ctxQuery map[string]interface{}, extension string, owner string, ctx context.Context) (UploadClaim, error)
	ReleaseUploadClaim(claim UploadClaim, ctx context.Context) error
	Upload(ctxQuery map[string]interface{}, appLink, extension string, owner string, ctx context.Context, redisClient *redis.Client, env *viper.Viper, checkAppVisibility bool) (interface{}, error)
	UpdateSpecificApp(objID primitive.ObjectID, owner string, ctxQuery map[string]interface{}, appLink, extension string, ctx context.Context) (bool, error)
	CheckLatestVersion(appName, version, channel, platform, arch string, ctx context.Context, owner string) (CheckResult, error)
	FetchLatestVersionOfApp(appName, channel string, ctx context.Context, owner string) ([]*model.SpecificAppWithoutIDs, error)
	FetchAppByID(appID primitive.ObjectID, ctx context.Context) ([]*model.SpecificAppWithoutIDs, error)
	CreateChannel(channelName string, owner string, ctx context.Context) (interface{}, error)
	ListChannels(ctx context.Context, owner string) ([]*model.Channel, error)
	CreatePlatform(platformName string, updaters []model.Updater, owner string, ctx context.Context) (interface{}, error)
	ListPlatforms(ctx context.Context, owner string) ([]*model.Platform, error)
	DeletePlatform(id primitive.ObjectID, owner string, ctx context.Context) (int64, error)
	CreateArch(archName string, owner string, ctx context.Context) (interface{}, error)
	ListArchs(ctx context.Context, owner string) ([]*model.Arch, error)
	DeleteArch(id primitive.ObjectID, owner string, ctx context.Context) (int64, error)
	CreateApp(appName string, logo string, description string, shortLink string, private bool, tuf bool, owner string, ctx context.Context) (interface{}, error)
	ResolveShortLinkApp(shortLink string, owner string, ctx context.Context) (string, error)
	ShortLinkTakenBy(shortLink string, owner string, ctx context.Context) (primitive.ObjectID, error)
	ListApps(ctx context.Context, owner string) ([]*model.App, error)
	DeleteApp(id primitive.ObjectID, owner string, ctx context.Context) (int64, error)
	// shortLink 为 nil 表示调用方没提供该字段,保持库里原值不动;非 nil(含空串)才写入。
	// 空串是「清空短链」的合法意图,必须与「没传」区分开——短链是已印在物料上的
	// 公开 URL,不能被一次漏传字段的局部更新静默抹掉。
	UpdateApp(id primitive.ObjectID, appName string, logo string, tuf bool, description string, shortLink *string, owner string, ctx context.Context) (interface{}, error)
	UpdateChannel(id primitive.ObjectID, paramValue string, owner string, ctx context.Context) (interface{}, error)
	UpdatePlatform(id primitive.ObjectID, platformName string, updaters []model.Updater, owner string, ctx context.Context) (interface{}, error)
	UpdateArch(id primitive.ObjectID, paramValue string, owner string, ctx context.Context) (interface{}, error)
	DeleteSpecificArtifactOfApp(id primitive.ObjectID, ctxQuery map[string]interface{}, ctx context.Context, owner string) ([]string, bool, error)
	// 注意:Reorder* 方法刻意不并入本接口。它们作为具体 *appRepository 的能力存在,
	// 由 catalog 包的窄接口 metaReorderer 在调用点断言获取。这样其它实现/测试 mock
	// 无需被动新增方法即可继续满足 AppRepository(见 mongod/reorder.go 与 catalog/reorder.go)。
}

type UploadClaim struct {
	ID    string
	Token string
}

type appRepository struct {
	client *mongo.Client
	config *connstring.ConnString
}

func NewAppRepository(config *connstring.ConnString, client *mongo.Client) AppRepository {
	return &appRepository{config: config, client: client}
}

type Artifact struct {
	Link      string
	Package   string
	Signature string
}
type Changelog struct {
	Changes string
}
type CheckResult struct {
	Found                  bool
	Critical               bool
	Artifacts              []Artifact
	Changelog              []Changelog
	IsRequiredIntermediate bool
	PossibleRollback       bool
	LatestVersion          string
	Signature              string
}

func (c *appRepository) getBasePipeline() mongo.Pipeline {
	return mongo.Pipeline{
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "apps_meta",
			"localField":   "app_id",
			"foreignField": "_id",
			"as":           "app_meta",
		}}},
		bson.D{{Key: "$unwind", Value: "$app_meta"}},
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "apps_meta",
			"localField":   "channel_id",
			"foreignField": "_id",
			"as":           "channel_meta",
		}}},
		bson.D{{Key: "$unwind", Value: bson.M{"path": "$channel_meta", "preserveNullAndEmptyArrays": true}}},
		bson.D{{Key: "$unwind", Value: bson.M{"path": "$artifacts", "preserveNullAndEmptyArrays": true}}},
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "apps_meta",
			"localField":   "artifacts.platform",
			"foreignField": "_id",
			"as":           "platform_meta",
		}}},
		bson.D{{Key: "$lookup", Value: bson.M{
			"from":         "apps_meta",
			"localField":   "artifacts.arch",
			"foreignField": "_id",
			"as":           "arch_meta",
		}}},
		bson.D{{Key: "$unwind", Value: bson.M{"path": "$platform_meta", "preserveNullAndEmptyArrays": true}}},
		bson.D{{Key: "$unwind", Value: bson.M{"path": "$arch_meta", "preserveNullAndEmptyArrays": true}}},
		bson.D{{Key: "$addFields", Value: bson.M{
			"artifacts.platform": "$platform_meta.platform_name",
			"artifacts.arch":     "$arch_meta.arch_id",
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":                   "$_id",
			"app_name":              bson.M{"$first": "$app_meta.app_name"},
			"channel":               bson.M{"$first": "$channel_meta.channel_name"},
			"version":               bson.M{"$first": "$version"},
			"published":             bson.M{"$first": "$published"},
			"critical":              bson.M{"$first": "$critical"},
			"required_intermediate": bson.M{"$first": "$required_intermediate"},
			"artifacts":             bson.M{"$push": "$artifacts"},
			"changelog":             bson.M{"$first": "$changelog"},
			"updated_at":            bson.M{"$first": "$updated_at"},
		}}},
		// 上面的 $unwind(preserveNullAndEmptyArrays)+$addFields 处理空 artifacts 数组时
		// 会凭空产生一个空对象 {}（无 link/platform/arch），$group $push 后残留为一条
		// 幽灵 artifact。删光某版本全部构建物后，该版本在 /search 列表里会显示成
		// Unknown platform / Unknown architecture。按 link 是否存在过滤掉幽灵空对象，
		// 让空版本正确返回 artifacts: []。
		bson.D{{Key: "$addFields", Value: bson.M{
			"artifacts": bson.M{"$filter": bson.M{
				"input": "$artifacts",
				"as":    "artifact",
				"cond":  bson.M{"$ne": bson.A{bson.M{"$type": "$$artifact.link"}, "missing"}},
			}},
		}}},
		bson.D{{Key: "$addFields", Value: bson.D{
			{Key: "versions_arr", Value: bson.D{
				{Key: "$split", Value: bson.A{"$version", "."}},
			}},
		}}},
		bson.D{{Key: "$addFields", Value: bson.D{
			{Key: "major_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 0}},
				}},
			}},
			{Key: "minor_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 1}},
				}},
			}},
			{Key: "patch_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 2}},
				}},
			}},
			{Key: "build_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 3}},
				}},
			}},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{
			{Key: "major_v", Value: -1},
			{Key: "minor_v", Value: -1},
			{Key: "patch_v", Value: -1},
			{Key: "build_v", Value: -1},
		}}},
	}
}
func (c *appRepository) sortVersionPipeline() mongo.Pipeline {
	return mongo.Pipeline{
		{{Key: "$addFields", Value: bson.D{
			{Key: "versions_arr", Value: bson.D{
				{Key: "$split", Value: bson.A{"$version", "."}},
			}},
		}}},
		{{Key: "$addFields", Value: bson.D{
			{Key: "major_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 0}},
				}},
			}},
			{Key: "minor_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 1}},
				}},
			}},
			{Key: "patch_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 2}},
				}},
			}},
			{Key: "build_v", Value: bson.D{
				{Key: "$toInt", Value: bson.D{
					{Key: "$arrayElemAt", Value: bson.A{"$versions_arr", 3}},
				}},
			}},
		}}},
		{{Key: "$sort", Value: bson.D{
			{Key: "major_v", Value: -1},
			{Key: "minor_v", Value: -1},
			{Key: "patch_v", Value: -1},
			{Key: "build_v", Value: -1},
		}}},
		{{Key: "$limit", Value: 1}},
	}
}
