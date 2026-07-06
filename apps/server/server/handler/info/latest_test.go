package info

import (
	"context"
	"encoding/json"
	db "faynoSync/mongod"
	"faynoSync/server/model"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type latestRepoStub struct {
	apps []*model.SpecificAppWithoutIDs
	err  error
}

func (r latestRepoStub) FetchLatestVersionOfApp(string, string, context.Context, string) ([]*model.SpecificAppWithoutIDs, error) {
	return r.apps, r.err
}

func TestFetchLatestVersionOfAppRedirectsSinglePackage(t *testing.T) {
	w := performLatestRequest(t, latestRepoStub{apps: latestAppFixture()}, "/apps/latest?app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=apk&owner=ttpos")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/ttpos.apk", w.Header().Get("Location"))
}

func TestFetchLatestVersionOfAppAddsCacheHeadersForMarkedRedirect(t *testing.T) {
	w := performLatestRequestWithCacheHeaders(t, latestRepoStub{apps: latestAppFixture()}, "/apps/latest?app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=apk&owner=ttpos")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/ttpos.apk", w.Header().Get("Location"))
	assert.Equal(t, "public, max-age=300", w.Header().Get("Cloudflare-CDN-Cache-Control"))
	assert.Equal(t, "no-cache", w.Header().Get("Cache-Control"))
}

func TestFetchLatestVersionOfAppReturnsJSONWhenMultiplePackagesMatch(t *testing.T) {
	w := performLatestRequest(t, latestRepoStub{apps: latestAppFixture()}, "/apps/latest?app_name=TTPOS&channel=prod&platform=android&arch=arm64&owner=ttpos")

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]map[string]map[string]map[string]map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &body)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, "https://downloads.example.com/ttpos.apk", body["prod"]["android"]["arm64"]["apk"]["url"])
	assert.Equal(t, "https://downloads.example.com/ttpos.zip", body["prod"]["android"]["arm64"]["zip"]["url"])
}

func TestFetchLatestVersionOfAppMapsNotFoundTo404(t *testing.T) {
	w := performLatestRequest(t, latestRepoStub{err: db.ErrAppNameNotFound}, "/apps/latest?app_name=missing&channel=prod&platform=android&arch=arm64&package=apk&owner=ttpos")

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "No matching data found")
}

func TestFetchLatestVersionOfAppMapsAmbiguousIdentifierTo409(t *testing.T) {
	w := performLatestRequest(t, latestRepoStub{err: db.ErrAppIdentifierAmbiguous}, "/apps/latest?app_name=ttpos_kitchen&channel=prod&platform=android&arch=arm64&package=apk&owner=ttpos")

	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "matches multiple applications")
}

func TestFetchLatestVersionOfAppAcceptsSnakeIdentifierResult(t *testing.T) {
	w := performLatestRequest(t, latestRepoStub{apps: latestKitchenFixture()}, "/apps/latest?app_name=ttpos_kitchen&channel=prod&platform=android&arch=arm64&package=apk&owner=ttpos")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/ttpos-kitchen.apk", w.Header().Get("Location"))
}

func TestCreateCacheKeyIncludesOwner(t *testing.T) {
	cacheKey := CreateCacheKey(map[string]interface{}{
		"owner":    "ttpos",
		"app_name": "TTPOS",
		"version":  "",
		"channel":  "prod",
		"platform": "android",
		"arch":     "arm64",
		"package":  "apk",
	})

	assert.Equal(t, "owner=ttpos&app_name=TTPOS&version=&channel=prod&platform=android&arch=arm64&package=apk", cacheKey)
}

func performLatestRequest(t *testing.T, repo latestAppRepository, target string) *httptest.ResponseRecorder {
	t.Helper()
	return performLatestRequestWithOptions(t, repo, target, false)
}

func performLatestRequestWithCacheHeaders(t *testing.T, repo latestAppRepository, target string) *httptest.ResponseRecorder {
	t.Helper()
	return performLatestRequestWithOptions(t, repo, target, true)
}

