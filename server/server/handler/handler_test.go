package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestPublicLatestDownloadPlatformDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name             string
		target           string
		expectedPlatform string
		expectedArch     string
		expectedPackage  string
	}{
		{name: "android", target: "/download/latest/ttpos/ttpos_kitchen/android", expectedPlatform: "android", expectedArch: "arm64", expectedPackage: "apk"},
		{name: "windows", target: "/download/latest/ttpos/ttpos_kitchen/windows", expectedPlatform: "windows", expectedArch: "amd64", expectedPackage: "exe"},
		{name: "macos", target: "/download/latest/ttpos/ttpos_kitchen/macos", expectedPlatform: "macos", expectedArch: "arm64", expectedPackage: "dmg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/download/latest/:owner/:app_identifier/:platform", func(c *gin.Context) {
				platform := c.Param("platform")
				defaults := publicLatestPlatformDefaults[platform]
				setLatestDownloadQuery(c, publicLatestDefaultChannel, platform, defaults.Arch, defaults.Package)

				assert.Equal(t, "ttpos", c.Query("owner"))
				assert.Equal(t, "ttpos_kitchen", c.Query("app_name"))
				assert.Equal(t, "prod", c.Query("channel"))
				assert.Equal(t, tt.expectedPlatform, c.Query("platform"))
				assert.Equal(t, tt.expectedArch, c.Query("arch"))
				assert.Equal(t, tt.expectedPackage, c.Query("package"))

				c.Status(http.StatusNoContent)
			})

			req, err := http.NewRequest(http.MethodGet, tt.target, nil)
			if err != nil {
				t.Fatal(err)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusNoContent, w.Code)
		})
	}
}

func TestPublicLatestDownloadFullArtifactPathIsNotRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := &appHandler{}
	router.GET("/download/latest/:owner/:app_identifier/:platform", handler.PublicLatestDownload)

	req, err := http.NewRequest(http.MethodGet, "/download/latest/ttpos/ttpos_kitchen/linux/amd64/deb", nil)
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPublicLatestDownloadRejectsUnsupportedPlatformShortcut(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := &appHandler{}
	router.GET("/download/latest/:owner/:app_identifier/:platform", handler.PublicLatestDownload)

	req, err := http.NewRequest(http.MethodGet, "/download/latest/ttpos/ttpos_kitchen/linux", nil)
	if err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "unsupported platform")
}
