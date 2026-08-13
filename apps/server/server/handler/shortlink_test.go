package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	db "faynoSync/mongod"
	"faynoSync/server/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestParseShortLinkTarget(t *testing.T) {
	cases := []struct {
		name     string
		target   string
		wantName string
		wantHit  shortLinkTarget
		wantOK   bool
	}{
		{
			name:     "apk maps to the android target",
			target:   "cashier.apk",
			wantName: "cashier",
			wantHit:  shortLinkTarget{Platform: "android", Arch: "arm64", Package: "apk"},
			wantOK:   true,
		},
		{
			name:     "exe maps to the windows target",
			target:   "cashier.exe",
			wantName: "cashier",
			wantHit:  shortLinkTarget{Platform: "windows", Arch: "amd64", Package: "exe"},
			wantOK:   true,
		},
		{
			name:     "dmg maps to the macos target",
			target:   "cashier.dmg",
			wantName: "cashier",
			wantHit:  shortLinkTarget{Platform: "macos", Arch: "arm64", Package: "dmg"},
			wantOK:   true,
		},
		{
			// Printed URLs and QR codes are read by humans; an uppercased
			// target must reach the same artifact.
			name:     "target is case-insensitive",
			target:   "CASHIER.APK",
			wantName: "cashier",
			wantHit:  shortLinkTarget{Platform: "android", Arch: "arm64", Package: "apk"},
			wantOK:   true,
		},
		{
			// Split on the LAST dot, so a dotted name keeps its extension.
			name:     "splits on the last dot",
			target:   "my.app.apk",
			wantName: "my.app",
			wantHit:  shortLinkTarget{Platform: "android", Arch: "arm64", Package: "apk"},
			wantOK:   true,
		},
		{name: "unknown extension is rejected", target: "cashier.zip"},
		{name: "missing extension is rejected", target: "cashier"},
		{name: "trailing dot is rejected", target: "cashier."},
		{name: "leading dot is rejected", target: ".apk"},
		{name: "empty target is rejected", target: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotName, gotTarget, ok := parseShortLinkTarget(tc.target)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.wantName, gotName)
			assert.Equal(t, tc.wantHit, gotTarget)
		})
	}
}

type shortLinkRepoStub struct {
	appName     string
	resolveErr  error
	apps        []*model.SpecificAppWithoutIDs
	fetchErr    error
	gotShortLnk string
}

func (r *shortLinkRepoStub) ResolveShortLinkApp(shortLink string, _ string, _ context.Context) (string, error) {
	r.gotShortLnk = shortLink
	return r.appName, r.resolveErr
}

func (r *shortLinkRepoStub) FetchLatestVersionOfApp(string, string, context.Context, string) ([]*model.SpecificAppWithoutIDs, error) {
	return r.apps, r.fetchErr
}

func performShortLinkRequest(t *testing.T, repo shortLinkRepository, target string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	router := gin.New()
	router.GET("/dl/:target", func(c *gin.Context) {
		serveShortLatestDownload(c, repo, nil, false)
	})

	req, err := http.NewRequest(http.MethodGet, "/dl/"+target, nil)
	if err != nil {
		t.Fatal(err)
	}
	router.ServeHTTP(recorder, req)
	return recorder
}

func shortLinkAppFixture() []*model.SpecificAppWithoutIDs {
	return []*model.SpecificAppWithoutIDs{
		{
			AppName:   "TTPOS",
			Version:   "2.27.3",
			Channel:   "prod",
			Published: true,
			Artifacts: []model.SpecificArtifactsWithoutIDs{
				{
					Link:     "https://downloads.example.com/TTPOS-2.27.3.apk",
					Platform: "android",
					Arch:     "arm64",
					Package:  ".apk",
				},
			},
		},
	}
}

func TestShortLatestDownloadRedirectsToArtifact(t *testing.T) {
	repo := &shortLinkRepoStub{appName: "TTPOS", apps: shortLinkAppFixture()}

	w := performShortLinkRequest(t, repo, "cashier.apk")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "https://downloads.example.com/TTPOS-2.27.3.apk", w.Header().Get("Location"))
	// The short link name, not the app name, is what reaches the repository.
	assert.Equal(t, "cashier", repo.gotShortLnk)
	// Success must overwrite the pessimistic no-store defaults.
	assert.Equal(t, "public, max-age=300", w.Header().Get("Cloudflare-CDN-Cache-Control"))
	assert.Equal(t, "no-cache", w.Header().Get("Cache-Control"))
}

func TestShortLatestDownloadLowercasesNameBeforeLookup(t *testing.T) {
	repo := &shortLinkRepoStub{appName: "TTPOS", apps: shortLinkAppFixture()}

	w := performShortLinkRequest(t, repo, "CASHIER.APK")

	assert.Equal(t, http.StatusFound, w.Code)
	assert.Equal(t, "cashier", repo.gotShortLnk)
}

func TestShortLatestDownloadRejectsUnknownExtension(t *testing.T) {
	repo := &shortLinkRepoStub{appName: "TTPOS", apps: shortLinkAppFixture()}

	w := performShortLinkRequest(t, repo, "cashier.zip")

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	assert.Equal(t, "no-store", w.Header().Get("Cloudflare-CDN-Cache-Control"))
	// Rejected before any lookup happens.
	assert.Equal(t, "", repo.gotShortLnk)
}

func TestShortLatestDownloadRejectsUnknownName(t *testing.T) {
	repo := &shortLinkRepoStub{resolveErr: db.ErrAppNameNotFound}

	w := performShortLinkRequest(t, repo, "nosuchapp.apk")

	// An unclaimed name is an unsupported target, matching what the reverse
	// proxy returned for an alias missing from its static table.
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
}

func TestShortLatestDownloadRejectsAmbiguousName(t *testing.T) {
	repo := &shortLinkRepoStub{resolveErr: db.ErrAppIdentifierAmbiguous}

	w := performShortLinkRequest(t, repo, "ambiguous.apk")

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestShortLatestDownloadKnownNameWithoutArtifactIsNotFound(t *testing.T) {
	// The name resolves, but the app ships no matching artifact — that is a
	// 404, distinct from the 400 an unknown name gets.
	repo := &shortLinkRepoStub{appName: "TTPOS", apps: nil}

	w := performShortLinkRequest(t, repo, "cashier.apk")

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	assert.Equal(t, "no-store", w.Header().Get("Cloudflare-CDN-Cache-Control"))
}

func TestShortLatestDownloadResolveFailureIsServerError(t *testing.T) {
	repo := &shortLinkRepoStub{resolveErr: errors.New("mongo is down")}

	w := performShortLinkRequest(t, repo, "cashier.apk")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
}
