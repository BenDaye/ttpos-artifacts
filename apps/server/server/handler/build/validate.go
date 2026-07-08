// Package build implements the self-serve test-build trigger (PLAN-040 Track 1).
//
// Boundary: this package is a THIN trigger proxy around the EXISTING auto-build
// workflow. It authorizes the caller, validates inputs, enforces cost guardrails,
// and dispatches. It never computes version numbers and never chooses the
// environment — env is a server-side constant pinned to "test" (EnvTest). What
// is buildable (packages / platforms / app names) is derived from the workflow
// matrices via capabilities.json — the workflow is the single source of truth.
package build

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// EnvTest is the ONLY environment this feature ever triggers. It is a
// server-side literal constant, NEVER read from the caller's request — the
// single trust boundary against a prod bypass (dispatch.yaml gives
// client_payload.env first precedence and auto-build's prod guard is exempt for
// non-workflow_dispatch, so the server must pin it).
const EnvTest = "test"

// DefaultMaxLegs caps build "cells" (|packages| x |platforms|) per trigger — the
// primary cost guardrail against unbounded non-technical self-serve CI spend.
const DefaultMaxLegs = 12

// branchRe / shaRe are anti-injection format guards. branch is UNTRUSTED input
// that flows to `gh workflow run --ref`-style checkout of the source repo.
var (
	branchRe = regexp.MustCompile(`^[\w./-]+$`)
	shaRe    = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)
)

// ValidateBranch does FORMAT/anti-injection validation only. The branch is a
// ttpos-flutter (source repo) branch that the workflow passes to checkout; the
// trigger only needs it to be a safe ref string, not to exist — a nonexistent
// branch simply fails the build. There is deliberately no branch allowlist:
// enumerating/guessing the source repo's branches is the wrong repo to couple
// to (this feature is built around the workflow, not the source repo).
func ValidateBranch(branch string) error {
	branch = strings.TrimSpace(branch)
	if branch == "" {
		return fmt.Errorf("branch is required")
	}
	if shaRe.MatchString(branch) {
		return nil
	}
	if !branchRe.MatchString(branch) {
		return fmt.Errorf("branch contains disallowed characters")
	}
	if strings.Contains(branch, "..") {
		return fmt.Errorf("branch may not contain '..'")
	}
	return nil
}

// NormalizePlatforms validates and de-duplicates the requested platforms against
// the workflow's known platforms.
func NormalizePlatforms(platforms []string) ([]string, error) {
	if len(platforms) == 0 {
		return nil, fmt.Errorf("at least one platform is required")
	}
	return normalizeAgainst(platforms, platformKnown, "platform")
}

// NormalizePackages validates and de-duplicates the requested packages against
// the workflow's known packages (unknowns rejected, fail-closed).
func NormalizePackages(packages []string) ([]string, error) {
	if len(packages) == 0 {
		return nil, fmt.Errorf("at least one package is required")
	}
	known := KnownPackages()
	return normalizeAgainst(packages, func(v string) bool { _, ok := known[v]; return ok }, "package")
}

// LegCount is the billing unit: |packages| x |platforms| (matrix legs, NOT runs).
func LegCount(packages, platforms []string) int {
	return len(packages) * len(platforms)
}

// DispatchSelection is the single-or-all mapping the auto-build workflow accepts.
type DispatchSelection struct {
	Package  string // a single package name, or "all"
	Platform string // a single platform name, or "all"
}

// ResolveDispatch maps the (normalized) request to auto-build's single-or-all
// inputs. Phase 1 supports only "all" or a single value per axis; an arbitrary
// strict subset needs Track 2-b and is rejected so the UI's gating is enforced
// server-side too (never silently drop cells).
func ResolveDispatch(packages, platforms []string) (DispatchSelection, error) {
	pkg, err := collapseToAllOrSingle(packages, KnownPackageCount(), "package")
	if err != nil {
		return DispatchSelection{}, err
	}
	plat, err := collapseToAllOrSingle(platforms, PlatformCount(), "platform")
	if err != nil {
		return DispatchSelection{}, err
	}
	return DispatchSelection{Package: pkg, Platform: plat}, nil
}

func collapseToAllOrSingle(selected []string, totalKnown int, axis string) (string, error) {
	switch {
	case len(selected) == 1:
		return selected[0], nil
	case len(selected) == totalKnown && totalKnown > 0:
		return "all", nil
	default:
		return "", fmt.Errorf("selecting a subset of %ss is not supported yet (needs Track 2-b); choose a single %s or all", axis, axis)
	}
}

// AuthorizeApps decides whether a principal may trigger builds for the requested
// faynosync app IDs (BLOCKER-3 fix: the upload path does not scope team_users).
//   - adminUnrestricted: admin -> no scope limit.
//   - allowedAppIDs: the principal's allowed app-id set.
//   - requestedAppIDs: the app IDs the requested packages resolve to.
//
// Fail-safe: for a non-admin an EMPTY allowedAppIDs means DENY (never allow-all).
func AuthorizeApps(adminUnrestricted bool, allowedAppIDs, requestedAppIDs []string) error {
	if adminUnrestricted {
		return nil
	}
	if len(allowedAppIDs) == 0 {
		return fmt.Errorf("no app scope granted; ask an admin to set your allowed apps")
	}
	allowed := toSet(allowedAppIDs)
	for _, id := range requestedAppIDs {
		if _, ok := allowed[id]; !ok {
			return fmt.Errorf("not permitted to build app %q", id)
		}
	}
	return nil
}

// --- helpers ---

func normalizeAgainst(values []string, allowed func(string) bool, label string) ([]string, error) {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if !allowed(v) {
			return nil, fmt.Errorf("unknown %s %q", label, v)
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("at least one valid %s is required", label)
	}
	sort.Strings(out)
	return out, nil
}

func toSet(values []string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, v := range values {
		set[v] = struct{}{}
	}
	return set
}
