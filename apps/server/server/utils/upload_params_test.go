package utils

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestExtractParamsFromPostIncludesOverwrite(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	form := url.Values{}
	form.Set("data", `{"app_name":"testapp","version":"1.2.3","overwrite":true}`)
	req := httptest.NewRequest(http.MethodPost, "/upload", nil)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Body = http.NoBody
	req.PostForm = form
	req.Form = form
	c.Request = req

	params, err := extractParamsFromPost(c)
	if err != nil {
		t.Fatalf("extractParamsFromPost returned error: %v", err)
	}

	got, exists := params["overwrite"]
	if !exists {
		t.Fatal("expected overwrite to be present in parsed params")
	}
	if got != "true" {
		t.Fatalf("expected overwrite to be true string, got %#v", got)
	}
}
