package build

import "testing"

// env is a compile-time constant, never a request field.
func TestEnvIsPinnedToTest(t *testing.T) {
	if EnvTest != "test" {
		t.Fatalf("EnvTest must be \"test\", got %q", EnvTest)
	}
}

// Branch validation is format/anti-injection only (no allowlist): any safe ref
// string is accepted; injection payloads are rejected.
func TestValidateBranch(t *testing.T) {
	valid := []string{
		"new-test",
		"release",
		"main",
		"feature/foo-bar",
		"random-branch",  // no allowlist anymore -> a well-formed branch is fine
		"hotfix/abc_123", // ditto
		"0123456789abcdef0123456789abcdef01234567", // 40-hex SHA
	}
	for _, b := range valid {
		if err := ValidateBranch(b); err != nil {
			t.Errorf("expected %q valid, got: %v", b, err)
		}
	}

	invalid := []string{
		"",
		"../../evil",
		`zzz";echo "hi";#`,
		"main; rm -rf /",       // space + special chars
		"feature/..\\traverse", // backslash + traversal
		"a b",                  // space
	}
	for _, b := range invalid {
		if err := ValidateBranch(b); err == nil {
			t.Errorf("expected %q rejected, but it passed", b)
		}
	}
}

func TestLegCountAndCap(t *testing.T) {
	if got := LegCount([]string{"pos", "kds", "shop"}, []string{"android", "ios", "windows", "macos"}); got != 12 {
		t.Fatalf("LegCount = %d, want 12", got)
	}
	over := LegCount([]string{"a", "b", "c", "d"}, []string{"android", "ios", "windows", "macos"})
	if over <= DefaultMaxLegs {
		t.Fatalf("expected %d to exceed cap %d", over, DefaultMaxLegs)
	}
}

// Phase 1 supports only single-or-all per axis; a strict subset is rejected.
func TestResolveDispatch(t *testing.T) {
	caps := GetCapabilities()
	allPkgs := make([]string, 0, len(caps.Packages))
	for _, p := range caps.Packages {
		allPkgs = append(allPkgs, p.Package)
	}
	allPlats := append([]string{}, caps.Platforms...)

	sel, err := ResolveDispatch([]string{"pos"}, []string{"android"})
	if err != nil || sel.Package != "pos" || sel.Platform != "android" {
		t.Fatalf("single/single: got %+v err=%v", sel, err)
	}

	sel, err = ResolveDispatch(allPkgs, allPlats)
	if err != nil || sel.Package != "all" || sel.Platform != "all" {
		t.Fatalf("all/all: got %+v err=%v", sel, err)
	}

	if _, err := ResolveDispatch([]string{"pos", "kds"}, []string{"android"}); err == nil {
		t.Fatalf("expected strict package subset to be rejected")
	}
	if _, err := ResolveDispatch([]string{"pos"}, []string{"android", "ios"}); err == nil {
		t.Fatalf("expected strict platform subset to be rejected")
	}
}

func TestNormalizePlatforms(t *testing.T) {
	out, err := NormalizePlatforms([]string{"android", "android", "ios"})
	if err != nil || len(out) != 2 {
		t.Fatalf("dedupe: out=%v err=%v", out, err)
	}
	if _, err := NormalizePlatforms([]string{"web"}); err == nil {
		t.Fatalf("expected web rejected in Phase 1")
	}
	if _, err := NormalizePlatforms([]string{"solaris"}); err == nil {
		t.Fatalf("expected unknown platform rejected")
	}
}

func TestNormalizePackages(t *testing.T) {
	if _, err := NormalizePackages([]string{"pos"}); err != nil {
		t.Errorf("pos should be known: %v", err)
	}
	if _, err := NormalizePackages([]string{"bogus"}); err == nil {
		t.Errorf("unknown package should be rejected")
	}
	if _, err := NormalizePackages([]string{"menu"}); err == nil {
		t.Errorf("web package menu is not in Phase-1 capabilities, should be rejected")
	}
}

// Capabilities-derived per-platform availability: qds is android-only.
func TestPlatformAvailable(t *testing.T) {
	if !PlatformAvailable("qds", "android") {
		t.Error("qds should be available on android")
	}
	for _, plat := range []string{"ios", "windows", "macos"} {
		if PlatformAvailable("qds", plat) {
			t.Errorf("qds must NOT be available on %s", plat)
		}
	}
	for _, plat := range GetCapabilities().Platforms {
		if !PlatformAvailable("pos", plat) {
			t.Errorf("pos should be available on %s", plat)
		}
	}
	if PlatformAvailable("bogus", "android") {
		t.Error("unknown package must not be available")
	}
}

// BLOCKER-3: app-scope fail-safe. Empty allowed set for a non-admin = deny.
func TestAuthorizeApps(t *testing.T) {
	if err := AuthorizeApps(true, nil, []string{"any"}); err != nil {
		t.Errorf("admin should be unrestricted: %v", err)
	}
	if err := AuthorizeApps(false, nil, []string{"app1"}); err == nil {
		t.Errorf("empty Allowed for non-admin must be denied")
	}
	if err := AuthorizeApps(false, []string{"app1", "app2"}, []string{"app1"}); err != nil {
		t.Errorf("expected app1 allowed: %v", err)
	}
	if err := AuthorizeApps(false, []string{"app1"}, []string{"app2"}); err == nil {
		t.Errorf("expected app2 denied")
	}
}

// AppNameForPackage comes from the workflow-derived capabilities.
func TestAppNameForPackage(t *testing.T) {
	if n, ok := AppNameForPackage("pos"); !ok || n != "TTPOS" {
		t.Errorf("pos -> %q,%v want TTPOS,true", n, ok)
	}
	if _, ok := AppNameForPackage("bogus"); ok {
		t.Error("bogus should have no app name")
	}
}
