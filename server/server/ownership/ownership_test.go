package ownership

import "testing"

func TestConfigureTrimsAndSetsOwner(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	Configure("  ttpos  ")
	if got := Owner(); got != "ttpos" {
		t.Fatalf("Configure must trim and set the deployment owner; got %q", got)
	}
}

func TestConfigureEmptyOwnerIsBootstrap(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	// An empty owner is the first-boot bootstrap state; startup permits it only
	// until the first admin exists (enforced in server.StartServer, not here).
	Configure("")
	if got := Owner(); got != "" {
		t.Fatalf("an empty (bootstrap) owner must yield an empty Owner(); got %q", got)
	}
}

func TestOwnerIsDeploymentConstant(t *testing.T) {
	t.Cleanup(func() { Configure("") })

	// Owner takes no caller context and never errors: the namespace is a single
	// deployment-wide constant, not a per-request derivation.
	Configure("ttpos")
	if got := Owner(); got != "ttpos" {
		t.Fatalf("Owner must return the configured deployment owner; got %q", got)
	}
}
