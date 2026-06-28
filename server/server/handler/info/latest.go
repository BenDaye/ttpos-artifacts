package info

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	db "faynoSync/mongod"
	"faynoSync/server/model"
	"faynoSync/server/ownership"
	"faynoSync/server/utils"
	"faynoSync/server/utils/updaters"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/mongo"
)

type CachedResponse struct {
	Response   interface{} `json:"response"`
	HTTPStatus int         `json:"http_status"`
}

const CacheRedirectHeadersContextKey = "cache_latest_redirect_headers"

type latestAppRepository interface {
	FetchLatestVersionOfApp(appName, channel string, ctx context.Context, owner string) ([]*model.SpecificAppWithoutIDs, error)
}

func CreateCacheKey(params map[string]interface{}) string {
	baseKey := fmt.Sprintf("owner=%s&app_name=%s&version=%s&channel=%s&platform=%s&arch=%s",
		cacheParam(params, "owner"),
		cacheParam(params, "app_name"),
		cacheParam(params, "version"),
		cacheParam(params, "channel"),
		cacheParam(params, "platform"),
		cacheParam(params, "arch"),
	)

	if updater := cacheParam(params, "updater"); updater != "" {
		baseKey += fmt.Sprintf("&updater=%s", updater)
	}

	if pkg := cacheParam(params, "package"); pkg != "" {
		baseKey += fmt.Sprintf("&package=%s", pkg)
	}

	return baseKey
}

func cacheParam(params map[string]interface{}, key string) string {
	if value, exists := params[key]; exists && value != nil {
		return fmt.Sprint(value)
	}
	return ""
}

func cacheResponse(ctx context.Context, rdb *redis.Client, cacheKey string, response interface{}, httpStatus int) {
	cachedData := CachedResponse{
		Response:   response,
		HTTPStatus: httpStatus,
	}

	jsonData, err := json.Marshal(cachedData)
	if err != nil {
		logrus.Error("Error marshalling cached response:", err)
		return
	}
	err = rdb.Set(ctx, cacheKey, jsonData, time.Hour*24).Err()
	if err != nil {
		logrus.Error("Error setting data to Redis:", err)
	} else {
		logrus.Debugln("Successfully set data to cache:", cachedData)
	}
}

// BuildChangelogResponse builds changelog string from changelog entries
func BuildChangelogResponse(changelog []db.Changelog) string {
	if len(changelog) == 0 {
		return ""
	}

	var changelogBuilder strings.Builder
	for _, changelog := range changelog {
		if changelog.Changes != "" {
			changelogBuilder.WriteString(changelog.Changes)
			changelogBuilder.WriteString("\n")
		}
	}

	// Only return if there was any changelog to include
	if changelogBuilder.Len() > 0 {
		return changelogBuilder.String()
	}

	return ""
}

// BuildArtifactUrls builds artifact URLs map from artifacts slice
func BuildArtifactUrls(artifacts []db.Artifact, platform, arch string) map[string]string {
	logrus.Debugf("Artifacts in BuildArtifactUrls: %v", artifacts)
	urls := make(map[string]string)

	for _, artifact := range artifacts {
		var key string
		if artifact.Package == "" {
			key = "update_url"
		} else if artifact.Package != "" && artifact.Link != "" {
			key = "update_url_" + strings.TrimPrefix(artifact.Package, ".")
		}

		if artifact.Link != "" && strings.Contains(artifact.Link, platform) && strings.Contains(artifact.Link, arch) {
			urls[key] = artifact.Link
			if artifact.Signature != "" {
				urls["signature"] = artifact.Signature
			}
		}
	}

	return urls
}

