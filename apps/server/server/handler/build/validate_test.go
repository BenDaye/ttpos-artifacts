package build

import "testing"

// T-5 (partial) / boundary: env is a compile-time constant, never a request
// field. This asserts the constant can only be "test" so no caller input can
// redirect the dispatch environment.
func TestEnvIsPinnedToTest(t *testing.T) {
	if EnvTest != "test" {
		t.Fatalf("EnvTest must be \"test\", got %q", EnvTest)
	}
}

// T-10: branch allowlist rejects arbitrary/injection refs and accepts safe ones.
func TestValidateBranch(t *testing.T) {
	valid := []string{
		"new-test",
		"release",
		"main",
		"feature/foo-bar",
		"feature/ABC_123",
		"0123456789abcdef0123456789abcdef01234567", // 40-hex SHA
	}
	for _, b := range valid {
		if err := ValidateBranch(b); err != nil {
			t.Errorf("expected %q to be valid, got: %v", b, err)
		}
	}

	invalid := []string{
		"",
		"../../evil",
		`zzz";echo "hi";#`,
		"feature/",             // prefix with nothing after
		"random-branch",        // not in allowlist, no allowed prefix
		"main; rm -rf /",       // space + special chars
		"feature/..\\traverse", // backslash + traversal
	}
	for _, b := range invalid {
		if err := ValidateBranch(b); err == nil {
			t.Errorf("expected %q to be rejected, but it passed", b)
		}
	}
}

// T-6: leg count = |packages| x |platforms|; the cap is enforced by callers
// against DefaultMaxLegs.
func TestLegCountAndCap(t *testing.T) {
	pkgs := []string{"pos", "kds", "shop"}
	plats := []string{"android", "ios", "windows", "macos"}
	if got := LegCount(pkgs, plats); got != 12 {
		t.Fatalf("LegCount = %d, want 12", got)
	}
	// 4 x 4 = 16 > DefaultMaxLegs(12)
	over := LegCount([]string{"a", "b", "c", "d"}, []string{"android", "ios", "windows", "macos"})
	if over <= DefaultMaxLegs {
		t.Fatalf("expected %d to exceed cap %d", over, DefaultMaxLegs)
	}
}

// M-3 / T-12: Phase 1 supports only single-or-all per axis; a strict subset is
// rejected (Track 2-b), never silently reduced.
func TestResolveDispatch(t *testing.T) {
	known := map[string]struct{}{"pos": {}, "kds": {}, "shop": {}}

	// single package + single platform
	sel, err := ResolveDispatch([]string{"pos"}, []string{"android"}, known)
	if err != nil || sel.Package != "pos" || sel.Platform != "android" {
		t.Fatalf("single/single: got %+v err=%v", sel, err)
	}

	// all packages + all platforms -> "all"/"all"
	sel, err = ResolveDispatch([]string{"pos", "kds", "shop"}, AllowedPlatforms, known)
	if err != nil || sel.Package != "all" || sel.Platform != "all" {
		t.Fatalf("all/all: got %+v err=%v", sel, err)
	}

	// strict subset of packages -> rejected
	if _, err := ResolveDispatch([]string{"pos", "kds"}, []string{"android"}, known); err == nil {
		t.Fatalf("expected strict package subset to be rejected")
	}

	// strict subset of platforms -> rejected
	if _, err := ResolveDispatch([]string{"pos"}, []string{"android", "ios"}, known); err == nil {
		t.Fatalf("expected strict platform subset to be rejected")
	}
}

func TestNormalizePlatforms(t *testing.T) {
	out, err := NormalizePlatforms([]string{"android", "android", "ios"})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("expected dedupe to 2, got %v", out)
	}
	if _, err := NormalizePlatforms([]string{"web"}); err == nil {
		t.Fatalf("expected web to be rejected in Phase 1")
	}
	if _, err := NormalizePlatforms([]string{"solaris"}); err == nil {
		t.Fatalf("expected unknown platform to be rejected")
	}
}

// Per-platform package availability: qds is android-only; other packages build
// on all native platforms. Prevents impossible (package, platform) cells from
// being dispatched/polled (false-timeout bug).
func TestPlatformAvailable(t *testing.T) {
	if !PlatformAvailable("qds", "android") {
		t.Error("qds should be available on android")
	}
	for _, plat := range []string{"ios", "windows", "macos"} {
		if PlatformAvailable("qds", plat) {
			t.Errorf("qds must NOT be available on %s", plat)
		}
	}
	// A package with no exclusions is available everywhere.
	for _, plat := range AllowedPlatforms {
		if !PlatformAvailable("pos", plat) {
			t.Errorf("pos should be available on %s", plat)
		}
	}
}

// BLOCKER-3: app-scope fail-safe. Empty allowed set for a non-admin = deny.
func TestAuthorizeApps(t *testing.T) {
	// admin: unrestricted
	if err := AuthorizeApps(true, nil, []string{"any"}); err != nil {
		t.Errorf("admin should be unrestricted: %v", err)
	}
	// non-admin, empty Allowed -> deny (fail-safe, NOT allow-all)
	if err := AuthorizeApps(false, nil, []string{"app1"}); err == nil {
		t.Errorf("empty Allowed for non-admin must be denied")
	}
	// non-admin, app in Allowed -> ok
	if err := AuthorizeApps(false, []string{"app1", "app2"}, []string{"app1"}); err != nil {
		t.Errorf("expected app1 to be allowed: %v", err)
	}
	// non-admin, app NOT in Allowed -> deny
	if err := AuthorizeApps(false, []string{"app1"}, []string{"app2"}); err == nil {
		t.Errorf("expected app2 to be denied")
	}
	// non-admin, one of several requested not allowed -> deny
	if err := AuthorizeApps(false, []string{"app1"}, []string{"app1", "app2"}); err == nil {
		t.Errorf("expected mixed request to be denied")
	}
}
