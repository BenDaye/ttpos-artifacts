package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"faynoSync/server/handler/shortlink"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// testCatalog mirrors the production short-link catalog. Exhaustive resolution /
// validation coverage lives in the shortlink package; here we only need a valid
// catalog to exercise the handler wiring.
func testCatalog() *shortlink.Catalog {
	return &shortlink.Catalog{
		Owner:          "ttpos",
		DefaultChannel: "prod",
		Aliases: map[string]string{
			"cashier":   "TTPOS",
			"assistant": "TTPOS Go",
			"menu":      "TTPOS Menu",
			"kitchen":   "TTPOS Kitchen",
			"shop":      "TTPOS Shop",
		},
		Targets: map[string]shortlink.Target{
			"apk": {Platform: "android", Arch: "arm64", Package: "apk"},
			"exe": {Platform: "windows", Arch: "amd64", Package: "exe"},
			"dmg": {Platform: "macos", Arch: "arm64", Package: "dmg"},
		},
	}
}

// TestSetLatestQuery verifies the shared query-rewrite helper used by both
// SquirrelReleases and ShortLatestDownload.
func TestSetLatestQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req, err := http.NewRequest(http.MethodGet, "/dl/cashier.apk", nil)
	if err != nil {
		t.Fatal(err)
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req

	setLatestQuery(c, map[string]string{
		"owner":    "ttpos",
		"app_name": "TTPOS",
		"channel":  "prod",
		"platform": "android",
		"arch":     "arm64",
		"package":  "apk",
	})

	assert.Equal(t, "ttpos", c.Query("owner"))
	assert.Equal(t, "TTPOS", c.Query("app_name"))
	assert.Equal(t, "prod", c.Query("channel"))
	assert.Equal(t, "android", c.Query("platform"))
	assert.Equal(t, "arm64", c.Query("arch"))
	assert.Equal(t, "apk", c.Query("package"))
}

// TestShortLatestDownloadRejectsUnsupportedTargets confirms a configured catalog
// still returns 400 for tokens it cannot resolve.
func TestShortLatestDownloadRejectsUnsupportedTargets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name   string
		target string
	}{
		{name: "unknown app", target: "/dl/unknown.apk"},
		{name: "unknown extension", target: "/dl/cashier.zip"},
		{name: "missing extension", target: "/dl/cashier"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			h := &appHandler{shortLatest: testCatalog()}
			router.GET("/dl/:target", h.ShortLatestDownload)

			req, err := http.NewRequest(http.MethodGet, tt.target, nil)
			if err != nil {
				t.Fatal(err)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), "unsupported short latest download target")
		})
	}
}

// TestShortLatestDownloadWithoutCatalog confirms the defensive nil-catalog guard
// returns 404 (in production the route is not registered without a catalog).
func TestShortLatestDownloadWithoutCatalog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := &appHandler{}
	router.GET("/dl/:target", h.ShortLatestDownload)

	req, err := http.NewRequest(http.MethodGet, "/dl/cashier.apk", nil)
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "not configured")
}
