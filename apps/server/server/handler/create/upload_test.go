package create

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	db "faynoSync/mongod"

	"github.com/gin-gonic/gin"
)

type fakeUploadClaimReleaser struct {
	released         []db.UploadClaim
	releaseCtxErrors []error
}

func (f *fakeUploadClaimReleaser) ReleaseUploadClaim(claim db.UploadClaim, ctx context.Context) error {
	f.released = append(f.released, claim)
	f.releaseCtxErrors = append(f.releaseCtxErrors, ctx.Err())
	return nil
}

func TestReleaseUploadPlansReleasesAllClaims(t *testing.T) {
	releaser := &fakeUploadClaimReleaser{}
	plans := []uploadFilePlan{
		{claim: db.UploadClaim{ID: "claim-1", Token: "token-1"}},
		{claim: db.UploadClaim{ID: "claim-2", Token: "token-2"}},
	}

	releaseUploadPlans(releaser, plans, context.Background())

	if len(releaser.released) != 2 {
		t.Fatalf("expected two released claims, got %d", len(releaser.released))
	}
	if releaser.released[0].ID != "claim-1" || releaser.released[1].ID != "claim-2" {
		t.Fatalf("unexpected released claims: %#v", releaser.released)
	}
}

func TestReleaseUploadPlansDetachesFromCanceledRequestContext(t *testing.T) {
	releaser := &fakeUploadClaimReleaser{}
	requestCtx, cancel := context.WithCancel(context.Background())
	cancel()

	releaseUploadPlans(releaser, []uploadFilePlan{
		{claim: db.UploadClaim{ID: "claim-1", Token: "token-1"}},
	}, requestCtx)

	if len(releaser.releaseCtxErrors) != 1 {
		t.Fatalf("expected one release call, got %d", len(releaser.releaseCtxErrors))
	}
	if releaser.releaseCtxErrors[0] != nil {
		t.Fatalf("expected release context to be detached from canceled request context, got %v", releaser.releaseCtxErrors[0])
	}
}

func TestNormalizeUploadPackageAddsMissingDot(t *testing.T) {
	if got := normalizeUploadPackage("apk"); got != ".apk" {
		t.Fatalf("expected .apk, got %q", got)
	}
	if got := normalizeUploadPackage(".dmg"); got != ".dmg" {
		t.Fatalf("expected .dmg, got %q", got)
	}
}

func TestCheckUploadAvailableRequiresExactTuple(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		wantErrorKey string
	}{
		{
			name:         "missing app name",
			path:         "/upload/check?version=1.0.0&channel=prod&platform=android&arch=arm64&package=.apk",
			wantErrorKey: "app_name is required",
		},
		{
			name:         "missing version",
			path:         "/upload/check?app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=.apk",
			wantErrorKey: "version is required",
		},
		{
			name:         "missing channel",
			path:         "/upload/check?app_name=TTPOS&version=1.0.0&platform=android&arch=arm64&package=.apk",
			wantErrorKey: "channel is required",
		},
		{
			name:         "missing platform",
			path:         "/upload/check?app_name=TTPOS&version=1.0.0&channel=prod&arch=arm64&package=.apk",
			wantErrorKey: "platform is required",
		},
		{
			name:         "missing arch",
			path:         "/upload/check?app_name=TTPOS&version=1.0.0&channel=prod&platform=android&package=.apk",
			wantErrorKey: "arch is required",
		},
		{
			name:         "missing package",
			path:         "/upload/check?app_name=TTPOS&version=1.0.0&channel=prod&platform=android&arch=arm64",
			wantErrorKey: "package is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, tt.path, nil)
			c.Set("username", "admin")

			CheckUploadAvailable(c, nil, nil)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected status 400, got %d with body %s", w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.wantErrorKey) {
				t.Fatalf("expected body to contain %q, got %s", tt.wantErrorKey, w.Body.String())
			}
		})
	}
}

func TestValidateOverwriteEditPermissionRejectsAPIToken(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/upload", nil)
	c.Set("is_api_token", true)

	status, err := validateOverwriteEditPermission(c, nil, "admin")
	if err == nil {
		t.Fatal("expected api token overwrite to be rejected")
	}
	if status != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", status)
	}
	if err.Error() != "overwrite requires apps.edit permission" {
		t.Fatalf("unexpected error: %v", err)
	}
}
