package handler

import (
	db "faynoSync/mongod"
	"faynoSync/server/handler/catalog"
	"faynoSync/server/handler/create"
	"faynoSync/server/handler/delete"
	"faynoSync/server/handler/download"
	"faynoSync/server/handler/info"
	"faynoSync/server/handler/shortlink"
	"faynoSync/server/handler/sign"
	"faynoSync/server/handler/team"
	"faynoSync/server/handler/token"
	"faynoSync/server/handler/update"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"go.mongodb.org/mongo-driver/mongo"
)

type AppHandler interface {
	// GetAllApps(*gin.Context)
	GetAppByName(*gin.Context)
	DeleteSpecificVersionOfApp(*gin.Context)
	DeleteApp(*gin.Context)
	DeleteChannel(*gin.Context)
	DeletePlatform(*gin.Context)
	DeleteArch(*gin.Context)
	UploadApp(*gin.Context)
	UpdateSpecificApp(*gin.Context)
	HealthCheck(*gin.Context)
	FindLatestVersion(*gin.Context)
	FetchLatestVersionOfApp(*gin.Context)
	Login(*gin.Context)
	CreateChannel(*gin.Context)
	ListChannels(*gin.Context)
	CreatePlatform(*gin.Context)
	ListPlatforms(*gin.Context)
	CreateArch(*gin.Context)
	ListArchs(*gin.Context)
	CreateApp(*gin.Context)
	ListApps(*gin.Context)
	ReorderChannels(*gin.Context)
	ReorderPlatforms(*gin.Context)
	ReorderArchs(*gin.Context)
	ReorderApps(*gin.Context)
	SignUp(*gin.Context)
	UpdateApp(*gin.Context)
	UpdateChannel(*gin.Context)
	UpdatePlatform(*gin.Context)
	UpdateArch(*gin.Context)
	DeleteSpecificArtifactOfApp(*gin.Context)
	DownloadArtifact(*gin.Context)
	CreateTeamUser(*gin.Context)
	UpdateTeamUser(*gin.Context)
	ListTeamUsers(*gin.Context)
	DeleteTeamUser(*gin.Context)
	Whoami(*gin.Context)
	UpdateAdmin(*gin.Context)
	GetTelemetry(*gin.Context)
	SquirrelReleases(*gin.Context)
	ShortLatestDownload(*gin.Context)
	CreateToken(*gin.Context)
	ListTokens(*gin.Context)
	DeleteToken(*gin.Context)
}

type appHandler struct {
	client                *mongo.Client
	repository            db.AppRepository
	database              *mongo.Database
	redisClient           *redis.Client
	performanceMode       bool
	apiKey                string
	enablePrivateDownload bool
	shortLatest           *shortlink.Catalog
}

// NewAppHandler builds the gin app handler. shortLatest is variadic only to stay
// backward compatible with the many existing callers that predate the short-link
// catalog; at most one catalog is honored (the first). Passing none — or a nil
// catalog — leaves the /dl short-download feature disabled.
func NewAppHandler(client *mongo.Client, repo db.AppRepository, db *mongo.Database, redisClient *redis.Client, performanceMode bool, apiKey string, enablePrivateDownload bool, shortLatest ...*shortlink.Catalog) AppHandler {
	var catalog *shortlink.Catalog
	if len(shortLatest) > 0 {
		catalog = shortLatest[0]
	}
	return &appHandler{client: client, repository: repo, database: db, redisClient: redisClient, performanceMode: performanceMode, apiKey: apiKey, enablePrivateDownload: enablePrivateDownload, shortLatest: catalog}
}

