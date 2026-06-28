// Package ownership centralizes how a request's owner namespace is resolved.
//
// FaynoSync is multi-tenant: every app, version and metadata document is scoped
// by an owner. This deployment, however, is single-owner — there is exactly one
// owner, so "which namespace" is a deployment-wide constant rather than a
// per-request derivation. Historically that derivation was duplicated across a
// dozen handlers with two slightly different semantics (team-aware in upload and
// telemetry, username-only in catalog/create/update/delete), which is what let
// artifacts land under the wrong owner and the /dl short link miss them.
//
// When DEPLOYMENT_OWNER is configured (single-owner mode), every owner-scoped
// read and write collapses to that one owner and the caller's identity governs
// only permission, never namespace. When it is unset, the historical
// multi-tenant resolution is preserved byte-for-byte so upstream behavior and
// the existing test suite are unaffected.
//
// All owner-scoped handlers consult this package instead of deriving the owner
// themselves, so the rule lives in exactly one place.
package ownership

import (
	"strings"

	"faynoSync/server/model"
	"faynoSync/server/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// state holds the resolved single-owner configuration. It is written once by
// Configure at startup and only read thereafter.
var state struct {
	enabled bool
	owner   string
}

// Configure sets the deployment-wide single owner. A non-empty owner enables
// single-owner mode; an empty owner leaves multi-tenant behavior intact. It is
// meant to be called once at startup, before the server accepts requests.
func Configure(owner string) {
	owner = strings.TrimSpace(owner)
	state.owner = owner
	state.enabled = owner != ""
}

// Enabled reports whether single-owner mode is active.
func Enabled() bool { return state.enabled }

// DeploymentOwner returns the configured single owner, or "" when single-owner
// mode is disabled.
func DeploymentOwner() string { return state.owner }

// OwnerOrUsername resolves the owner for handlers whose legacy behavior scopes
// data by the caller's own username (catalog, create, update, delete, reorder).
// Single-owner mode returns the deployment owner; otherwise it returns the
// caller's username exactly as before.
func OwnerOrUsername(c *gin.Context) (string, error) {
	if state.enabled {
		return state.owner, nil
	}
	return utils.GetUsernameFromContext(c)
}

// ResolveOwner resolves the owner for handlers whose legacy behavior is
// team-aware (upload, telemetry): a team member resolves to their admin's
// owner. Single-owner mode returns the deployment owner; otherwise it mirrors
// the historical username → team owner resolution exactly.
func ResolveOwner(c *gin.Context, database *mongo.Database) (string, error) {
	if state.enabled {
		return state.owner, nil
	}
	username, err := utils.GetUsernameFromContext(c)
	if err != nil {
		return "", err
	}
	var teamUser model.TeamUser
	if err := database.Collection("team_users").
		FindOne(c.Request.Context(), bson.M{"username": username}).
		Decode(&teamUser); err == nil {
		return teamUser.Owner, nil
	}
	return username, nil
}
