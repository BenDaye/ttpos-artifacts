package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	db "faynoSync/mongod"
	"faynoSync/server/handler/info"
	"faynoSync/server/model"
	"faynoSync/server/ownership"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

// shortLinkChannel is the channel the public /dl short links serve. This
// deployment publishes downloads from a single channel, so it is a constant
// rather than part of the URL — adding a channel dimension would change the
// published URL shape, which is a product decision, not a config knob.
const shortLinkChannel = "prod"

// shortLinkTarget is the platform triple a short link extension stands for.
type shortLinkTarget struct {
	Platform string
	Arch     string
	Package  string
}

// shortLinkTargets maps a download short link extension to its platform target.
//
// This table is platform knowledge ("an apk is an Android package"), not
// customer data, so it belongs in code — unlike the app-to-name mapping, which
// lives on each app as short_link. Arch is a default: this deployment ships one
// architecture per platform, and a short link has no room to negotiate one.
var shortLinkTargets = map[string]shortLinkTarget{
	"apk": {Platform: "android", Arch: "arm64", Package: "apk"},
	"exe": {Platform: "windows", Arch: "amd64", Package: "exe"},
	"dmg": {Platform: "macos", Arch: "arm64", Package: "dmg"},
}

// parseShortLinkTarget splits a /dl target such as "cashier.apk" into its short
// link name and platform target. The target is lower-cased so printed URLs are
// case-insensitive, and split on its last dot; a leading dot (empty name) or a
// trailing dot (empty extension) is rejected, as is an unknown extension.
func parseShortLinkTarget(target string) (string, shortLinkTarget, bool) {
	normalized := strings.ToLower(target)

	dotIndex := strings.LastIndex(normalized, ".")
	if dotIndex <= 0 || dotIndex == len(normalized)-1 {
		return "", shortLinkTarget{}, false
	}

	name := normalized[:dotIndex]
	extension := normalized[dotIndex+1:]

	resolved, ok := shortLinkTargets[extension]
	if !ok {
		return "", shortLinkTarget{}, false
	}

	return name, resolved, true
}

// shortLinkRepository is the narrow slice of the repository the /dl route
// needs, declared here (mirroring info.latestTargetRepository) so the route can
// be tested without standing up the whole AppRepository.
type shortLinkRepository interface {
	ResolveShortLinkApp(shortLink string, owner string, ctx context.Context) (string, error)
	FetchLatestVersionOfApp(appName, channel string, ctx context.Context, owner string) ([]*model.SpecificAppWithoutIDs, error)
}

// serveShortLatestDownload backs GET /dl/:target. See ShortLatestDownload.
func serveShortLatestDownload(c *gin.Context, repository shortLinkRepository, rdb *redis.Client, performanceMode bool) {
	// Uncacheable is the default: every early return below is a dead end that
	// must never be cached, and the success path overwrites both headers via
	// CacheRedirectHeadersContextKey.
	c.Header("Cache-Control", "no-store")
	c.Header("Cloudflare-CDN-Cache-Control", "no-store")

	name, target, ok := parseShortLinkTarget(c.Param("target"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported short latest download target"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	appName, err := repository.ResolveShortLinkApp(name, ownership.Owner(), ctx)
	if err != nil {
		// A name nobody claims is an unsupported target, not a missing
		// artifact — the same 400 the reverse proxy used to return for it.
		if errors.Is(err, db.ErrAppNameNotFound) || errors.Is(err, db.ErrAppIdentifierAmbiguous) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported short latest download target"})
			return
		}
		logrus.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve short latest download target"})
		return
	}

	setLatestQuery(c, map[string]string{
		"app_name": appName,
		"channel":  shortLinkChannel,
		"platform": target.Platform,
		"arch":     target.Arch,
		"package":  target.Package,
		"resolve":  info.ResolveArtifactLatest,
	})
	c.Set(info.CacheRedirectHeadersContextKey, true)
	info.FetchLatestVersionOfApp(c, repository, rdb, performanceMode)
}
