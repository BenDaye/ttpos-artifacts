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

func performLatestRequest(t *testing.T, repo latestRepoStub, target string) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/apps/latest", func(c *gin.Context) {
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
