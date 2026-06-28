package ownership

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func newContext(username string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if username != "" {
		c.Set("username", username)
	}
	return c
}

func TestConfigureTogglesMode(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	Configure("")
	if Enabled() || DeploymentOwner() != "" {
		t.Fatalf("empty owner must disable single-owner mode, got enabled=%v owner=%q", Enabled(), DeploymentOwner())
	}

	Configure("  ttpos  ")
	if !Enabled() {
		t.Fatal("non-empty owner must enable single-owner mode")
	}
	if DeploymentOwner() != "ttpos" {
		t.Fatalf("owner must be trimmed, got %q", DeploymentOwner())
	}
}

func TestOwnerOrUsername(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	// Single-owner mode ignores the caller identity entirely.
	Configure("ttpos")
	got, err := OwnerOrUsername(newContext(""))
	if err != nil || got != "ttpos" {
		t.Fatalf("single-owner mode must return the deployment owner without needing a username; got %q err=%v", got, err)
	}

	// Legacy mode returns the caller's own username.
	Configure("")
	got, err = OwnerOrUsername(newContext("alice"))
	if err != nil || got != "alice" {
		t.Fatalf("legacy mode must return the username; got %q err=%v", got, err)
	}

	// Legacy mode surfaces the missing-identity error.
	if _, err := OwnerOrUsername(newContext("")); err == nil {
		t.Fatal("legacy mode must error when no username is present")
	}
}

func TestResolveOwnerSingleOwnerSkipsDatabase(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	// A nil database is safe in single-owner mode: the deployment owner is
	// returned before any team_users lookup happens.
	Configure("ttpos")
	got, err := ResolveOwner(newContext(""), nil)
	if err != nil || got != "ttpos" {
		t.Fatalf("single-owner ResolveOwner must return the deployment owner without touching the db; got %q err=%v", got, err)
	}
}

func TestResolveOwnerLegacyMissingUsername(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	// In legacy mode a missing identity errors before the team_users lookup, so
	// a nil database is never dereferenced.
	Configure("")
	if _, err := ResolveOwner(newContext(""), nil); err == nil {
		t.Fatal("legacy ResolveOwner must error when no username is present")
	}
}