func FindLatestVersion(c *gin.Context, repository db.AppRepository, db *mongo.Database, rdb *redis.Client, performanceMode bool) {
	var httpStatus int
	validatedParams, err := utils.ValidateParamsLatest(c, db)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	logrus.Debugf("Validated parameters: %+v", validatedParams)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Single-owner mode: the deployment owner is authoritative for checkVersion
	// (and the squirrel updater route), so override any client-supplied owner
	// before the cache key is derived.
	if ownership.Enabled() {
		validatedParams["owner"] = ownership.DeploymentOwner()
	}
	cacheKey := CreateCacheKey(validatedParams)
	logrus.Debugf("Generated cache key: %s", cacheKey)
	// Check Redis only if PERFORMANCE_MODE is true and Redis client is not nil
	if performanceMode && rdb != nil {
		cachedResponse, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			// If cache exists, return the cached response
			var cachedData CachedResponse
			if json.Unmarshal([]byte(cachedResponse), &cachedData) == nil {
				logrus.Debugln("Return cached data: ", cachedData)

				// Record telemetry on cache hits too; otherwise PERFORMANCE_MODE
				// short-circuits before logStatsToRedis and no stats are ever
				// recorded after the first uncached request.
				logStatsToRedis(ctx, rdb, validatedParams, cachedUpdateAvailable(cachedData.Response), resolveDeviceID(c))

				// Handle redirect for cached response
				if cachedData.HTTPStatus == 302 {
					if responseMap, ok := cachedData.Response.(map[string]interface{}); ok {
						if redirectURL, exists := responseMap["url"]; exists {
							c.Redirect(http.StatusFound, redirectURL.(string))
							return
						}
					}
				}

				c.JSON(cachedData.HTTPStatus, cachedData.Response)
				return
			}
		}
	}

	// Request on repository
	checkResult, err := repository.CheckLatestVersion(validatedParams["app_name"].(string), validatedParams["version"].(string), validatedParams["channel"].(string), validatedParams["platform"].(string), validatedParams["arch"].(string), ctx, validatedParams["owner"].(string))
	if err != nil {
		logrus.Debugf("CheckResult: %+v", checkResult)
		logrus.Error("Error in CheckLatestVersion: ", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Log stats for the request. Falls back to a derived identifier when the
	// client does not send X-Device-ID, so traffic still aggregates.
	deviceID := resolveDeviceID(c)
	logrus.Debugf("resolved device id: %s", deviceID)
	// Update stats with actual update status
	logStatsToRedis(ctx, rdb, validatedParams, checkResult.Found, deviceID)

	if !checkResult.Found {
		if len(checkResult.Artifacts) == 0 {
			c.JSON(http.StatusOK, gin.H{"update_available": false, "error": "Not found"})
		} else {
			logrus.Infoln("checkResult in FindLatestVersion: ", checkResult)
			response := gin.H{"update_available": false, "critical": checkResult.Critical, "possible_rollback": checkResult.PossibleRollback}
			// Add artifact URLs to response
			artifactUrls := BuildArtifactUrls(checkResult.Artifacts, validatedParams["platform"].(string), validatedParams["arch"].(string))
			for key, url := range artifactUrls {
				response[key] = url
			}

			if changelog := BuildChangelogResponse(checkResult.Changelog); changelog != "" {
				response["changelog"] = changelog
			}
			response, httpStatus = updaters.BuildResponse(response, checkResult.Found, checkResult.PossibleRollback, checkResult.LatestVersion, validatedParams["updater"].(string))
			if performanceMode && rdb != nil {
				cacheResponse(ctx, rdb, cacheKey, response, httpStatus)
			}

			if httpStatus == 302 {
				if redirectURL, exists := response["url"]; exists {
					c.Redirect(http.StatusFound, redirectURL.(string))
					return
				}
			}
			c.JSON(httpStatus, response)
		}
		return
	}
	logrus.Debug("Check latest version response: ", checkResult)
	response := gin.H{"update_available": true, "critical": checkResult.Critical}

	// Add is_intermediate_required to response if it's true
	if checkResult.IsRequiredIntermediate {
		response["is_intermediate_required"] = true
	}

	// Add update URLs to the response
	artifactUrls := BuildArtifactUrls(checkResult.Artifacts, validatedParams["platform"].(string), validatedParams["arch"].(string))
	for key, url := range artifactUrls {
		logrus.Debugf("Adding link for key %s: %s", key, url)
		response[key] = url
	}
	// Add changelog to the response last
	if changelog := BuildChangelogResponse(checkResult.Changelog); changelog != "" {
		response["changelog"] = changelog
	}
	response, httpStatus = updaters.BuildResponse(response, checkResult.Found, checkResult.PossibleRollback, checkResult.LatestVersion, validatedParams["updater"].(string))
	if performanceMode && rdb != nil {
		cacheResponse(ctx, rdb, cacheKey, response, httpStatus)
	}
	if httpStatus == 302 {
		if redirectURL, exists := response["url"]; exists {
			c.Redirect(http.StatusFound, redirectURL.(string))
			return
		}
	}

	c.JSON(httpStatus, response)
}

func FetchLatestVersionOfApp(c *gin.Context, repository latestAppRepository, rdb *redis.Client, performanceMode bool) {
	if c.Query("app_name") == "" || c.Query("channel") == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Parameters 'app_name' and 'channel' are required",
		})
		return
	}
	// In single-owner mode the server owns the namespace, not the caller: ignore
	// any client-supplied owner and use the deployment owner so public download
	// lookups (including /dl and squirrel) always resolve the one real owner.
	owner := c.Query("owner")
	if ownership.Enabled() {
		owner = ownership.DeploymentOwner()
	}
	params := map[string]interface{}{
		"app_name": c.Query("app_name"),
		"channel":  c.Query("channel"),
		"platform": c.Query("platform"),
		"arch":     c.Query("arch"),
		"package":  c.Query("package"),
		"owner":    owner,
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	cacheKey := CreateCacheKey(params)
	logrus.Debugf("Generated cache key: %s", cacheKey)

	if performanceMode && rdb != nil {
		cachedResponse, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			var cachedData CachedResponse
			if json.Unmarshal([]byte(cachedResponse), &cachedData) == nil {
				logrus.Debugln("Returning cached data: ", cachedData)

				// Handle redirect for cached response
				if cachedData.HTTPStatus == 302 {
					if responseMap, ok := cachedData.Response.(map[string]interface{}); ok {
						if redirectURL, exists := responseMap["url"]; exists {
							c.Redirect(http.StatusFound, redirectURL.(string))
							return
						}
					}
				}

				c.JSON(cachedData.HTTPStatus, cachedData.Response)
				return
			}
		}
	}

	checkResult, err := repository.FetchLatestVersionOfApp(params["app_name"].(string), params["channel"].(string), ctx, params["owner"].(string))
	if err != nil {
		logrus.Error(err)
		status, response := latestFetchErrorResponse(err)
		c.JSON(status, response)
		return
	}

	jsonData, err := json.MarshalIndent(checkResult, "", "  ")
	if err != nil {
		logrus.Errorf("Error marshaling checkResult: %v", err)
	} else {
		logrus.Debugf("Fetched latest version response: %s", string(jsonData))
	}

	downloadUrls := make(map[string]map[string]map[string]map[string]map[string]string)

	if len(checkResult) > 0 {
		latestApp := checkResult[0]
		for _, artifact := range latestApp.Artifacts {

			if params["channel"] != "" && params["channel"] != latestApp.Channel {
				continue
			}
			if params["platform"] != "" && params["platform"] != artifact.Platform {
				continue
			}
			if params["arch"] != "" && params["arch"] != artifact.Arch {
				continue
			}

			packageType := strings.TrimPrefix(artifact.Package, ".")
			if packageType == "" {
				packageType = "no-extension"
			}

			if params["package"] != "" && params["package"] != packageType {
				continue
			}

			if _, exists := downloadUrls[latestApp.Channel]; !exists {
				downloadUrls[latestApp.Channel] = make(map[string]map[string]map[string]map[string]string)
			}

			if _, exists := downloadUrls[latestApp.Channel][artifact.Platform]; !exists {
				downloadUrls[latestApp.Channel][artifact.Platform] = make(map[string]map[string]map[string]string)
			}

			if _, exists := downloadUrls[latestApp.Channel][artifact.Platform][artifact.Arch]; !exists {
				downloadUrls[latestApp.Channel][artifact.Platform][artifact.Arch] = make(map[string]map[string]string)
			}

			downloadUrls[latestApp.Channel][artifact.Platform][artifact.Arch][packageType] = map[string]string{
				"url": artifact.Link,
			}
		}
	}

	if len(downloadUrls) == 0 {
		logrus.Warnf("No results found for parameters: %v", params)
		c.JSON(http.StatusNotFound, gin.H{"error": "No matching data found for the provided parameters"})
		return
	}

	urlCount, singleUrl := utils.CountUrls(downloadUrls)

	if urlCount == 1 {
		logrus.Debugf("Redirecting to the single download URL: %v", singleUrl)
		if c.GetBool(CacheRedirectHeadersContextKey) {
			c.Header("Cloudflare-CDN-Cache-Control", "public, max-age=300")
			c.Header("Cache-Control", "no-cache")
		}
		c.Redirect(http.StatusFound, singleUrl)
		return
	}

	logrus.Debugf("Generated download URLs: %v", downloadUrls)

	c.JSON(http.StatusOK, downloadUrls)

	if performanceMode && rdb != nil {
		cacheResponse(ctx, rdb, cacheKey, downloadUrls, http.StatusOK)
	}
}

