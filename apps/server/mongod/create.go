package mongod

import (
	"context"
	"errors"
	"faynoSync/server/model"
	"faynoSync/server/utils"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

const uploadArtifactAlreadyExistsMessage = "app with this name, version, platform, architecture and extension already exists"
const uploadClaimTTL = 6 * time.Hour

var ErrUploadArtifactAlreadyExists = errors.New(uploadArtifactAlreadyExistsMessage)

func applyUploadedArtifact(appData *model.SpecificApp, artifact model.Artifact, overwrite bool) error {
	index := artifactTupleIndex(appData.Artifacts, artifact)
	if index >= 0 {
		if !overwrite {
			return ErrUploadArtifactAlreadyExists
		}
		appData.Artifacts[index] = artifact
		return nil
	}

	appData.Artifacts = append(appData.Artifacts, artifact)
	return nil
}

func artifactTupleIndex(artifacts []model.Artifact, artifact model.Artifact) int {
	for i, existingArtifact := range artifacts {
		if existingArtifact.Package == artifact.Package && existingArtifact.Arch == artifact.Arch && existingArtifact.Platform == artifact.Platform {
			return i
		}
	}
	return -1
}

func buildUploadClaimID(owner string, appID primitive.ObjectID, version string, channelID, platformID, archID primitive.ObjectID, extension string) string {
	return strings.Join([]string{
		owner,
		appID.Hex(),
		version,
		channelID.Hex(),
		platformID.Hex(),
		archID.Hex(),
		extension,
	}, "|")
}

func uploadClaimConflictError(err error) error {
	var writeException mongo.WriteException
	if errors.As(err, &writeException) {
		for _, writeErr := range writeException.WriteErrors {
			if writeErr.Code == 11000 {
				return ErrUploadArtifactAlreadyExists
			}
		}
	}
	var writeError mongo.WriteError
	if errors.As(err, &writeError) && writeError.Code == 11000 {
		return ErrUploadArtifactAlreadyExists
	}
	return err
}

func artifactTupleFilter(artifact model.Artifact) bson.M {
	return bson.M{
		"platform": artifact.Platform,
		"arch":     artifact.Arch,
		"package":  artifact.Package,
	}
}

func artifactArrayFilter(artifact model.Artifact) bson.M {
	return bson.M{
		"artifact.platform": artifact.Platform,
		"artifact.arch":     artifact.Arch,
		"artifact.package":  artifact.Package,
	}
}

func appendArtifactFilter(baseFilter bson.D, artifact model.Artifact) bson.D {
	return append(baseFilter, bson.E{Key: "artifacts", Value: bson.M{
		"$not": bson.M{"$elemMatch": artifactTupleFilter(artifact)},
	}})
}

func appendArtifactToExistingVersion(ctx context.Context, collection *mongo.Collection, baseFilter bson.D, artifact model.Artifact) (primitive.ObjectID, error) {
	var appData model.SpecificApp
	err := collection.FindOneAndUpdate(
		ctx,
		appendArtifactFilter(baseFilter, artifact),
		bson.D{
			{Key: "$push", Value: bson.D{{Key: "artifacts", Value: artifact}}},
			{Key: "$set", Value: bson.D{{Key: "updated_at", Value: time.Now()}}},
		},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&appData)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return primitive.NilObjectID, ErrUploadArtifactAlreadyExists
	}
	if err != nil {
		return primitive.NilObjectID, err
	}
	return appData.ID, nil
}

func replaceArtifactInExistingVersion(ctx context.Context, collection *mongo.Collection, baseFilter bson.D, artifact model.Artifact, updateFields bson.D) (primitive.ObjectID, error) {
	updateFields = append(bson.D{{Key: "artifacts.$[artifact]", Value: artifact}}, updateFields...)
	var appData model.SpecificApp
	err := collection.FindOneAndUpdate(
		ctx,
		baseFilter,
		bson.D{{Key: "$set", Value: updateFields}},
		options.FindOneAndUpdate().
			SetArrayFilters(options.ArrayFilters{Filters: []interface{}{artifactArrayFilter(artifact)}}).
			SetReturnDocument(options.After),
	).Decode(&appData)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return primitive.NilObjectID, ErrUploadArtifactAlreadyExists
	}
	if err != nil {
		return primitive.NilObjectID, err
	}
	return appData.ID, nil
}

