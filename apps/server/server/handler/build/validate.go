// Package build implements the self-serve test-build trigger (PLAN-040 Track 1).
//
// Boundary: this package is a THIN trigger proxy. It authorizes the caller,
// validates inputs, enforces cost guardrails, and dispatches the EXISTING
// auto-build workflow. It never computes version numbers, never manages the
// build process, and never lets the caller choose the environment — env is a
// server-side constant pinned to "test" (see EnvTest). All fan-out / versioning
// belongs to the workflow (Track 2), not here.
package build

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// EnvTest is the ONLY environment this feature ever triggers. It is a
// server-side literal constant and is NEVER read from the caller's request.
// This is the single trust boundary against a prod bypass (PLAN-040 §3 step 1.4,
// Rec1): dispatch.yaml gives client_payload.env first precedence and auto-build's
// prod guard is exempt for non-workflow_dispatch, so the workflow layer does NOT
// clamp env — the server must.
const EnvTest = "test"

// DefaultMaxLegs caps the number of build "cells" (|packages| x |platforms|) a
// single trigger may fan out to. Non-technical self-serve is an unbounded CI
// spend vector; this is the primary cost guardrail (PLAN-040 §3 step 5).
const DefaultMaxLegs = 12

// AllowedPlatforms are the native Flutter platforms self-serve may target.
// Web (menu/mobile/member) is excluded from Phase 1 (no FS_VERSION, auto-build
// does not pass faynosync for web). See PLAN-040 §Phase 2 item 1.
var AllowedPlatforms = []string{"android", "ios", "windows", "macos"}

// allowedPlatformSet is the lookup form of AllowedPlatforms.
var allowedPlatformSet = toSet(AllowedPlatforms)

// packageExcludedPlatforms mirrors the auto-build fan-out exclusions: not every
// package is built on every platform. qds (TTPOS Queue) is android-only — the
// auto-build iOS/Windows/macOS steps exclude qds and it is absent from those
// build-*.yaml matrices, so a (qds, non-android) cell never produces an
// artifact. Such cells must never be dispatched, offered, or polled (otherwise
// the dashboard would spin them to a false timeout). Keep this in lockstep with
// auto-build.yaml's fan-out `if` conditions.
var packageExcludedPlatforms = map[string]map[string]struct{}{
	"qds": {"ios": {}, "windows": {}, "macos": {}},
}

// PlatformAvailable reports whether pkg is actually built on platform.
func PlatformAvailable(pkg, platform string) bool {
	excluded, ok := packageExcludedPlatforms[pkg]
	if !ok {
		return true
	}
	_, blocked := excluded[platform]
	return !blocked
}

// branchRe rejects anything outside a conservative charset. Branch/ref is
// UNTRUSTED input that flows to `gh workflow run --ref` (GitHub script-injection
// guidance; Ultralytics / GitLab CVE-2024-9164). Combined with the branch
// allowlist below, this blocks arbitrary-ref injection (PLAN-040 §3 step 3).
var branchRe = regexp.MustCompile(`^[\w./-]+$`)

// shaRe matches a full 40-hex commit SHA. Commit SHAs are immutable and are the
// safest ref to accept; they always pass validation.
var shaRe = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)

// defaultBranchAllowPrefixes are branch name prefixes accepted in addition to
// the exact allowlist. Kept intentionally narrow.
var defaultBranchAllowPrefixes = []string{"feature/"}

// defaultBranchAllowExact are branch names accepted verbatim.
var defaultBranchAllowExact = []string{"new-test", "release", "main", "develop"}

// ValidateBranch returns an error if branch is not a safe, allowed ref.
// A 40-hex SHA is always allowed (immutable). Otherwise the branch must match
// branchRe AND be in the exact allowlist or under an allowed prefix.
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
	// Defense in depth: reject path traversal even though branchRe already
	// forbids most of it.
	if strings.Contains(branch, "..") {
		return fmt.Errorf("branch may not contain '..'")
	}
	for _, exact := range defaultBranchAllowExact {
		if branch == exact {
			return nil
		}
	}
	for _, prefix := range defaultBranchAllowPrefixes {
		if strings.HasPrefix(branch, prefix) && len(branch) > len(prefix) {
			return nil
		}
	}
	return fmt.Errorf("branch %q is not in the allowlist", branch)
}

// NormalizePlatforms validates and de-duplicates the requested platforms.
func NormalizePlatforms(platforms []string) ([]string, error) {
	if len(platforms) == 0 {
		return nil, fmt.Errorf("at least one platform is required")
	}
	out, err := normalizeAgainst(platforms, allowedPlatformSet, "platform")
	if err != nil {
		return nil, err
	}
	return out, nil
}

// NormalizePackages validates and de-duplicates the requested packages against
// the set of packages the deployment knows how to build (the keys of the
// package->app map). Unknown packages are rejected (fail-closed).
func NormalizePackages(packages []string, known map[string]struct{}) ([]string, error) {
	if len(packages) == 0 {
		return nil, fmt.Errorf("at least one package is required")
	}
	return normalizeAgainst(packages, known, "package")
}

// LegCount is the billing unit: |packages| x |platforms|. Note this counts
// matrix legs, NOT dispatched runs (auto-build fans out to <=|platforms| child
// runs, each with |packages| matrix legs). See PLAN-040 §3 step 5.
func LegCount(packages, platforms []string) int {
	return len(packages) * len(platforms)
}

// DispatchSelection is the single-or-all mapping the auto-build workflow accepts
// today. Phase 1 supports only "all" or a single value per axis; an arbitrary
// strict subset requires Track 2-b (list inputs across 6 workflow files) and is
// rejected here so the UI's capability gating is enforced server-side too
// (M-3: never silently drop cells).
type DispatchSelection struct {
	Package  string // a single package name, or "all"
	Platform string // a single platform name, or "all"
}

// ResolveDispatch maps the (already-normalized) request to auto-build's
// single-or-all inputs. allKnownPackages is the full set the deployment builds;
// if the request covers all of them it collapses to "all". A strict subset
// (more than one but not all) on either axis is rejected as Track-2-b territory.
func ResolveDispatch(packages, platforms []string, allKnownPackages map[string]struct{}) (DispatchSelection, error) {
	pkg, err := collapseToAllOrSingle(packages, len(allKnownPackages), "package")
	if err != nil {
		return DispatchSelection{}, err
	}
	plat, err := collapseToAllOrSingle(platforms, len(AllowedPlatforms), "platform")
	if err != nil {
		return DispatchSelection{}, err
	}
	return DispatchSelection{Package: pkg, Platform: plat}, nil
}

// collapseToAllOrSingle returns the single value, or "all" when the selection
// covers every known value, or an error for a strict subset.
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
// faynosync app IDs. This is the BLOCKER-3 fix: the upload path does NOT enforce
// app-scope for team_users, so the trigger handler must do it explicitly here.
//
//   - adminUnrestricted: caller is an admin -> no scope limit.
//   - allowedAppIDs: the principal's allowed app-id set (API-token allowed_apps
//     or team_user Permissions.Apps.Allowed).
//   - requestedAppIDs: the faynosync app IDs the requested packages resolve to.
//
// Fail-safe: for a non-admin an EMPTY allowedAppIDs means DENY (never treat empty
// as "all"). Every requested app must be in the allowed set.
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

func normalizeAgainst(values []string, allowed map[string]struct{}, label string) ([]string, error) {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := allowed[v]; !ok {
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
