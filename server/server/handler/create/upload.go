package create

import (
	"context"
	"errors"
	db "faynoSync/mongod"
	"faynoSync/server/model"
	"faynoSync/server/ownership"
	"faynoSync/server/utils"
	"faynoSync/server/utils/updaters"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type uploadFilePlan struct {
	file      *multipart.FileHeader
	link      string
	extension string
	hashes    map[string]string
	length    int64
	claim     db.UploadClaim
}

type uploadClaimReleaser interface {
	ReleaseUploadClaim(claim db.UploadClaim, ctx context.Context) error
}

func uploadFileExtension(filename string) string {
	lastDotIndex := strings.LastIndex(filename, ".")
	if lastDotIndex == -1 {
		return ""
	}
	return filename[lastDotIndex:]
}

func normalizeUploadPackage(extension string) string {
	extension = strings.TrimSpace(extension)
	if extension == "" || strings.HasPrefix(extension, ".") {
		return extension
	}
	return "." + extension
}

func releaseUploadClaim(repository uploadClaimReleaser, claim db.UploadClaim, _ context.Context) {
	releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := repository.ReleaseUploadClaim(claim, releaseCtx); err != nil {
		logrus.Error("failed to release upload claim: ", err)
	}
}

func releaseUploadPlans(repository uploadClaimReleaser, uploadPlans []uploadFilePlan, ctx context.Context) {
	for _, uploadPlan := range uploadPlans {
		releaseUploadClaim(repository, uploadPlan.claim, ctx)
	}
}

func InvalidateCache(ctx context.Context, params map[string]interface{}, rdb *redis.Client) error {

	appName, _ := params["app_name"].(string)
	channel, _ := params["channel"].(string)
	appIdentifiers := []string{appName}
	normalizedAppName := db.NormalizeAppIdentifier(appName)
	if normalizedAppName != "" && normalizedAppName != appName {
		appIdentifiers = append(appIdentifiers, normalizedAppName)
	}

	keysToDelete := make(map[string]struct{})
	for _, appIdentifier := range appIdentifiers {
		pattern := fmt.Sprintf("owner=*&app_name=%s&version=*&channel=%s&platform=*&arch=*",
			appIdentifier, channel)
		logrus.Debugf("Redis pattern %s will be invalidated.", pattern)

		keys, err := rdb.Keys(ctx, pattern).Result()
		if err != nil {
			return fmt.Errorf("failed to fetch keys for invalidation: %w", err)
		}

		for _, key := range keys {
			keysToDelete[key] = struct{}{}
		}
	}

	if len(keysToDelete) == 0 {
		logrus.Debug("No keys found to invalidate.")
		return nil
	}

	for key := range keysToDelete {
		logrus.Debugf("Invalidating key: %s", key)
		if err := rdb.Del(ctx, key).Err(); err != nil {
			logrus.Errorf("Failed to invalidate key: %s, error: %v", key, err)
		}
	}

	return nil
}

func UploadApp(c *gin.Context, repository db.AppRepository, database *mongo.Database, rdb *redis.Client, performanceMode bool) {
	// Debug received request (make sense for using only on localhost)
	// utils.DumpRequest(c)

	// Get username from JWT token
	username, err := utils.GetUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// Resolve the owner namespace this upload writes under. Single-owner mode
	// collapses it to the deployment owner; otherwise a team member resolves to
	// their admin's owner.
	owner, err := ownership.ResolveOwner(c, database)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctxQueryMap, err := utils.ValidateParams(c, database)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Add intermediate field to ctxQueryMap if it exists in the request
	if intermediate := c.PostForm("intermediate"); intermediate != "" {
		ctxQueryMap["intermediate"] = intermediate
	}

	appName, ok := ctxQueryMap["app_name"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_name is required"})
		return
	}
	if err := validateAPITokenAppScope(c, database, owner, appName); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	if utils.GetBoolParam(ctxQueryMap["overwrite"]) {
		status, err := validateOverwriteEditPermission(c, database, username)
		if err != nil {
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "multipart form data is required",
		})
		return
	}

	files := form.File["file"] // Assuming the field name is "file" not "files"

	// Validate updater requirements
	if updater, exists := ctxQueryMap["updater"]; exists && updater != "" {
		updaterStr := updater.(string)

		// Validate files for updaters that require specific file types
		if err := updaters.ValidateFiles(files, updaterStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate parameters for updaters that require specific parameters
		if err := updaters.ValidateParams(ctxQueryMap, updaterStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	checkAppVisibility, err := utils.CheckPrivate(ctxQueryMap["app_name"].(string), database, c)
	if err != nil {
		logrus.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check private"})
		return
	}
	var uploadPlans []uploadFilePlan
	defer func() {
		releaseUploadPlans(repository, uploadPlans, c.Request.Context())
	}()
	seenExtensions := make(map[string]struct{})
	for _, file := range files {
		// Calculate hashes and length before uploading to S3
		hashes, length, err := utils.CalculateFileHashes(file)
		if err != nil {
			logrus.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to calculate file hashes"})
			return
		}
		extension := uploadFileExtension(file.Filename)
		if _, exists := seenExtensions[extension]; exists {
			c.JSON(http.StatusConflict, gin.H{"error": db.ErrUploadArtifactAlreadyExists.Error()})
			return
		}
		seenExtensions[extension] = struct{}{}

		claim, err := repository.PrepareUpload(ctxQueryMap, extension, owner, c.Request.Context())
		if err != nil {
			logrus.Error(err)
			if errors.Is(err, db.ErrUploadArtifactAlreadyExists) {
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}

		uploadPlans = append(uploadPlans, uploadFilePlan{
			file:      file,
			extension: extension,
			hashes:    hashes,
			length:    length,
			claim:     claim,
		})
	}
	for i, uploadPlan := range uploadPlans {
		link, _, err := utils.UploadToS3(ctxQueryMap, owner, uploadPlan.file, c, viper.GetViper(), checkAppVisibility)
		if err != nil {
			logrus.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file to S3"})
			return
		}
		uploadPlans[i].link = link
	}

	var results []interface{}
	for _, uploadPlan := range uploadPlans {
		// Add hashes and length to ctxQueryMap for this specific file
		fileCtxQuery := make(map[string]interface{})
		for k, v := range ctxQueryMap {
			fileCtxQuery[k] = v
		}
		fileCtxQuery["hashes"] = uploadPlan.hashes
		fileCtxQuery["length"] = uploadPlan.length

		result, err := repository.Upload(fileCtxQuery, uploadPlan.link, uploadPlan.extension, owner, c.Request.Context(), rdb, viper.GetViper(), checkAppVisibility)
		if err != nil {
			logrus.Error(err)
			if errors.Is(err, db.ErrUploadArtifactAlreadyExists) {
				c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
		results = append(results, result)
	}

	if performanceMode && rdb != nil {

		publish := utils.GetBoolParam(ctxQueryMap["publish"])

		logrus.Debugf("Uploaded app has publish: %t, invalidation of redis cache is starting.", publish)

		if publish {
			if err := InvalidateCache(c.Request.Context(), ctxQueryMap, rdb); err != nil {
				logrus.Error("Error invalidating cache:", err)
			}
		}
	}

	if len(results) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no results found. Please check your files."})
		return
	}

	if appData, ok := results[0].(model.SpecificApp); ok {
		c.JSON(http.StatusOK, gin.H{"uploadResult.Uploaded": appData.ID.Hex()})

		go func() {
			if viper.GetBool("SLACK_ENABLE") {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()

				humanReadableData, err := repository.FetchAppByID(appData.ID, ctx)
				if err != nil || len(humanReadableData) == 0 {
					logrus.Error("Error fetching human-readable data for Slack notification: ", err)
					return
				}

				slackData := humanReadableData[0]

				var platforms, arches, artifacts, pkgs []string
				for _, artifact := range slackData.Artifacts {
					platforms = append(platforms, artifact.Platform)
					arches = append(arches, artifact.Arch)
					artifacts = append(artifacts, artifact.Link)
					pkgs = append(pkgs, artifact.Package)
				}

				var changelog []string
				for _, change := range slackData.Changelog {
					if strings.TrimSpace(change.Changes) == "" {
						continue
					}
					changelog = append(changelog, change.Changes)
				}

				utils.SendSlackNotification(
					owner,
					slackData.AppName,
					slackData.Channel,
					slackData.Version,
					platforms,
					arches,
					artifacts,
					changelog,
					pkgs,
					viper.GetViper(),
					rdb,
					slackData.Published,
					slackData.Critical,
				)
			}
		}()
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid result type"})
	}
}

func CheckUploadAvailable(c *gin.Context, repository db.AppRepository, database *mongo.Database) {
	username, err := utils.GetUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctxQueryMap := map[string]interface{}{
		"app_name":  strings.TrimSpace(c.Query("app_name")),
		"version":   strings.TrimSpace(c.Query("version")),
		"channel":   strings.TrimSpace(c.Query("channel")),
		"platform":  strings.TrimSpace(c.Query("platform")),
		"arch":      strings.TrimSpace(c.Query("arch")),
		"overwrite": strings.TrimSpace(c.Query("overwrite")),
	}
	appName, _ := ctxQueryMap["app_name"].(string)
	if appName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_name is required"})
		return
	}
	if version, _ := ctxQueryMap["version"].(string); version == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "version is required"})
		return
	}
	for _, key := range []string{"channel", "platform", "arch"} {
		if value, _ := ctxQueryMap[key].(string); value == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": key + " is required"})
			return
		}
	}

	extension := normalizeUploadPackage(c.Query("package"))
	if extension == "" {
		extension = normalizeUploadPackage(c.Query("extension"))
	}
	if extension == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "package is required"})
		return
	}

	owner, err := ownership.ResolveOwner(c, database)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	if err := validateAPITokenAppScope(c, database, owner, appName); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	if utils.GetBoolParam(ctxQueryMap["overwrite"]) {
		status, err := validateOverwriteEditPermission(c, database, username)
		if err != nil {
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
	}

	if err := repository.CheckUploadAvailable(ctxQueryMap, extension, owner, c.Request.Context()); err != nil {
		if errors.Is(err, db.ErrUploadArtifactAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.Status(http.StatusNoContent)
}

func validateOverwriteEditPermission(c *gin.Context, database *mongo.Database, username string) (int, error) {
	if isAPIToken, exists := c.Get("is_api_token"); exists {
		if apiTokenValue, ok := isAPIToken.(bool); ok && apiTokenValue {
			return http.StatusForbidden, fmt.Errorf("overwrite requires apps.edit permission")
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()
	err := database.Collection("admins").FindOne(ctx, bson.M{"username": username}).Err()
	if err == nil {
		return 0, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return http.StatusInternalServerError, err
	}

	var teamUser model.TeamUser
	err = database.Collection("team_users").FindOne(ctx, bson.M{"username": username}).Decode(&teamUser)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return http.StatusForbidden, fmt.Errorf("overwrite requires apps.edit permission")
	}
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if !teamUser.Permissions.Apps.Edit {
		return http.StatusForbidden, fmt.Errorf("overwrite requires apps.edit permission")
	}

	return 0, nil
}

func validateAPITokenAppScope(c *gin.Context, database *mongo.Database, owner, appName string) error {
	isAPIToken, exists := c.Get("is_api_token")
	if !exists {
		return nil
	}

	apiTokenBool, ok := isAPIToken.(bool)
	if !ok || !apiTokenBool {
		return nil
	}

	allowedAppsRaw, exists := c.Get("allowed_apps")
	if !exists {
		return fmt.Errorf("api token scope is missing")
	}

	allowedApps, ok := allowedAppsRaw.([]string)
	if !ok || len(allowedApps) == 0 {
		return fmt.Errorf("api token has no allowed applications")
	}

	allowedSet := make(map[string]struct{}, len(allowedApps))
	for _, appID := range allowedApps {
		allowedSet[appID] = struct{}{}
	}

	var appMeta struct {
		ID primitive.ObjectID `bson:"_id"`
	}

	metaCollection := database.Collection("apps_meta")
	if err := metaCollection.FindOne(
		c.Request.Context(),
		bson.M{"app_name": appName, "owner": owner},
	).Decode(&appMeta); err != nil {
		return fmt.Errorf("app_name not found in apps_meta collection or you don't have permission to access it")
	}

	if _, hasAccess := allowedSet[appMeta.ID.Hex()]; !hasAccess {
		return fmt.Errorf("api token has no access to this app")
	}

	return nil
}