func (c *appRepository) acquireUploadClaim(ctx context.Context, owner string, appID primitive.ObjectID, version string, channelID, platformID, archID primitive.ObjectID, extension string) (UploadClaim, error) {
	claimsCollection := c.client.Database(c.config.Database).Collection("upload_claims")
	now := time.Now()
	claim := UploadClaim{
		ID:    buildUploadClaimID(owner, appID, version, channelID, platformID, archID, extension),
		Token: primitive.NewObjectID().Hex(),
	}
	_, _ = claimsCollection.DeleteOne(ctx, bson.M{
		"_id":        claim.ID,
		"expires_at": bson.M{"$lt": now},
	})
	_, err := claimsCollection.InsertOne(ctx, bson.M{
		"_id":        claim.ID,
		"token":      claim.Token,
		"owner":      owner,
		"expires_at": now.Add(uploadClaimTTL),
		"created_at": now,
	})
	if err != nil {
		return UploadClaim{}, uploadClaimConflictError(err)
	}
	return claim, nil
}

func (c *appRepository) CreateDocument(collectionName string, document bson.D, uniqueKey, keyType string, owner string, ctx context.Context) (interface{}, error) {
	collection := c.client.Database(c.config.Database).Collection(collectionName)

	// Set the updated_at field to the current time
	document = append(document, bson.E{Key: "updated_at", Value: time.Now()})
	// Add owner field
	document = append(document, bson.E{Key: "owner", Value: owner})
	logrus.Debugln("Document: ", document)
	uploadResult, err := collection.InsertOne(ctx, document)
	if err != nil {
		if mongoErr, ok := err.(mongo.WriteException); ok {
			for _, writeErr := range mongoErr.WriteErrors {
				if writeErr.Code == 11000 && strings.Contains(writeErr.Message, uniqueKey) {
					return nil, fmt.Errorf("%s with this name already exists", keyType)
				}
			}
		}
		logrus.Errorf("Error inserting document: %v", err)
		return nil, err
	}

	return uploadResult.InsertedID, nil
}

// metaDiscriminatorField 把 keyType 映射到 apps_meta 中区分四类元数据的判别字段名。
// 纯函数,无 DB 依赖,便于单测。未知 keyType 返回空串。
func metaDiscriminatorField(keyType string) string {
	switch keyType {
	case "channel":
		return "channel_name"
	case "platform":
		return "platform_name"
	case "arch":
		return "arch_id"
	case "app":
		return "app_name"
	default:
		return ""
	}
}

// nextSortValue 根据当前 (owner, type) 作用域内已存在的最大 sort 值计算新文档的默认 sort。
// maxSort 为 nil 表示该作用域内没有任何带 numeric sort 的文档(全为老文档或为空),
// 此时新值为 0;否则为 max+1。纯函数,便于单测。
func nextSortValue(maxSort *int) int {
	if maxSort == nil {
		return 0
	}
	return *maxSort + 1
}

// maxMetaSort 查询 apps_meta 中给定 (owner, 判别字段) 作用域内 numeric sort 字段的最大值。
// 通过 sort:{$exists:true} 过滤掉无 sort 字段的老文档,避免把缺失值误判为 0。
// 无任何带 sort 的文档时返回 (nil, nil)。这是打 mongo 的薄包装层,需在 staging 验证。
func (c *appRepository) maxMetaSort(ctx context.Context, owner, discriminatorField string) (*int, error) {
	collection := c.client.Database(c.config.Database).Collection("apps_meta")
	filter := bson.M{
		"owner":            owner,
		discriminatorField: bson.M{"$exists": true},
		"sort":             bson.M{"$exists": true},
	}
	findOptions := options.FindOne().SetSort(bson.D{{Key: "sort", Value: -1}})

	var doc struct {
		Sort int `bson:"sort"`
	}
	err := collection.FindOne(ctx, filter, findOptions).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &doc.Sort, nil
}

// Helper function to check if a string slice contains a value
func contains(slice []string, value string) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

