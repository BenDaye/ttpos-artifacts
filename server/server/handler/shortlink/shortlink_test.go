package shortlink

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// canonicalCatalog mirrors the values that were hardcoded in the handler package
// before this refactor. The behavior-equivalence tests lock /dl resolution to
// these exact tuples so the refactor stays byte-identical for the published
// public URLs (websites / QR codes).
func canonicalCatalog() *Catalog {
	return &Catalog{
		Owner:          "ttpos",
		DefaultChannel: "prod",
		Aliases: map[string]string{
			"cashier":   "TTPOS",
			"assistant": "TTPOS Go",
			"menu":      "TTPOS Menu",
			"kitchen":   "TTPOS Kitchen",
			"shop":      "TTPOS Shop",
		},
		Targets: map[string]Target{
			"apk": {Platform: "android", Arch: "arm64", Package: "apk"},
			"exe": {Platform: "windows", Arch: "amd64", Package: "exe"},
			"dmg": {Platform: "macos", Arch: "arm64", Package: "dmg"},
		},
	}
}

// TestResolveBehaviorEquivalence asserts every alias x extension resolves to the
// exact tuple the hardcoded implementation produced.
func TestResolveBehaviorEquivalence(t *testing.T) {
	catalog := canonicalCatalog()

	for alias, appName := range catalog.Aliases {
		for ext, expectedTarget := range catalog.Targets {
			t.Run(alias+"_"+ext, func(t *testing.T) {
				actualAppName, actualTarget, ok := catalog.Resolve(alias + "." + ext)

				assert.True(t, ok)
				assert.Equal(t, appName, actualAppName)
				assert.Equal(t, expectedTarget, actualTarget)
			})
		}
	}
}

// TestResolveIsCaseInsensitive confirms uppercase input still resolves, matching
// the previous strings.ToLower normalization.
func TestResolveIsCaseInsensitive(t *testing.T) {
	catalog := canonicalCatalog()

	appName, target, ok := catalog.Resolve("CASHIER.APK")

	assert.True(t, ok)
	assert.Equal(t, "TTPOS", appName)
	assert.Equal(t, Target{Platform: "android", Arch: "arm64", Package: "apk"}, target)
}

// TestResolveRejects covers the same rejection cases the hardcoded resolver
// handled: unknown alias, unknown extension, no dot, trailing dot, leading dot.
func TestResolveRejects(t *testing.T) {
	catalog := canonicalCatalog()

	tests := []struct {
		name   string
		target string
	}{
		{name: "unknown alias", target: "unknown.apk"},
		{name: "unknown extension", target: "cashier.zip"},
		{name: "missing extension", target: "cashier"},
		{name: "trailing dot", target: "cashier."},
		{name: "leading dot empty alias", target: ".apk"},
		{name: "empty", target: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, ok := catalog.Resolve(tt.target)
			assert.False(t, ok)
		})
	}
}

func writeConfig(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "short-latest.json")
	require.NoError(t, os.WriteFile(path, []byte(contents), 0o600))
	return path
}

func TestLoadValidConfig(t *testing.T) {
	path := writeConfig(t, `{
		"owner": "ttpos",
		"default_channel": "prod",
		"aliases": {"Cashier": "TTPOS"},
		"targets": {"APK": {"platform": "android", "arch": "arm64", "package": "apk"}}
	}`)

	catalog, err := Load(path)
	require.NoError(t, err)
	require.NotNil(t, catalog)

	assert.Equal(t, "ttpos", catalog.Owner)
	assert.Equal(t, "prod", catalog.DefaultChannel)

	// Keys are normalized to lower case on load.
	appName, target, ok := catalog.Resolve("cashier.apk")
	assert.True(t, ok)
	assert.Equal(t, "TTPOS", appName)
	assert.Equal(t, Target{Platform: "android", Arch: "arm64", Package: "apk"}, target)
}

func TestLoadRejectsInvalid(t *testing.T) {
	tests := []struct {
		name     string
		contents string
	}{
		{
			name:     "malformed json",
			contents: `{not json`,
		},
		{
			name:     "missing owner",
			contents: `{"default_channel": "prod", "aliases": {"a": "App"}, "targets": {"apk": {"platform": "android", "arch": "arm64", "package": "apk"}}}`,
		},
		{
			name:     "missing default_channel",
			contents: `{"owner": "ttpos", "aliases": {"a": "App"}, "targets": {"apk": {"platform": "android", "arch": "arm64", "package": "apk"}}}`,
		},
		{
			name:     "empty aliases",
			contents: `{"owner": "ttpos", "default_channel": "prod", "aliases": {}, "targets": {"apk": {"platform": "android", "arch": "arm64", "package": "apk"}}}`,
		},
		{
			name:     "empty targets",
			contents: `{"owner": "ttpos", "default_channel": "prod", "aliases": {"a": "App"}, "targets": {}}`,
		},
		{
			name:     "alias with empty app name",
			contents: `{"owner": "ttpos", "default_channel": "prod", "aliases": {"a": ""}, "targets": {"apk": {"platform": "android", "arch": "arm64", "package": "apk"}}}`,
		},
		{
			name:     "target missing arch",
			contents: `{"owner": "ttpos", "default_channel": "prod", "aliases": {"a": "App"}, "targets": {"apk": {"platform": "android", "package": "apk"}}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := writeConfig(t, tt.contents)
			catalog, err := Load(path)
			assert.Error(t, err)
			assert.Nil(t, catalog)
		})
	}
}

func TestLoadMissingFile(t *testing.T) {
	catalog, err := Load(filepath.Join(t.TempDir(), "does-not-exist.json"))
	assert.Error(t, err)
	assert.Nil(t, catalog)
}
