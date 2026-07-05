package server

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

type shortLatestMapping struct {
	app      string
	platform string
	arch     string
	pkg      string
}

var expectedShortLatestMappings = map[string]shortLatestMapping{
	"cashier.apk":   {app: "ttpos", platform: "android", arch: "arm64", pkg: "apk"},
	"cashier.exe":   {app: "ttpos", platform: "windows", arch: "amd64", pkg: "exe"},
	"cashier.dmg":   {app: "ttpos", platform: "macos", arch: "arm64", pkg: "dmg"},
	"assistant.apk": {app: "ttpos_go", platform: "android", arch: "arm64", pkg: "apk"},
	"assistant.exe": {app: "ttpos_go", platform: "windows", arch: "amd64", pkg: "exe"},
	"assistant.dmg": {app: "ttpos_go", platform: "macos", arch: "arm64", pkg: "dmg"},
	"menu.apk":      {app: "ttpos_menu", platform: "android", arch: "arm64", pkg: "apk"},
	"menu.exe":      {app: "ttpos_menu", platform: "windows", arch: "amd64", pkg: "exe"},
	"menu.dmg":      {app: "ttpos_menu", platform: "macos", arch: "arm64", pkg: "dmg"},
	"kitchen.apk":   {app: "ttpos_kitchen", platform: "android", arch: "arm64", pkg: "apk"},
	"kitchen.exe":   {app: "ttpos_kitchen", platform: "windows", arch: "amd64", pkg: "exe"},
	"kitchen.dmg":   {app: "ttpos_kitchen", platform: "macos", arch: "arm64", pkg: "dmg"},
	"shop.apk":      {app: "ttpos_shop", platform: "android", arch: "arm64", pkg: "apk"},
	"shop.exe":      {app: "ttpos_shop", platform: "windows", arch: "amd64", pkg: "exe"},
	"shop.dmg":      {app: "ttpos_shop", platform: "macos", arch: "arm64", pkg: "dmg"},
}

func TestCaddyShortLatestRouteContract(t *testing.T) {
	data, err := os.ReadFile("../../../deploy/Caddyfile")
	if err != nil {
		t.Fatalf("read Caddyfile: %v", err)
	}
	caddyfile := string(data)

	assertOrdered(t, caddyfile,
		"handle /mcp*",
		"handle /dl/*",
		"handle {\n\t\t\treverse_proxy faynosync-api:9000",
	)
	assertNotContains(t, caddyfile, "{short_latest_query}")
	assertContains(t, caddyfile, "@known_short_latest `{short_latest_app} != \"\"`")
	assertContains(t, caddyfile, "respond \"unsupported short latest download target\" 400")

	mappings := parseShortLatestMappings(t, caddyfile)
	if len(mappings) != len(expectedShortLatestMappings) {
		t.Fatalf("short latest mapping count = %d, want %d", len(mappings), len(expectedShortLatestMappings))
	}
	for target, want := range expectedShortLatestMappings {
		got, ok := mappings[target]
		if !ok {
			t.Fatalf("missing /dl/%s mapping", target)
		}
		if got != want {
			t.Fatalf("/dl/%s mapping = %+v, want %+v", target, got, want)
		}
	}
	for target := range mappings {
		if _, ok := expectedShortLatestMappings[target]; !ok {
			t.Fatalf("unexpected /dl/%s mapping", target)
		}
	}

	assertContains(t, caddyfile, "rewrite * /apps/latest?owner=ttpos&app_name={short_latest_app}&channel=prod&platform={short_latest_platform}&arch={short_latest_arch}&package={short_latest_package}")
	assertContains(t, caddyfile, "Cloudflare-CDN-Cache-Control \"public, max-age=300\"")
	assertContains(t, caddyfile, "Cache-Control \"no-cache\"")
	assertContains(t, caddyfile, "match status 3xx")
	assertContains(t, caddyfile, "Cloudflare-CDN-Cache-Control \"no-store\"")
	assertContains(t, caddyfile, "Cache-Control \"no-store\"")
	assertContains(t, caddyfile, "match status 4xx 5xx")
}

func parseShortLatestMappings(t *testing.T, caddyfile string) map[string]shortLatestMapping {
	t.Helper()

	linePattern := regexp.MustCompile(`(?m)^\s*~\(\?i\)\^/dl/([a-z]+)\\\.(apk|exe|dmg)\$\s+([a-z0-9_]+)\s+([a-z]+)\s+([a-z0-9]+)\s+([a-z]+)\s*$`)
	matches := linePattern.FindAllStringSubmatch(caddyfile, -1)
	mappings := make(map[string]shortLatestMapping, len(matches))
	for _, match := range matches {
		target := match[1] + "." + match[2]
		if _, exists := mappings[target]; exists {
			t.Fatalf("duplicate /dl/%s mapping", target)
		}
		mappings[target] = shortLatestMapping{
			app:      match[3],
			platform: match[4],
			arch:     match[5],
			pkg:      match[6],
		}
	}
	return mappings
}

func assertOrdered(t *testing.T, haystack string, needles ...string) {
	t.Helper()

	lastIndex := -1
	for _, needle := range needles {
		index := strings.Index(haystack, needle)
		if index == -1 {
			t.Fatalf("missing %q", needle)
		}
		if index <= lastIndex {
			t.Fatalf("%q appears before the expected route order", needle)
		}
		lastIndex = index
	}
}

func assertContains(t *testing.T, haystack, needle string) {
	t.Helper()

	if !strings.Contains(haystack, needle) {
		t.Fatalf("missing %q", needle)
	}
}

func assertNotContains(t *testing.T, haystack, needle string) {
	t.Helper()

	if strings.Contains(haystack, needle) {
		t.Fatalf("unexpected %q", needle)
	}
}