// createMetaDocument is a helper function that handles the common logic for creating meta documents
// and updating team user permissions if needed
func (c *appRepository) createMetaDocument(
	document bson.D,
	uniqueKey string,
	keyType string,
	owner string,
	ctx context.Context,
	updateTeamUserPermissions func(teamUser model.TeamUser, result interface{}, teamUsername string) error,
) (interface{}, error) {
	// Check if the creator is a team user
	teamUsersCollection := c.client.Database(c.config.Database).Collection("team_users")
	var teamUser model.TeamUser
	err := teamUsersCollection.FindOne(ctx, bson.M{"username": owner}).Decode(&teamUser)
	teamUsername := owner // Store the original username for permission update
	if err == nil {
		// User is a team user, set owner to their admin
		owner = teamUser.Owner
	}

	// 计算 (owner, type) 作用域内的默认 sort:取该作用域已存在文档的最大 sort,无则 0,否则 max+1。
	// 必须使用解析后的 owner(team user 已归并到 admin),否则按原始用户名查不到、会让 sort 撞车。
	if field := metaDiscriminatorField(keyType); field != "" {
		maxSort, err := c.maxMetaSort(ctx, owner, field)
		if err != nil {
			logrus.Errorf("Error computing max sort for %s: %v", keyType, err)
			return nil, err
		}
		document = append(document, bson.E{Key: "sort", Value: nextSortValue(maxSort)})
	}

	result, err := c.CreateDocument("apps_meta", document, uniqueKey, keyType, owner, ctx)
	if err != nil {
		return nil, err
	}

	// If the creator is a team user and we have a permission update function, update their permissions
	if updateTeamUserPermissions != nil {
		err = updateTeamUserPermissions(teamUser, result, teamUsername)
		if err != nil {
			logrus.Errorf("Failed to update team user permissions: %v", err)
			// Don't return error here as the document was created successfully
		}
	}

	return result, nil
}

// updateTeamUserPermissions is a generic function that updates team user permissions for any resource type
func (c *appRepository) updateTeamUserPermissions(teamUser model.TeamUser, result interface{}, teamUsername string, resourceType string, ctx context.Context) error {
	resourceID := result.(primitive.ObjectID).Hex()
	var allowedList []string
	var permissionsField string

	switch resourceType {
	case "channel":
		allowedList = teamUser.Permissions.Channels.Allowed
		permissionsField = "channels"
	case "platform":
		allowedList = teamUser.Permissions.Platforms.Allowed
		permissionsField = "platforms"
	case "arch":
		allowedList = teamUser.Permissions.Archs.Allowed
		permissionsField = "archs"
	case "app":
		allowedList = teamUser.Permissions.Apps.Allowed
		permissionsField = "apps"
	default:
		return fmt.Errorf("unknown resource type: %s", resourceType)
	}

	if !contains(allowedList, resourceID) {
		// Create a new permissions object to avoid modifying the original
		updatedPermissions := teamUser.Permissions

		// Update the appropriate field using reflection
		permissionsValue := reflect.ValueOf(&updatedPermissions).Elem()
		resourceField := permissionsValue.FieldByName(cases.Title(language.English).String(permissionsField))
		if resourceField.IsValid() {
			allowedField := resourceField.FieldByName("Allowed")
			if allowedField.IsValid() {
				allowedField.Set(reflect.Append(allowedField, reflect.ValueOf(resourceID)))
			}
		}

		update := bson.M{"$set": bson.M{"permissions": updatedPermissions}}
		_, err := c.client.Database(c.config.Database).Collection("team_users").UpdateOne(
			ctx,
			bson.M{"username": teamUsername},
			update,
		)
		return err
	}
	return nil
}

// CreateChannel creates a new channel document
func (c *appRepository) CreateChannel(channelName string, owner string, ctx context.Context) (interface{}, error) {
	document := bson.D{{Key: "channel_name", Value: channelName}}

	updateTeamUserPermissions := func(teamUser model.TeamUser, result interface{}, teamUsername string) error {
		return c.updateTeamUserPermissions(teamUser, result, teamUsername, "channel", ctx)
	}

	return c.createMetaDocument(
		document,
		"channel_name_owner_sort_by_asc_created",
		"channel",
		owner,
		ctx,
		updateTeamUserPermissions,
	)
}

// CreatePlatform creates a new platform document
func (c *appRepository) CreatePlatform(platformName string, updaters []model.Updater, owner string, ctx context.Context) (interface{}, error) {
	// If no updaters provided, use default manual updater
	if len(updaters) == 0 {
		updaters = []model.Updater{
			{Type: "manual", Default: true},
		}
	}

	// Convert updaters to BSON format
	updatersBSON := make([]bson.M, len(updaters))
	for i, updater := range updaters {
		updatersBSON[i] = bson.M{
			"type":    updater.Type,
			"default": updater.Default,
		}
	}

	document := bson.D{
		{Key: "platform_name", Value: platformName},
		{Key: "updaters", Value: updatersBSON},
	}

	updateTeamUserPermissions := func(teamUser model.TeamUser, result interface{}, teamUsername string) error {
		return c.updateTeamUserPermissions(teamUser, result, teamUsername, "platform", ctx)
	}

	return c.createMetaDocument(
		document,
		"platform_name_owner_sort_by_asc_created",
		"platform",
		owner,
		ctx,
		updateTeamUserPermissions,
	)
}