func performLatestRequestWithOptions(t *testing.T, repo latestAppRepository, target string, cacheHeaders bool) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/apps/latest", func(c *gin.Context) {
		if cacheHeaders {
			c.Set(CacheRedirectHeadersContextKey, true)
		}
		FetchLatestVersionOfApp(c, repo, nil, false)
	})

	req, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func latestAppFixture() []*model.SpecificAppWithoutIDs {
	return []*model.SpecificAppWithoutIDs{
		{
			AppName:   "TTPOS",
			Version:   "1.2.3",
			Channel:   "prod",
			Published: true,
			Artifacts: []model.SpecificArtifactsWithoutIDs{
				{
					Link:     "https://downloads.example.com/ttpos.apk",
					Platform: "android",
					Arch:     "arm64",
					Package:  ".apk",
				},
				{
					Link:     "https://downloads.example.com/ttpos.zip",
					Platform: "android",
					Arch:     "arm64",
					Package:  ".zip",
				},
			},
		},
	}
}

func latestKitchenFixture() []*model.SpecificAppWithoutIDs {
	return []*model.SpecificAppWithoutIDs{
		{
			AppName:   "TTPOS Kitchen",
			Version:   "1.2.3",
			Channel:   "prod",
			Published: true,
			Artifacts: []model.SpecificArtifactsWithoutIDs{
				{
					Link:     "https://downloads.example.com/ttpos-kitchen.apk",
					Platform: "android",
					Arch:     "arm64",
					Package:  ".apk",
				},
			},
		},
	}
}

// latestTargetRepoStub 同时实现 latestAppRepository 与 latestTargetRepository，
// 分别返回不同版本的 fixture，用于断言选路正确。
type latestTargetRepoStub struct {
	legacyApps []*model.SpecificAppWithoutIDs
	targetApps []*model.SpecificAppWithoutIDs
	targetErr  error

	legacyCalled bool
	targetCalled bool
	gotPackage   string
}

func (r *latestTargetRepoStub) FetchLatestVersionOfApp(string, string, context.Context, string) ([]*model.SpecificAppWithoutIDs, error) {
	r.legacyCalled = true
	return r.legacyApps, nil
}

func (r *latestTargetRepoStub) FetchLatestVersionOfAppForTarget(_, _, _, _, pkg string, _ context.Context, _ string) ([]*model.SpecificAppWithoutIDs, error) {
	r.targetCalled = true
	r.gotPackage = pkg
	return r.targetApps, r.targetErr
}

// fallbackFixtures 模拟「最新版 1.2.3 缺 apk、前序版 1.2.2 含 apk」：
// legacy 数据源返回缺 apk 的最新版，target 数据源返回含 apk 的前序版。
func fallbackFixtures() (legacy, target []*model.SpecificAppWithoutIDs) {
	legacy = []*model.SpecificAppWithoutIDs{
		{
			AppName: "TTPOS Shop", Version: "1.2.3", Channel: "prod", Published: true,
			Artifacts: []model.SpecificArtifactsWithoutIDs{
				{Link: "https://downloads.example.com/shop-1.2.3.dmg", Platform: "macos", Arch: "arm64", Package: ".dmg"},
			},
		},
	}
	target = []*model.SpecificAppWithoutIDs{
		{
			AppName: "TTPOS Shop", Version: "1.2.2", Channel: "prod", Published: true,
			Artifacts: []model.SpecificArtifactsWithoutIDs{
				{Link: "https://downloads.example.com/shop-1.2.2.apk", Platform: "android", Arch: "arm64", Package: ".apk"},
			},
		},
	}
	return legacy, target
}

