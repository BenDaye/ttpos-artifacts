package build

import (
	"context"
	"faynoSync/server/utils"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// TriggerRequest is the self-serve build request. NOTE: there is deliberately no
// `env` field — the environment is a server-side constant (EnvTest) and must
// never be selectable by the caller (prod-bypass guard).
type TriggerRequest struct {
	Packages  []string `json:"packages" binding:"required,min=1"`
	Platforms []string `json:"platforms" binding:"required,min=1"`
	Branch    string   `json:"branch" binding:"required"`
}

// BuildTarget is one (package, faynosync app, platform) cell the dashboard polls
// for completion (a version containing "+b<correlation_id>").
type BuildTarget struct {
	Package  string `json:"package"`
	AppName  string `json:"app_name"`
	Platform string `json:"platform"`
}

// TriggerResponse is returned on a successful dispatch.
type TriggerResponse struct {
	CorrelationID string        `json:"correlation_id"`
	Env           string        `json:"env"` // always "test"
	BuildCount    int           `json:"build_count"`
	RunURL        string        `json:"run_url,omitempty"`
	Status        string        `json:"status"`
	Targets       []BuildTarget `json:"targets"`
}

// Trigger handles POST /build/trigger. It runs AFTER CheckPermission(Upload,
// Apps), so the caller already holds upload permission; this handler adds the
// app-scope, branch, env and cost guards that the upload middleware does not.
func Trigger(c *gin.Context, database *mongo.Database, dispatcher Dispatcher, limiter *TriggerLimiter, cfg Config) {
	var req TriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	username, err := utils.GetUsernameFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// 1. Validate branch (untrusted -> allowlist / SHA).
	if err := ValidateBranch(req.Branch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. Validate + normalize packages/platforms against the deployment's known
	//    set (fail-closed on unknowns; web excluded in Phase 1).
	packages, err := NormalizePackages(req.Packages)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	platforms, err := NormalizePlatforms(req.Platforms)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 3. Cost guardrail: leg count (billing unit) must be within the cap.
	maxLegs := cfg.MaxLegs
	if maxLegs <= 0 {
		maxLegs = DefaultMaxLegs
	}
	legs := LegCount(packages, platforms)
	if legs > maxLegs {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many builds requested", "requested": legs, "max": maxLegs})
		return
	}

	// 4. Phase-1 supports single-or-all per axis only (subset -> Track 2-b).
	sel, err := ResolveDispatch(packages, platforms)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 5. App-scope authorization (BLOCKER-3 fix): the upload path does not scope
	//    team_users, so enforce it here. Fail-safe: empty Allowed -> deny.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	adminUnrestricted, allowedAppIDs, err := resolvePrincipalScope(ctx, c, database, username)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	requestedAppIDs, err := resolveAppIDs(ctx, database, packages)
	if err != nil {
		// Unknown mapping / app -> fail closed.
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	if err := AuthorizeApps(adminUnrestricted, allowedAppIDs, requestedAppIDs); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// 6. Rate limit: global backstop + per-user cooldown.
	if !limiter.AllowGlobal() {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "global build rate exceeded, try again later"})
		return
	}
	if !limiter.AllowUser(username) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "you are triggering builds too fast, please wait"})
		return
	}

	// 7. Compute the buildable (app, platform) cells the dashboard will poll for
	//    the "+b<correlation_id>" completion marker. Do this BEFORE dispatching so
	//    a selection with no buildable cell is rejected without firing a workflow.
	//    Skip cells the workflow never builds (e.g. qds is android-only) so the
	//    dashboard does not spin an impossible cell to a false timeout.
	targets := make([]BuildTarget, 0, legs)
	for _, pkg := range packages {
		for _, plat := range platforms {
			if !PlatformAvailable(pkg, plat) {
				continue
			}
			appName, _ := AppNameForPackage(pkg)
			targets = append(targets, BuildTarget{
				Package:  pkg,
				AppName:  appName,
				Platform: plat,
			})
		}
	}
	if len(targets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no buildable (package, platform) combination for this selection"})
		return
	}

	// 8. env is a SERVER CONSTANT. Never from the request. base URLs are mapped
	//    from env, not passed through. The correlation_id is a plain UUID; the
	//    workflow (Track 2-a) forms the version suffix "+b<correlation_id>".
	correlationID := uuid.NewString()
	in := DispatchInput{
		Package:       sel.Package,
		Platform:      sel.Platform,
		Branch:        req.Branch,
		Env:           EnvTest,
		BaseURL:       cfg.BaseURLTest,
		BaseWSURL:     cfg.BaseWSURLTest,
		CorrelationID: correlationID,
	}

	runURL, err := dispatcher.Dispatch(ctx, in)
	if err != nil {
		logrus.Errorf("build trigger dispatch failed: user=%s branch=%s pkg=%s plat=%s corr=%s err=%v",
			username, req.Branch, sel.Package, sel.Platform, correlationID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to trigger build", "detail": err.Error()})
		return
	}

	// Observability (T-7): one structured line carrying every dimension + corr id.
	logrus.WithFields(logrus.Fields{
		"event":          "build_trigger",
		"user":           username,
		"packages":       packages,
		"platforms":      platforms,
		"branch":         req.Branch,
		"env":            EnvTest,
		"legs":           legs,
		"correlation_id": correlationID,
		"run_url":        runURL,
	}).Info("self-serve build triggered")

	c.JSON(http.StatusOK, TriggerResponse{
		CorrelationID: correlationID,
		Env:           EnvTest,
		BuildCount:    len(targets),
		RunURL:        runURL,
		Status:        "dispatched",
		Targets:       targets,
	})
}