// CreateArch creates a new arch document
func (c *appRepository) CreateArch(archID string, owner string, ctx context.Context) (interface{}, error) {
	document := bson.D{{Key: "arch_id", Value: archID}}

	updateTeamUserPermissions := func(teamUser model.TeamUser, result interface{}, teamUsername string) error {
		return c.updateTeamUserPermissions(teamUser, result, teamUsername, "arch", ctx)
	}

	return c.createMetaDocument(
		document,
		"arch_id_owner_sort_by_asc_created",
		"arch",
		owner,
		ctx,
		updateTeamUserPermissions,
	)
}

// CreateApp creates a new app_name document
func (c *appRepository) CreateApp(appName string, logo string, description string, private bool, tuf bool, owner string, ctx context.Context) (interface{}, error) {
	document := bson.D{{Key: "app_name", Value: appName}}
	if logo != "" {
		document = append(document, bson.E{Key: "logo", Value: logo})
	}
	if description != "" {
		document = append(document, bson.E{Key: "description", Value: description})
	}
	if private == true {
		document = append(document, bson.E{Key: "private", Value: private})
	}

	if tuf == true {
		document = append(document, bson.E{Key: "tuf", Value: tuf})
	}
	updateTeamUserPermissions := func(teamUser model.TeamUser, result interface{}, teamUsername string) error {
		return c.updateTeamUserPermissions(teamUser, result, teamUsername, "app", ctx)
	}

	return c.createMetaDocument(
		document,
		"app_name_owner_sort_by_asc_created",
		"app",
		owner,
		ctx,
		updateTeamUserPermissions,
	)
}

// checkEntityAccess is a helper function to check if a team user has access to a specific entity
func checkEntityAccess(teamUser model.TeamUser, entityID string, allowedIDs []string, entityType string) error {
	if teamUser.ID == primitive.NilObjectID {
		return nil
	}

	logrus.Debugf("Checking if team user has access to %s ID: %s", entityType, entityID)
	logrus.Debugf("Team user allowed %ss: %v", entityType, allowedIDs)

	// Create a map for O(1) lookup
	allowedMap := make(map[string]struct{}, len(allowedIDs))
	for _, id := range allowedIDs {
		allowedMap[id] = struct{}{}
	}

	// Check if entityID exists in the map
	if _, hasAccess := allowedMap[entityID]; !hasAccess {
		logrus.Debugf("Team user %s does not have access to %s ID: %s", teamUser.ID.Hex(), entityType, entityID)
		return fmt.Errorf("you don't have access to this %s", entityType)
	}

	logrus.Debugf("Team user has access to %s ID: %s", entityType, entityID)
	return nil
}

type uploadScope struct {
	owner      string
	appID      primitive.ObjectID
	channelID  primitive.ObjectID
	platformID primitive.ObjectID
	archID     primitive.ObjectID
}

