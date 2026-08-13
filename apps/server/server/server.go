package server

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	db "faynoSync/mongod"
	"faynoSync/redisdb"
	"faynoSync/server/handler"
	"faynoSync/server/ownership"
	"faynoSync/server/tuf"
	"faynoSync/server/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/time/rate"
)

const (
	maxMultipartMemoryBytes = 100 << 20
	defaultServerPort       = "9000"
	loginRateInterval       = 6 * time.Second
	loginRateBurst          = 10
	signupRateInterval      = 20 * time.Second
	signupRateBurst         = 3
)

func StartServer(config *viper.Viper, flags map[string]interface{}) {
	jwtSecret := config.GetString("JWT_SECRET")
	if jwtSecret == "" || len(jwtSecret) < 32 {
		logrus.Fatal("JWT_SECRET must be configured and at least 32 characters long")
	}

	mongoUrl := config.GetString("MONGODB_URL")

	router := gin.Default()
	router.MaxMultipartMemory = maxMultipartMemoryBytes

	client, configDB := db.ConnectToDatabase(mongoUrl, flags)

	repo := db.NewAppRepository(&configDB, client)
	mongoDatabase := client.Database(configDB.Database)

	// Single-owner is the only supported mode. DEPLOYMENT_OWNER pins the one owner
	// namespace and is mandatory once the deployment has an admin; caller identity
	// governs permission (RBAC) only, never namespace. The sole exception is
	// first-boot bootstrap — an empty admins collection — where an unset
	// DEPLOYMENT_OWNER is allowed so the first admin can be created via /signup
	// before the owner is pinned. Any bad/absent value fails closed at boot: a
	// dead pod is visible and recoverable; silently scoping data under the wrong
	// owner is not. (The container CMD is `faynoSync --migration`, i.e. migrate
	// then serve, so this guard runs on every normal boot.)
	deploymentOwner := strings.TrimSpace(config.GetString("DEPLOYMENT_OWNER"))
	if deploymentOwner == "" {
		adminCtx, cancelAdmin := context.WithTimeout(context.Background(), 30*time.Second)
		adminCount, err := mongoDatabase.Collection("admins").CountDocuments(adminCtx, bson.M{})
		cancelAdmin()
		if err != nil {
			logrus.Fatalf("failed to check the admins collection while resolving DEPLOYMENT_OWNER: %v", err)
		}
		if adminCount > 0 {
			logrus.Fatalf("DEPLOYMENT_OWNER is required: this deployment already has an admin, so the single owner namespace must be pinned. Set DEPLOYMENT_OWNER to the admin username and restart. (First boot only: with no admin yet, start without it, create the admin via /signup, then set it and restart.)")
		}
		logrus.Warnln("DEPLOYMENT_OWNER is unset and no admin exists yet: booting in bootstrap mode. Create the first admin via /signup, then set DEPLOYMENT_OWNER and restart.")
	} else {
		ownerCtx, cancelOwner := context.WithTimeout(context.Background(), 30*time.Second)
		err := mongoDatabase.Collection("admins").FindOne(ownerCtx, bson.M{"username": deploymentOwner}).Err()
		cancelOwner()
		if errors.Is(err, mongo.ErrNoDocuments) {
			logrus.Fatalf("DEPLOYMENT_OWNER %q is not an existing admin account. Bootstrap order: start once without DEPLOYMENT_OWNER, create the admin via /signup, then set DEPLOYMENT_OWNER and restart.", deploymentOwner)
		} else if err != nil {
			logrus.Fatalf("failed to verify DEPLOYMENT_OWNER %q against the admins collection: %v", deploymentOwner, err)
		}
		if seedOwner := strings.TrimSpace(config.GetString("SEED_OWNER")); seedOwner != "" {
			logrus.Warnln("SEED_OWNER is deprecated; DEPLOYMENT_OWNER supersedes it. Keep them equal or drop SEED_OWNER.")
			if seedOwner != deploymentOwner {
				logrus.Fatalf("DEPLOYMENT_OWNER (%q) and SEED_OWNER (%q) disagree; they must name the same owner", deploymentOwner, seedOwner)
			}
		}
	}
	ownership.Configure(deploymentOwner)

	// Run seed if requested via -seed flag. Seed under the deployment owner;
	// during first-boot bootstrap (owner not yet pinned) fall back to SEED_OWNER.
	if seedFlag, ok := flags["seed"].(bool); ok && seedFlag {
		seedOwner := config.GetString("SEED_OWNER")
		if deploymentOwner != "" {
			seedOwner = deploymentOwner
		}
		db.RunSeed(repo, mongoDatabase, context.Background(), seedOwner)
	}

	// Initialize Redis client
	var redisClient *redis.Client

	if config.GetBool("PERFORMANCE_MODE") || config.GetBool("ENABLE_TELEMETRY") {
		logrus.Infoln("Redis connection is required. Connecting to Redis.")
		redisConfig := redisdb.RedisConfig{
			Addr:     config.GetString("REDIS_HOST") + ":" + config.GetString("REDIS_PORT"),
			Password: config.GetString("REDIS_PASSWORD"),
			DB:       config.GetInt("REDIS_DB"),
		}
		var err error
		redisClient, err = redisdb.ConnectToRedis(redisConfig)
		if err != nil {
			logrus.Fatalf("Failed to connect to Redis: %v", err)
		}
	}

	enablePrivateDownload := config.GetBool("ENABLE_PRIVATE_APP_DOWNLOADING")
	apiKey := config.GetString("API_KEY")

	handler := handler.NewAppHandler(client, repo, mongoDatabase, redisClient, config.GetBool("PERFORMANCE_MODE"), apiKey, enablePrivateDownload)
	// Add authentication middleware to required paths
	authMiddleware := utils.AuthMiddleware(mongoDatabase)

	router.GET("/health", handler.HealthCheck)

	allowedCORS := config.GetString("ALLOWED_CORS")
	allowedOrigins := strings.Split(allowedCORS, ",")

	router.Use(corsMiddleware(allowedOrigins))

	// Add squirrel_windows updater compatibility
	router.GET("/update/:owner/:app/:channel/:platform/:arch/:version/RELEASES", handler.SquirrelReleases)

	router.GET("/checkVersion", handler.FindLatestVersion)
	router.GET("/apps/latest", handler.FetchLatestVersionOfApp)
	// 公开下载短链。映射由每个 app 的 short_link 字段决定,不再是反代里的静态表。
	router.GET("/dl/:target", handler.ShortLatestDownload)
	loginLimiter := utils.NewIPRateLimiter(rate.Every(loginRateInterval), loginRateBurst)
	signupLimiter := utils.NewIPRateLimiter(rate.Every(signupRateInterval), signupRateBurst)
	router.POST("/signup", utils.RateLimitMiddleware(signupLimiter), handler.SignUp)
	router.POST("/login", utils.RateLimitMiddleware(loginLimiter), handler.Login)

	if enablePrivateDownload {
		router.GET("/download", handler.DownloadArtifact)
		router.Use(authMiddleware)
	} else {
		router.Use(authMiddleware)
		router.GET("/download", utils.CheckPermission(utils.PermissionDownload, utils.ResourceApps, mongoDatabase), handler.DownloadArtifact)
	}

	// App routes
	// router.GET("/", handler.GetAllApps)
	router.GET("/whoami", handler.Whoami)
	router.GET("/upload/check", utils.CheckPermission(utils.PermissionUpload, utils.ResourceApps, mongoDatabase), handler.CheckUploadAvailable)
	router.POST("/upload", utils.CheckPermission(utils.PermissionUpload, utils.ResourceApps, mongoDatabase), handler.UploadApp)
	router.POST("/apps/update", utils.CheckPermission(utils.PermissionEdit, utils.ResourceApps, mongoDatabase), handler.UpdateSpecificApp)
	router.POST("/app/update", utils.CheckPermission(utils.PermissionEdit, utils.ResourceApps, mongoDatabase), handler.UpdateApp)
	router.DELETE("/apps/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourceApps, mongoDatabase), handler.DeleteSpecificVersionOfApp)
	router.GET("/search", handler.GetAppByName)

	// Channel routes
	router.POST("/channel/create", utils.CheckPermission(utils.PermissionCreate, utils.ResourceChannels, mongoDatabase), handler.CreateChannel)
	router.GET("/channel/list", handler.ListChannels)
	router.POST("/channel/reorder", utils.CheckPermission(utils.PermissionEdit, utils.ResourceChannels, mongoDatabase), handler.ReorderChannels)
	router.DELETE("/channel/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourceChannels, mongoDatabase), handler.DeleteChannel)
	router.POST("/channel/update", utils.CheckPermission(utils.PermissionEdit, utils.ResourceChannels, mongoDatabase), handler.UpdateChannel)

	// Platform routes
	router.POST("/platform/create", utils.CheckPermission(utils.PermissionCreate, utils.ResourcePlatforms, mongoDatabase), handler.CreatePlatform)
	router.GET("/platform/list", handler.ListPlatforms)
	router.POST("/platform/reorder", utils.CheckPermission(utils.PermissionEdit, utils.ResourcePlatforms, mongoDatabase), handler.ReorderPlatforms)
	router.DELETE("/platform/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourcePlatforms, mongoDatabase), handler.DeletePlatform)
	router.POST("/platform/update", utils.CheckPermission(utils.PermissionEdit, utils.ResourcePlatforms, mongoDatabase), handler.UpdatePlatform)

	// Arch routes
	router.POST("/arch/create", utils.CheckPermission(utils.PermissionCreate, utils.ResourceArchs, mongoDatabase), handler.CreateArch)
	router.GET("/arch/list", handler.ListArchs)
	router.POST("/arch/reorder", utils.CheckPermission(utils.PermissionEdit, utils.ResourceArchs, mongoDatabase), handler.ReorderArchs)
	router.DELETE("/arch/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourceArchs, mongoDatabase), handler.DeleteArch)
	router.POST("/arch/update", utils.CheckPermission(utils.PermissionEdit, utils.ResourceArchs, mongoDatabase), handler.UpdateArch)

	// App management routes
	router.POST("/app/create", utils.CheckPermission(utils.PermissionCreate, utils.ResourceApps, mongoDatabase), handler.CreateApp)
	router.GET("/app/list", handler.ListApps)
	router.POST("/app/reorder", utils.CheckPermission(utils.PermissionEdit, utils.ResourceApps, mongoDatabase), handler.ReorderApps)
	router.DELETE("/app/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourceApps, mongoDatabase), handler.DeleteApp)
	router.POST("/artifact/delete", utils.CheckPermission(utils.PermissionDelete, utils.ResourceApps, mongoDatabase), handler.DeleteSpecificArtifactOfApp)

	// Team user management - only admins can create team users
	router.POST("/user/create", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.CreateTeamUser)
	router.POST("/user/update", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.UpdateTeamUser)
	router.GET("/users/list", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.ListTeamUsers)
	router.DELETE("/user/delete", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.DeleteTeamUser)
	router.POST("/admin/update", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.UpdateAdmin)

	// Telemetry endpoint
	router.GET("/telemetry", authMiddleware, telemetryMiddleware(config), handler.GetTelemetry)

	// Token routes
	router.POST("/token/create", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.CreateToken)
	router.GET("/token/list", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.ListTokens)
	router.DELETE("/token/delete", authMiddleware, utils.AdminOnlyMiddleware(mongoDatabase), handler.DeleteToken)

	if config.GetBool("TUF_ENABLED") {
		tuf.SetupRoutes(router, authMiddleware, mongoDatabase, redisClient, repo)
	}

	// get the port from the configuration file
	port := config.GetString("PORT")
	if port == "" {
		port = defaultServerPort
	}
	router.Run(":" + port)
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if allowedOrigin == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func telemetryMiddleware(config *viper.Viper) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.GetBool("ENABLE_TELEMETRY") {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Telemetry is not enabled on this instance",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