func TestFetchLatestVersionOfAppArtifactLatestFallsBackToOlderVersion(t *testing.T) {
	legacy, target := fallbackFixtures()
	repo := &latestTargetRepoStub{legacyApps: legacy, targetApps: target}

	// query 传裸 apk、fixture 库内形态 .apk：端到端 302 证明选版层与下游
	// TrimPrefix 过滤互补口径对齐（Critic Major 1/2 的断言要求）。
	w := performLatestRequestWithCacheHeaders(t, repo, "/apps/latest?app_name=ttpos_shop&channel=prod&platform=android&arch=arm64&package=apk&resolve=artifact-latest")

	assert.True(t, repo.targetCalled, "artifact-latest must route to FetchLatestVersionOfAppForTarget")
	assert.False(t, repo.legacyCalled, "legacy repository method must not be called")
	assert.Equal(t, "apk", repo.gotPackage, "raw query package is passed through; normalization happens in mongod")
	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/shop-1.2.2.apk", w.Header().Get("Location"))
	assert.Equal(t, "public, max-age=300", w.Header().Get("Cloudflare-CDN-Cache-Control"))
	assert.Equal(t, "no-cache", w.Header().Get("Cache-Control"))
}

func TestFetchLatestVersionOfAppArtifactLatestReturns404WhenNoVersionShipsArtifact(t *testing.T) {
	legacy, _ := fallbackFixtures()
	repo := &latestTargetRepoStub{legacyApps: legacy, targetApps: nil}

	w := performLatestRequest(t, repo, "/apps/latest?app_name=ttpos_shop&channel=prod&platform=android&arch=arm64&package=apk&resolve=artifact-latest")

	assert.True(t, repo.targetCalled)
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "No matching data found")
}

func TestFetchLatestVersionOfAppArtifactLatestMapsTargetNotFoundTo404(t *testing.T) {
	repo := &latestTargetRepoStub{targetErr: db.ErrTargetNotFound}

	w := performLatestRequest(t, repo, "/apps/latest?app_name=ttpos_shop&channel=prod&platform=zzz&arch=arm64&package=apk&resolve=artifact-latest")

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "No matching data found")
}

func TestFetchLatestVersionOfAppWithoutResolveKeepsLegacyPath(t *testing.T) {
	legacy, target := fallbackFixtures()
	repo := &latestTargetRepoStub{legacyApps: legacy, targetApps: target}

	w := performLatestRequest(t, repo, "/apps/latest?app_name=ttpos_shop&channel=prod&platform=macos&arch=arm64&package=dmg")

	assert.True(t, repo.legacyCalled, "no resolve param must keep the legacy repository call")
	assert.False(t, repo.targetCalled)
	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/shop-1.2.3.dmg", w.Header().Get("Location"))
}

func TestFetchLatestVersionOfAppResolveWithoutFullTripleKeepsLegacyPath(t *testing.T) {
	legacy, target := fallbackFixtures()
	repo := &latestTargetRepoStub{legacyApps: legacy, targetApps: target}

	// 缺 package：opt-in 无效，静默走旧语义。
	w := performLatestRequest(t, repo, "/apps/latest?app_name=ttpos_shop&channel=prod&platform=macos&arch=arm64&resolve=artifact-latest")

	assert.True(t, repo.legacyCalled)
	assert.False(t, repo.targetCalled)
	assert.Equal(t, http.StatusFound, w.Code)
}

func TestFetchLatestVersionOfAppResolveOnLegacyOnlyRepoDegradesGracefully(t *testing.T) {
	// latestRepoStub 不实现 latestTargetRepository：带 resolve 参数也必须走旧路径而非 panic。
	w := performLatestRequest(t, latestRepoStub{apps: latestAppFixture()}, "/apps/latest?app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=apk&resolve=artifact-latest")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/ttpos.apk", w.Header().Get("Location"))
}

func TestCreateCacheKeyIncludesResolveDimension(t *testing.T) {
	base := map[string]interface{}{
		"owner": "ttpos", "app_name": "TTPOS", "version": "", "channel": "prod",
		"platform": "android", "arch": "arm64", "package": "apk",
	}
	legacyKey := CreateCacheKey(base)

	withResolve := map[string]interface{}{}
	for k, v := range base {
		withResolve[k] = v
	}
	withResolve["resolve"] = ResolveArtifactLatest
	resolveKey := CreateCacheKey(withResolve)

	assert.NotEqual(t, legacyKey, resolveKey, "the two election semantics must never share a cache entry")
	assert.Contains(t, resolveKey, "&resolve=artifact-latest")
}