func (c *appRepository) resolveUploadScope(ctxQuery map[string]interface{}, owner string, ctx context.Context) (uploadScope, error) {
	metaCollection := c.client.Database(c.config.Database).Collection("apps_meta")
	var appMeta, channelMeta, platformMeta, archMeta struct {
		ID primitive.ObjectID `bson:"_id"`
	}

	teamUsersCollection := c.client.Database(c.config.Database).Collection("team_users")
	var teamUser model.TeamUser
	err := teamUsersCollection.FindOne(ctx, bson.M{"username": owner}).Decode(&teamUser)
	if err == nil {
		if !teamUser.Permissions.Apps.Upload {
			return uploadScope{}, errors.New("you don't have permission to upload apps")
		}
		owner = teamUser.Owner
	}

	metaFilter := bson.D{
		{Key: "app_name", Value: ctxQuery["app_name"].(string)},
		{Key: "owner", Value: owner},
	}
	if err := metaCollection.FindOne(ctx, metaFilter).Decode(&appMeta); err != nil {
		return uploadScope{}, fmt.Errorf("app_name not found in apps_meta collection or you don't have permission to access it")
	}
	if teamUser.ID != primitive.NilObjectID {
		if err := checkEntityAccess(teamUser, appMeta.ID.Hex(), teamUser.Permissions.Apps.Allowed, "app"); err != nil {
			return uploadScope{}, err
		}
	}

	if channelName, ok := ctxQuery["channel"].(string); ok && channelName != "" {
		channelFilter := bson.D{
			{Key: "channel_name", Value: channelName},
			{Key: "owner", Value: owner},
		}
		if err := metaCollection.FindOne(ctx, channelFilter).Decode(&channelMeta); err != nil {
			return uploadScope{}, fmt.Errorf("channel not found in apps_meta collection or you don't have permission to access it")
		}
		if err := checkEntityAccess(teamUser, channelMeta.ID.Hex(), teamUser.Permissions.Channels.Allowed, "channel"); err != nil {
			return uploadScope{}, err
		}
	}

	if platformName, ok := ctxQuery["platform"].(string); ok && platformName != "" {
		platformFilter := bson.D{
			{Key: "platform_name", Value: platformName},
			{Key: "owner", Value: owner},
		}
		if err := metaCollection.FindOne(ctx, platformFilter).Decode(&platformMeta); err != nil {
			return uploadScope{}, fmt.Errorf("platform not found in apps_meta collection or you don't have permission to access it")
		}
		if err := checkEntityAccess(teamUser, platformMeta.ID.Hex(), teamUser.Permissions.Platforms.Allowed, "platform"); err != nil {
			return uploadScope{}, err
		}
	}

	if archName, ok := ctxQuery["arch"].(string); ok && archName != "" {
		archFilter := bson.D{
			{Key: "arch_id", Value: archName},
			{Key: "owner", Value: owner},
		}
		if err := metaCollection.FindOne(ctx, archFilter).Decode(&archMeta); err != nil {
			return uploadScope{}, fmt.Errorf("arch not found in apps_meta collection or you don't have permission to access it")
		}
		if err := checkEntityAccess(teamUser, archMeta.ID.Hex(), teamUser.Permissions.Archs.Allowed, "architecture"); err != nil {
			return uploadScope{}, err
		}
	}

	return uploadScope{
		owner:      owner,
		appID:      appMeta.ID,
		channelID:  channelMeta.ID,
		platformID: platformMeta.ID,
		archID:     archMeta.ID,
	}, nil
}

func (c *appRepository) checkUploadAvailable(scope uploadScope, version, extension string, overwrite bool, ctx context.Context) error {
	collection := c.client.Database(c.config.Database).Collection("apps")
	existingDoc := collection.FindOne(ctx, bson.D{
		{Key: "app_id", Value: scope.appID},
		{Key: "version", Value: version},
		{Key: "channel_id", Value: scope.channelID},
		{Key: "owner", Value: scope.owner},
	})
	if err := existingDoc.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil
		}
		return err
	}

	var appData model.SpecificApp
	if err := existingDoc.Decode(&appData); err != nil {
		return err
	}

	if err := applyUploadedArtifact(&appData, model.Artifact{
		Platform: scope.platformID,
		Arch:     scope.archID,
		Package:  extension,
	}, overwrite); err != nil {
		return err
	}

	return nil
}

func (c *appRepository) CheckUploadAvailable(ctxQuery map[string]interface{}, extension string, owner string, ctx context.Context) error {
	scope, err := c.resolveUploadScope(ctxQuery, owner, ctx)
	if err != nil {
		return err
	}
	return c.checkUploadAvailable(scope, ctxQuery["version"].(string), extension, utils.GetBoolParam(ctxQuery["overwrite"]), ctx)
}

func (c *appRepository) PrepareUpload(ctxQuery map[string]interface{}, extension string, owner string, ctx context.Context) (UploadClaim, error) {
	scope, err := c.resolveUploadScope(ctxQuery, owner, ctx)
	if err != nil {
		return UploadClaim{}, err
	}
	if err := c.checkUploadAvailable(scope, ctxQuery["version"].(string), extension, utils.GetBoolParam(ctxQuery["overwrite"]), ctx); err != nil {
		return UploadClaim{}, err
	}

	return c.acquireUploadClaim(ctx, scope.owner, scope.appID, ctxQuery["version"].(string), scope.channelID, scope.platformID, scope.archID, extension)
}

func (c *appRepository) ReleaseUploadClaim(claim UploadClaim, ctx context.Context) error {
	if claim.ID == "" || claim.Token == "" {
		return nil
	}
	claimsCollection := c.client.Database(c.config.Database).Collection("upload_claims")
	_, err := claimsCollection.DeleteOne(ctx, bson.M{
		"_id":   claim.ID,
		"token": claim.Token,
	})
	return err
}

