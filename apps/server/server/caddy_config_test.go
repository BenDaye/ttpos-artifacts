package server

import (
	"os"
	"strings"
	"testing"
)

// TestCaddyRouteContract pins what the repo's Caddy site fragment must still
// own after the /dl short links moved back into the API (ENH-020 / PLAN-043):
// the /mcp path, the API fallback, and nothing short-link shaped.
func TestCaddyRouteContract(t *testing.T) {
	data, err := os.ReadFile("../../../deploy/Caddyfile")
	if err != nil {
		t.Fatalf("read Caddyfile: %v", err)
	}
	caddyfile := string(data)

	assertOrdered(t, caddyfile,
		"handle /mcp*",
		"reverse_proxy faynosync-mcp:3010",
		"handle {\n\t\t\treverse_proxy faynosync-api:9000",
	)
}

// TestCaddyHasNoShortLinkTable guards against the short link table creeping back
// into the reverse proxy. It lived there until ENH-020; every entry cost a
// release plus a hand edit on two hosts, which is exactly what moving the
// mapping onto each app's short_link field was meant to end. A rewrite rule
// here would silently shadow the API route and reintroduce that cost.
func TestCaddyHasNoShortLinkTable(t *testing.T) {
	data, err := os.ReadFile("../../../deploy/Caddyfile")
	if err != nil {
		t.Fatalf("read Caddyfile: %v", err)
	}
	caddyfile := string(data)

	for _, forbidden := range []string{
		"handle /dl/*",
		"short_latest",
		"/apps/latest",
		"resolve=artifact-latest",
		"unsupported short latest download target",
	} {
		assertNotContains(t, caddyfile, forbidden)
	}
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

func assertNotContains(t *testing.T, haystack, needle string) {
	t.Helper()

	if strings.Contains(haystack, needle) {
		t.Fatalf("unexpected %q", needle)
	}
}
