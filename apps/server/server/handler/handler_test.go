package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// TestSetLatestQuery verifies the query-rewrite helper used by SquirrelReleases.
func TestSetLatestQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	req, err := http.NewRequest(http.MethodGet, "/update/ttpos/TTPOS/prod/windows/amd64/1.0.0/RELEASES", nil)
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