func (c *appRepository) Upload(ctxQuery map[string]interface{}, appLink, extension string, owner string, ctx context.Context, redisClient *redis.Client, env *viper.Viper, checkAppVisibility bool) (interface{}, error) {
	collection := c.client.Database(c.config.Database).Collection("apps")
	metaCollection := c.client.Database(c.config.Database).Collection("apps_meta")
	var uploadResult interface{}
	var err error
	var appMeta, channelMeta, platformMeta, archMeta struct {
		ID primitive.ObjectID `bson:"_id"`
	}

	logrus.Debugf("Upload called with owner: %s, app_name: %s, version: %s, visibility: %t",
		owner, ctxQuery["app_name"].(string), ctxQuery["version"].(string), checkAppVisibility)

	// Check if the user is a team user
	teamUsersCollection := c.client.Database(c.config.Database).Collection("team_users")
	var teamUser model.TeamUser
	err = teamUsersCollection.FindOne(ctx, bson.M{"username": owner}).Decode(&teamUser)

	// If user is a team user, check permissions
	if err == nil {
		logrus.Debugf("User %s is a team user with owner: %s", owner, teamUser.Owner)

		// Check if the team user has permission to upload apps
		if !teamUser.Permissions.Apps.Upload {
			logrus.Debugf("Team user %s does not have permission to upload apps", owner)
			return nil, errors.New("you don't have permission to upload apps")
		}

		// Set owner to the team user's admin for database operations
		owner = teamUser.Owner
		logrus.Debugf("Using admin owner: %s for operations", owner)
	} else {
		logrus.Debugf("User %s is not a team user", owner)
	}

	// Find app_id from apps_meta by app_name and owner
	metaFilter := bson.D{
		{Key: "app_name", Value: ctxQuery["app_name"].(string)},
		{Key: "owner", Value: owner},
	}
	logrus.Debugf("Finding app meta with filter: %+v", metaFilter)
	err = metaCollection.FindOne(ctx, metaFilter).Decode(&appMeta)
	if err != nil {
		logrus.Debugf("Error finding app meta: %v", err)
		return nil, fmt.Errorf("app_name not found in apps_meta collection or you don't have permission to access it")
	}
	logrus.Debugf("Found app meta with ID: %s", appMeta.ID.Hex())

	// If user is a team user, check if they have access to this specific app
	if teamUser.ID != primitive.NilObjectID {
		if err := checkEntityAccess(teamUser, appMeta.ID.Hex(), teamUser.Permissions.Apps.Allowed, "app"); err != nil {
			return nil, err
		}
	}

	// Fetch channel_id
	if channelName, ok := ctxQuery["channel"].(string); ok && channelName != "" {
		logrus.Debugf("Fetching channel meta for channel: %s", channelName)
		channelFilter := bson.D{
			{Key: "channel_name", Value: channelName},
			{Key: "owner", Value: owner},
		}
		err = metaCollection.FindOne(ctx, channelFilter).Decode(&channelMeta)
		if err != nil {
			logrus.Debugf("Error finding channel meta: %v", err)
			return nil, fmt.Errorf("channel not found in apps_meta collection or you don't have permission to access it")
		}
		logrus.Debugf("Found channel meta with ID: %s", channelMeta.ID.Hex())

		if err := checkEntityAccess(teamUser, channelMeta.ID.Hex(), teamUser.Permissions.Channels.Allowed, "channel"); err != nil {
			return nil, err
		}
	}

	// Fetch platform_id
	if platformName, ok := ctxQuery["platform"].(string); ok && platformName != "" {
		logrus.Debugf("Fetching platform meta for platform: %s", platformName)
		platformFilter := bson.D{
			{Key: "platform_name", Value: platformName},
			{Key: "owner", Value: owner},
		}
		err = metaCollection.FindOne(ctx, platformFilter).Decode(&platformMeta)
		if err != nil {
			logrus.Debugf("Error finding platform meta: %v", err)
			return nil, fmt.Errorf("platform not found in apps_meta collection or you don't have permission to access it")
		}
		logrus.Debugf("Found platform meta with ID: %s", platformMeta.ID.Hex())

		if err := checkEntityAccess(teamUser, platformMeta.ID.Hex(), teamUser.Permissions.Platforms.Allowed, "platform"); err != nil {
			return nil, err
		}
	}

	// Fetch arch_id
	if archName, ok := ctxQuery["arch"].(string); ok && archName != "" {
		logrus.Debugf("Fetching arch meta for arch: %s", archName)
		archFilter := bson.D{
			{Key: "arch_id", Value: archName},
			{Key: "owner", Value: owner},
		}
		err = metaCollection.FindOne(ctx, archFilter).Decode(&archMeta)
		if err != nil {
			logrus.Debugf("Error finding arch meta: %v", err)
			return nil, fmt.Errorf("arch not found in apps_meta collection or you don't have permission to access it")
		}
		logrus.Debugf("Found arch meta with ID: %s", archMeta.ID.Hex())

		if err := checkEntityAccess(teamUser, archMeta.ID.Hex(), teamUser.Permissions.Archs.Allowed, "architecture"); err != nil {
			return nil, err
		}
	}

	// Check if a document with the same "app_id" and "version" already exists
	logrus.Debugf("Checking if document exists with app_id: %s, version: %s, owner: %s",
		appMeta.ID.Hex(), ctxQuery["version"].(string), owner)

	existingDoc := collection.FindOne(ctx, bson.D{
		{Key: "app_id", Value: appMeta.ID},
		{Key: "version", Value: ctxQuery["version"].(string)},
		{Key: "channel_id", Value: channelMeta.ID},
		{Key: "owner", Value: owner},
	})

	if existingDoc.Err() == nil {
		logrus.Debugf("Document exists, updating it")
		var appData model.SpecificApp
		if err := existingDoc.Decode(&appData); err != nil {
			logrus.Debugf("Error decoding existing document: %v", err)
			return nil, err
		}

		var hashes map[string]string
		var length int64
		if hashesVal, exists := ctxQuery["hashes"]; exists {
			if hashesMap, ok := hashesVal.(map[string]string); ok {
				hashes = hashesMap
			}
		}
		if lengthVal, exists := ctxQuery["length"]; exists {
			if lengthInt, ok := lengthVal.(int64); ok {
				length = lengthInt
			}
		}

		newArtifact := model.Artifact{
			Link:      appLink,
			Platform:  platformMeta.ID,
			Arch:      archMeta.ID,
			Package:   extension,
			Signature: ctxQuery["signature"].(string),
		}
		if hashes != nil {
			newArtifact.Hashes = hashes
		}
		if length > 0 {
			newArtifact.Length = length
		}

		baseVersionFilter := bson.D{
			{Key: "app_id", Value: appMeta.ID},
			{Key: "version", Value: ctxQuery["version"].(string)},
			{Key: "channel_id", Value: channelMeta.ID},
			{Key: "owner", Value: owner},
		}
		overwrite := utils.GetBoolParam(ctxQuery["overwrite"])
		artifactIndex := artifactTupleIndex(appData.Artifacts, newArtifact)
		if artifactIndex >= 0 && !overwrite {
			logrus.Debugf("Upload function in mongod/create.go: %s", ErrUploadArtifactAlreadyExists)
			return uploadArtifactAlreadyExistsMessage, ErrUploadArtifactAlreadyExists
		}
		logrus.Debugf("Adding new artifact to existing document")

		if artifactIndex >= 0 {
			// overwrite 仅替换该 tuple 的二进制 artifact 本身，不触碰版本级的
			// published/critical/required_intermediate/changelog。这些字段为同一
			// version 下所有平台 artifact 共享，由发布动作单独控制；重传单个平台的
			// 安装包不应顺带重置整个版本的发布状态或覆盖更新日志历史。
			updateFields := bson.D{{Key: "updated_at", Value: time.Now()}}
			uploadResult, err = replaceArtifactInExistingVersion(ctx, collection, baseVersionFilter, newArtifact, updateFields)
		} else {
			uploadResult, err = appendArtifactToExistingVersion(ctx, collection, baseVersionFilter, newArtifact)
		}
		if err != nil {
			logrus.Debugf("Error updating document: %v", err)
			return nil, err
		}

		logrus.Debugf("Document updated successfully")
	} else {
		// Handle the case when no document exists
		logrus.Debugf("Document does not exist, creating new one")
		publishParam, publishExists := ctxQuery["publish"]
		criticalParam, criticalExists := ctxQuery["critical"]
		intermediateParam, intermediateExists := ctxQuery["intermediate"]

		publish := false
		if publishExists {
			publish = utils.GetBoolParam(publishParam)
			logrus.Debugf("Setting published to: %t", publish)
		}

		critical := false
		if criticalExists {
			critical = utils.GetBoolParam(criticalParam)
			logrus.Debugf("Setting critical to: %t", critical)
		}

		requiredIntermediate := false
		if intermediateExists {
			requiredIntermediate = utils.GetBoolParam(intermediateParam)
			logrus.Debugf("Setting required_intermediate to: %t", requiredIntermediate)
		}

		var hashes map[string]string
		var length int64
		if hashesVal, exists := ctxQuery["hashes"]; exists {
			if hashesMap, ok := hashesVal.(map[string]string); ok {
				hashes = hashesMap
			}
		}
		if lengthVal, exists := ctxQuery["length"]; exists {
			if lengthInt, ok := lengthVal.(int64); ok {
				length = lengthInt
			}
		}

		artifact := model.Artifact{
			Link:      appLink,
			Platform:  platformMeta.ID,
			Arch:      archMeta.ID,
			Package:   extension,
			Signature: ctxQuery["signature"].(string),
		}
		if hashes != nil {
			artifact.Hashes = hashes
		}
		if length > 0 {
			artifact.Length = length
		}

		changelog := model.Changelog{
			Version: ctxQuery["version"].(string),
			Changes: ctxQuery["changelog"].(string),
			Date:    time.Now().Format("2006-01-02"),
		}
		filter := bson.D{
			{Key: "app_id", Value: appMeta.ID},
			{Key: "version", Value: ctxQuery["version"].(string)},
			{Key: "channel_id", Value: channelMeta.ID},
			{Key: "published", Value: publish},
			{Key: "critical", Value: critical},
			{Key: "required_intermediate", Value: requiredIntermediate},
			{Key: "artifacts", Value: []model.Artifact{artifact}},
			{Key: "changelog", Value: []model.Changelog{changelog}},
			{Key: "updated_at", Value: time.Now()},
			{Key: "owner", Value: owner},
		}
		logrus.Debugf("Channel Meta: %v", channelMeta)
		logrus.Debugf("Platform Meta: %v", platformMeta)
		logrus.Debugf("Arch Meta: %v", archMeta)
		uploadResult, err = collection.InsertOne(ctx, filter)
		if err != nil {
			if mongoErr, ok := err.(mongo.WriteException); ok {
				for _, writeErr := range mongoErr.WriteErrors {
					if writeErr.Code == 11000 && strings.Contains(writeErr.Message, "unique_app_version_channel_owner") {
						uploadResult, err = appendArtifactToExistingVersion(ctx, collection, bson.D{
							{Key: "app_id", Value: appMeta.ID},
							{Key: "version", Value: ctxQuery["version"].(string)},
							{Key: "channel_id", Value: channelMeta.ID},
							{Key: "owner", Value: owner},
						}, artifact)
						if err != nil {
							return nil, err
						}
						logrus.Debugf("Document already existed, artifact appended atomically")
						goto uploadComplete
					}
					if writeErr.Code == 11000 && strings.Contains(writeErr.Message, "unique_link_to_app_with_specific_version") {
						return "app with this link already exists", errors.New("app with this link already exists")
					}
				}
			}
			logrus.Errorf("Error inserting document: %v", err)
			return nil, err
		}
		logrus.Debugf("Document created successfully")
	}

uploadComplete:
	switch v := uploadResult.(type) {
	case *mongo.InsertOneResult:
		insertedID, ok := v.InsertedID.(primitive.ObjectID)
		if !ok {
			logrus.Debugf("Error extracting ID from InsertOneResult")
			return nil, errors.New("error extracting ID from InsertOneResult")
		}
		var appData model.SpecificApp
		err = collection.FindOne(ctx, bson.D{{Key: "_id", Value: insertedID}}).Decode(&appData)
		if err != nil {
			logrus.Debugf("Error finding inserted document: %v", err)
			return nil, err
		}
		logrus.Debugf("Uploaded result to mongo: %+v", appData)
		return appData, nil

	case primitive.ObjectID:
		var appData model.SpecificApp
		err = collection.FindOne(ctx, bson.D{{Key: "_id", Value: v}}).Decode(&appData)
		if err != nil {
			logrus.Debugf("Error finding updated document: %v", err)
			return nil, err
		}
		logrus.Debugf("Updated result in mongo: %+v", appData)
		return appData, nil

	default:
		logrus.Debugf("Unexpected return type: %T", uploadResult)
		return nil, errors.New("unexpected return type")
	}
}
