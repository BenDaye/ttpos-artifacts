package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestResolveShortLatestTarget(t *testing.T) {
	apps := map[string]string{
		"cashier":   "TTPOS",
		"assistant": "TTPOS Go",
		"menu":      "TTPOS Menu",
		"kitchen":   "TTPOS Kitchen",
		"shop":      "TTPOS Shop",
	}
	targets := map[string]shortLatestTargetDefault{
		"apk": {Platform: "android", Arch: "arm64", Package: "apk"},
		"exe": {Platform: "windows", Arch: "amd64", Package: "exe"},
		"dmg": {Platform: "macos", Arch: "arm64", Package: "dmg"},
	}

	for appAlias, appName := range apps {
		for extension, expectedTarget := range targets {
			t.Run(appAlias+"_"+extension, func(t *testing.T) {
				actualAppName, actualTarget, ok := resolveShortLatestTarget(appAlias + "." + extension)

				assert.True(t, ok)
				assert.Equal(t, appName, actualAppName)
				assert.Equal(t, expectedTarget, actualTarget)
			})
		}
	}
}

func TestShortLatestDownloadSetsLatestQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/dl/:target", func(c *gin.Context) {
		appName, target, ok := resolveShortLatestTarget(c.Param("target"))
		if !ok {
			c.Status(http.StatusBadRequest)
			return
		}

		setLatestDownloadQueryValues(c, publicLatestOwner, appName, publicLatestDefaultChannel, target.Platform, target.Arch, target.Package)

		assert.Equal(t, "ttpos", c.Query("owner"))
		assert.Equal(t, "TTPOS", c.Query("app_name"))
		assert.Equal(t, "prod", c.Query("channel"))
		assert.Equal(t, "android", c.Query("platform"))
		assert.Equal(t, "arm64", c.Query("arch"))
		assert.Equal(t, "apk", c.Query("package"))

		c.Status(http.StatusNoContent)
	})

	req, err := http.NewRequest(http.MethodGet, "/dl/cashier.apk", nil)
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestShortLatestDownloadRejectsUnsupportedTargets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name   string
		target string
	}{
		{name: "app", target: "/dl/unknown.apk"},
		{name: "extension", target: "/dl/cashier.zip"},
		{name: "missing extension", target: "/dl/cashier"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			handler := &appHandler{}
			router.GET("/dl/:target", handler.ShortLatestDownload)

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