func (ch *appHandler) HealthCheck(c *gin.Context) {
	// Call the HealthCheck function from the info package
	info.HealthCheck(c, ch.client, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) FindLatestVersion(c *gin.Context) {
	// Call the FindLatestVersion function from the info package
	info.FindLatestVersion(c, ch.repository, ch.database, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) FetchLatestVersionOfApp(c *gin.Context) {
	// Call the FetchLatestVersionOfApp function from the info package
	info.FetchLatestVersionOfApp(c, ch.repository, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) GetAppByName(c *gin.Context) {
	// Call the GetAppByName function from the catalog package
	catalog.GetAppByName(c, ch.repository)
}

// func (ch *appHandler) GetAllApps(c *gin.Context) {
// 	// Call the GetAllApps function from the catalog package
// 	catalog.GetAllApps(c, ch.repository)
// }

func (ch *appHandler) ListChannels(c *gin.Context) {
	// Call the ListChannels function from the catalog package
	catalog.ListChannels(c, ch.repository)
}

func (ch *appHandler) ListPlatforms(c *gin.Context) {
	// Call the ListPlatforms function from the catalog package
	catalog.ListPlatforms(c, ch.repository)
}

func (ch *appHandler) ListArchs(c *gin.Context) {
	// Call the ListArchs function from the catalog package
	catalog.ListArchs(c, ch.repository)
}
func (ch *appHandler) ListApps(c *gin.Context) {
	// Call the ListApps function from the catalog package
	catalog.ListApps(c, ch.repository)
}

func (ch *appHandler) ReorderChannels(c *gin.Context) {
	// Call the ReorderChannels function from the catalog package
	catalog.ReorderChannels(c, ch.repository)
}

func (ch *appHandler) ReorderPlatforms(c *gin.Context) {
	// Call the ReorderPlatforms function from the catalog package
	catalog.ReorderPlatforms(c, ch.repository)
}

func (ch *appHandler) ReorderArchs(c *gin.Context) {
	// Call the ReorderArchs function from the catalog package
	catalog.ReorderArchs(c, ch.repository)
}

func (ch *appHandler) ReorderApps(c *gin.Context) {
	// Call the ReorderApps function from the catalog package
	catalog.ReorderApps(c, ch.repository)
}
func (ch *appHandler) CreateChannel(c *gin.Context) {
	// Call the CreateChannel function from the create package
	create.CreateChannel(c, ch.repository)
}

func (ch *appHandler) CreatePlatform(c *gin.Context) {
	// Call the CreatePlatform function from the create package
	create.CreatePlatform(c, ch.repository)
}
func (ch *appHandler) CreateArch(c *gin.Context) {
	// Call the CreateArch function from the create package
	create.CreateArch(c, ch.repository)
}

func (ch *appHandler) CreateApp(c *gin.Context) {
	// Call the CreateApp function from the create package
	create.CreateApp(c, ch.repository)
}

func (ch *appHandler) UploadApp(c *gin.Context) {
	// Call the UploadApp function from the create package
	create.UploadApp(c, ch.repository, ch.database, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) UpdateSpecificApp(c *gin.Context) {
	// Call the UpdateSpecificApp function from the create package
	update.UpdateSpecificApp(c, ch.repository, ch.database, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) Login(c *gin.Context) {
	// Call the Login function from the sign package
	sign.Login(c, ch.database)
}

func (ch *appHandler) SignUp(c *gin.Context) {
	// Call the SignUp function from the sign package
	sign.SignUp(c, ch.database, ch.client, ch.apiKey)
}

func (ch *appHandler) DeleteApp(c *gin.Context) {
	// Call the DeleteApp function from the delete package
	delete.DeleteApp(c, ch.repository)
}

func (ch *appHandler) DeleteSpecificVersionOfApp(c *gin.Context) {
	// Call the DeleteSpecificVersionOfApp function from the delete package
	delete.DeleteSpecificVersionOfApp(c, ch.repository, ch.database, ch.redisClient)
}

func (ch *appHandler) DeleteChannel(c *gin.Context) {
	// Call the DeleteChannel function from the delete package
	delete.DeleteChannel(c, ch.repository)
}

func (ch *appHandler) DeletePlatform(c *gin.Context) {
	// Call the DeletePlatform function from the delete package
	delete.DeletePlatform(c, ch.repository)
}

func (ch *appHandler) DeleteArch(c *gin.Context) {
	// Call the DeleteArch function from the delete package
	delete.DeleteArch(c, ch.repository)
}

func (ch *appHandler) UpdateApp(c *gin.Context) {
	// Call the UpdateApp function from the create package
	update.UpdateApp(c, ch.repository)
}

func (ch *appHandler) UpdateChannel(c *gin.Context) {
	// Call the UpdateChannel function from the create package
	update.UpdateChannel(c, ch.repository)
}

func (ch *appHandler) UpdatePlatform(c *gin.Context) {
	// Call the UpdatePlatform function from the create package
	update.UpdatePlatform(c, ch.repository)
}

func (ch *appHandler) UpdateArch(c *gin.Context) {
	// Call the UpdateArch function from the create package
	update.UpdateArch(c, ch.repository)
}
func (ch *appHandler) DeleteSpecificArtifactOfApp(c *gin.Context) {
	// Call the DeleteSpecificArtifactOfApp function from the delete package
	delete.DeleteSpecificArtifactOfApp(c, ch.repository, ch.database, ch.redisClient)
}

func (ch *appHandler) DownloadArtifact(c *gin.Context) {
	// Call the DownloadArtifact function from the download package
	download.DownloadArtifact(c, ch.enablePrivateDownload)
}

func (ch *appHandler) CreateTeamUser(c *gin.Context) {
	team.CreateTeamUser(c, ch.database)
}

func (ch *appHandler) UpdateTeamUser(c *gin.Context) {
	team.UpdateTeamUser(c, ch.database)
}

func (ch *appHandler) ListTeamUsers(c *gin.Context) {
	team.ListTeamUsers(c, ch.database)
}

func (ch *appHandler) DeleteTeamUser(c *gin.Context) {
	team.DeleteTeamUser(c, ch.database)
}

func (ch *appHandler) Whoami(c *gin.Context) {
	team.Whoami(c, ch.database)
}

func (ch *appHandler) UpdateAdmin(c *gin.Context) {
	update.UpdateAdmin(c, ch.database)
}

func (ch *appHandler) GetTelemetry(c *gin.Context) {
	info.GetTelemetry(c, ch.redisClient, ch.database)
}

func (ch *appHandler) SquirrelReleases(c *gin.Context) {
	setLatestQuery(c, map[string]string{
		"owner":    c.Param("owner"),
		"app_name": c.Param("app"),
		"channel":  c.Param("channel"),
		"platform": c.Param("platform"),
		"arch":     c.Param("arch"),
		"version":  c.Param("version"),
		"updater":  "squirrel_windows",
	})

	info.FindLatestVersion(c, ch.repository, ch.database, ch.redisClient, ch.performanceMode)
}

// setLatestQuery rewrites the request query string from path-derived values so a
// path-style route can delegate to the query-based info.* latest handlers. It is
// shared by SquirrelReleases and ShortLatestDownload.
func setLatestQuery(c *gin.Context, values map[string]string) {
	q := c.Request.URL.Query()
	for key, value := range values {
		q.Set(key, value)
	}
	c.Request.URL.RawQuery = q.Encode()
}

// ShortLatestDownload exposes compact public aliases for website and QR links.
// The alias / target catalog is loaded from configuration at startup; the route
// is only registered when a catalog is configured, so a nil catalog here is
// purely defensive.
//
//	GET /dl/:target
func (ch *appHandler) ShortLatestDownload(c *gin.Context) {
	if ch.shortLatest == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "short latest download is not configured"})
		return
	}

	appName, target, ok := ch.shortLatest.Resolve(c.Param("target"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported short latest download target"})
		return
	}

	setLatestQuery(c, map[string]string{
		"owner":    ch.shortLatest.Owner,
		"app_name": appName,
		"channel":  ch.shortLatest.DefaultChannel,
		"platform": target.Platform,
		"arch":     target.Arch,
		"package":  target.Package,
	})
	c.Set(info.CacheRedirectHeadersContextKey, true)
	info.FetchLatestVersionOfApp(c, ch.repository, ch.redisClient, ch.performanceMode)
}

func (ch *appHandler) CreateToken(c *gin.Context) {
	token.CreateToken(c, ch.database)
}

func (ch *appHandler) ListTokens(c *gin.Context) {
	token.ListTokens(c, ch.database)
}

func (ch *appHandler) DeleteToken(c *gin.Context) {
	token.DeleteToken(c, ch.database)
}