// resolvePrincipalScope determines whether the caller is an admin (unrestricted)
// and, if not, their allowed app-id set. For API tokens the set is already in
// context (populated by CheckPermission). For team users it is read from their
// permission matrix. Fail-safe: an empty set for a non-admin means no scope.
func resolvePrincipalScope(ctx context.Context, c *gin.Context, database *mongo.Database, username string) (bool, []string, error) {
	if raw, ok := c.Get("is_api_token"); ok {
		if b, _ := raw.(bool); b {
			apps, _ := c.Get("allowed_apps")
			ids, _ := apps.([]string)
			return false, ids, nil
		}
	}

	// Admin?
	var admin bson.M
	if err := database.Collection("admins").FindOne(ctx, bson.M{"username": username}).Decode(&admin); err == nil {
		return true, nil, nil
	}

	// Team user: read allowed apps from the permission matrix.
	var teamUser struct {
		Permissions struct {
			Apps struct {
				Allowed []string `bson:"allowed"`
			} `bson:"apps"`
		} `bson:"permissions"`
	}
	if err := database.Collection("team_users").FindOne(ctx, bson.M{"username": username}).Decode(&teamUser); err != nil {
		return false, nil, err
	}
	return false, teamUser.Permissions.Apps.Allowed, nil
}

// resolveAppIDs maps requested packages -> FaynoSync app names (from the
// workflow-derived capabilities) -> app-meta _id hex strings. Any package
// without a mapping, or any app name not found in apps_meta, is a fail-closed
// error.
func resolveAppIDs(ctx context.Context, database *mongo.Database, packages []string) ([]string, error) {
	seen := make(map[string]struct{})
	ids := make([]string, 0, len(packages))
	for _, pkg := range packages {
		appName, ok := AppNameForPackage(pkg)
		if !ok {
			return nil, fmt.Errorf("package %q is not buildable", pkg)
		}
		var meta struct {
			ID primitive.ObjectID `bson:"_id"`
		}
		if err := database.Collection("apps_meta").FindOne(ctx, bson.M{"app_name": appName}).Decode(&meta); err != nil {
			return nil, fmt.Errorf("app %q not found", appName)
		}
		hex := meta.ID.Hex()
		if _, dup := seen[hex]; dup {
			continue
		}
		seen[hex] = struct{}{}
		ids = append(ids, hex)
	}
	return ids, nil
}