func latestFetchErrorResponse(err error) (int, gin.H) {
	if errors.Is(err, db.ErrAppNameNotFound) || errors.Is(err, db.ErrChannelNotFound) {
		return http.StatusNotFound, gin.H{"error": "No matching data found for the provided parameters"}
	}
	if errors.Is(err, db.ErrAppIdentifierAmbiguous) {
		return http.StatusConflict, gin.H{"error": "App identifier matches multiple applications"}
	}
	return http.StatusInternalServerError, gin.H{"error": "failed to fetch latest version"}
}

// resolveDeviceID returns the client-supplied X-Device-ID header, or a stable
// pseudonymous identifier derived from the client IP and User-Agent when the
// header is absent. This lets telemetry aggregate for updater clients that do
// not send an explicit device id. Only the hash is persisted, never the raw
// IP/UA; note this is pseudonymisation, not anonymisation — the digest is
// reversible by brute force over the low-entropy input, so before any public
// production exposure this should be keyed (HMAC). See docs/task/SEC-008.md.
func resolveDeviceID(c *gin.Context) string {
	if id := strings.TrimSpace(c.GetHeader("X-Device-ID")); id != "" {
		return id
	}
	fingerprint := c.ClientIP() + "|" + c.Request.UserAgent()
	sum := sha256.Sum256([]byte(fingerprint))
	return "anon-" + hex.EncodeToString(sum[:8])
}

