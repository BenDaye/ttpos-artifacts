package build

import (
	_ "embed"
	"encoding/json"
)

// capabilities.json is generated from the build-*.yaml workflow matrices by
// scripts/gen-build-capabilities.ts (the workflow is the single source of truth
// for what is buildable). Do not edit by hand; re-run the generator.
//
//go:embed capabilities.json
var capabilitiesJSON []byte

// PackageCapability describes one buildable app end.
type PackageCapability struct {
	Package   string   `json:"package"`
	AppName   string   `json:"app_name"`
	Platforms []string `json:"platforms"`
}

// Capabilities is what the self-serve trigger can build, derived from workflow.
type Capabilities struct {
	Platforms []string            `json:"platforms"`
	Packages  []PackageCapability `json:"packages"`
}

var (
	caps        Capabilities
	capPkgIndex map[string]PackageCapability
	capPlatSet  map[string]struct{}
)

func init() {
	if err := json.Unmarshal(capabilitiesJSON, &caps); err != nil {
		panic("build: invalid embedded capabilities.json: " + err.Error())
	}
	capPkgIndex = make(map[string]PackageCapability, len(caps.Packages))
	for _, p := range caps.Packages {
		capPkgIndex[p.Package] = p
	}
	capPlatSet = make(map[string]struct{}, len(caps.Platforms))
	for _, pl := range caps.Platforms {
		capPlatSet[pl] = struct{}{}
	}
}

// GetCapabilities returns the workflow-derived capabilities (served to the UI).
func GetCapabilities() Capabilities { return caps }

// KnownPackages is the set of buildable package ids.
func KnownPackages() map[string]struct{} {
	s := make(map[string]struct{}, len(capPkgIndex))
	for k := range capPkgIndex {
		s[k] = struct{}{}
	}
	return s
}

// KnownPackageCount / PlatformCount back the single-or-all collapse.
func KnownPackageCount() int { return len(caps.Packages) }
func PlatformCount() int     { return len(caps.Platforms) }

// AppNameForPackage returns the FaynoSync app name a package publishes under.
func AppNameForPackage(pkg string) (string, bool) {
	p, ok := capPkgIndex[pkg]
	return p.AppName, ok
}

// PlatformAvailable reports whether pkg is actually built on platform (per the
// workflow matrix). e.g. qds is android-only.
func PlatformAvailable(pkg, platform string) bool {
	p, ok := capPkgIndex[pkg]
	if !ok {
		return false
	}
	for _, pl := range p.Platforms {
		if pl == platform {
			return true
		}
	}
	return false
}

// platformKnown reports whether platform is a valid build platform.
func platformKnown(platform string) bool {
	_, ok := capPlatSet[platform]
	return ok
}