// cachedUpdateAvailable extracts the update_available flag from a cached
// response payload so cache hits can still record the latest/outdated split.
func cachedUpdateAvailable(response interface{}) bool {
	if m, ok := response.(map[string]interface{}); ok {
		if v, ok := m["update_available"].(bool); ok {
			return v
		}
	}
	return false
}

// trackClientTelemetry handles analytics collection for version check requests using Redis Sets
func trackClientTelemetry(ctx context.Context, rdb *redis.Client, params map[string]interface{}, hasUpdate bool, deviceID string) {
	if rdb == nil || deviceID == "" {
		logrus.Debug("Redis client is not set or deviceID is empty, skipping analytics collection")
		return
	}

	now := time.Now().UTC()
	dateStr := now.Format("2006-01-02")

	owner := params["owner"].(string)
	appName := params["app_name"].(string)
	version := params["version"].(string)
	platform := params["platform"].(string)
	arch := params["arch"].(string)
	channel := params["channel"].(string)

	logrus.Debugf("Collecting analytics for app: %s, owner: %s, date: %s", appName, owner, dateStr)

	baseKey := fmt.Sprintf("stats:%s:%s", owner, appName)

	requestsKey := fmt.Sprintf("%s:requests:%s", baseKey, dateStr)
	rdb.Incr(ctx, requestsKey)
	rdb.Expire(ctx, requestsKey, time.Hour*24*30)

	clientsKey := fmt.Sprintf("%s:unique_clients:%s", baseKey, dateStr)
	rdb.SAdd(ctx, clientsKey, deviceID)
	rdb.Expire(ctx, clientsKey, time.Hour*24*30)

	if channel != "" {
		channelKey := fmt.Sprintf("%s:channels:%s:%s", baseKey, dateStr, channel)
		rdb.SAdd(ctx, channelKey, deviceID)
		rdb.Expire(ctx, channelKey, time.Hour*24*30)
	}

	if platform != "" {
		platformKey := fmt.Sprintf("%s:platforms:%s:%s", baseKey, dateStr, platform)
		rdb.SAdd(ctx, platformKey, deviceID)
		rdb.Expire(ctx, platformKey, time.Hour*24*30)
	}

	if arch != "" {
		archKey := fmt.Sprintf("%s:architectures:%s:%s", baseKey, dateStr, arch)
		rdb.SAdd(ctx, archKey, deviceID)
		rdb.Expire(ctx, archKey, time.Hour*24*30)
	}

	if version != "" {
		// Get known versions for this app
		knownVersionsKey := fmt.Sprintf("%s:known_versions", baseKey)

		// Add current version to known versions set
		rdb.SAdd(ctx, knownVersionsKey, version)
		rdb.Expire(ctx, knownVersionsKey, time.Hour*24*30)

		// Get all known versions
		knownVersions, err := rdb.SMembers(ctx, knownVersionsKey).Result()
		if err != nil {
			logrus.Errorf("Error getting known versions: %v", err)
			return
		}

		// Remove device from all version sets for this day
		for _, knownVersion := range knownVersions {
			if knownVersion != version {
				oldVersionKey := fmt.Sprintf("%s:version_usage:%s:%s", baseKey, dateStr, knownVersion)
				rdb.SRem(ctx, oldVersionKey, deviceID)
				rdb.Expire(ctx, oldVersionKey, time.Hour*24*30)
			}
		}

		// Add device to current version set
		versionKey := fmt.Sprintf("%s:version_usage:%s:%s", baseKey, dateStr, version)
		rdb.SAdd(ctx, versionKey, deviceID)
		rdb.Expire(ctx, versionKey, time.Hour*24*30)

		// Track if client is using latest version
		if hasUpdate {
			// Remove from latest version set if present
			latestVersionKey := fmt.Sprintf("%s:clients_using_latest_version:%s", baseKey, dateStr)
			rdb.SRem(ctx, latestVersionKey, deviceID)
			rdb.Expire(ctx, latestVersionKey, time.Hour*24*30)

			// Add to outdated set
			outdatedKey := fmt.Sprintf("%s:clients_outdated:%s", baseKey, dateStr)
			rdb.SAdd(ctx, outdatedKey, deviceID)
			rdb.Expire(ctx, outdatedKey, time.Hour*24*30)
		} else {
			// Remove from outdated set if present
			outdatedKey := fmt.Sprintf("%s:clients_outdated:%s", baseKey, dateStr)
			rdb.SRem(ctx, outdatedKey, deviceID)
			rdb.Expire(ctx, outdatedKey, time.Hour*24*30)

			// Add to latest version set
			latestVersionKey := fmt.Sprintf("%s:clients_using_latest_version:%s", baseKey, dateStr)
			rdb.SAdd(ctx, latestVersionKey, deviceID)
			rdb.Expire(ctx, latestVersionKey, time.Hour*24*30)
		}
	}
}

func logStatsToRedis(ctx context.Context, rdb *redis.Client, params map[string]interface{}, hasUpdate bool, deviceID string) {
	trackClientTelemetry(ctx, rdb, params, hasUpdate, deviceID)
}
