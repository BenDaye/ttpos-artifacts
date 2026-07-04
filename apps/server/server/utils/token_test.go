package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestGenerateAPIToken(t *testing.T) {
	token, prefix, hash, err := GenerateAPIToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(token, APITokenPrefix) {
		t.Errorf("token %q should start with %q", token, APITokenPrefix)
	}
	// token = prefix marker + 64 hex chars (32 random bytes)
	if want := len(APITokenPrefix) + 64; len(token) != want {
		t.Errorf("token length = %d, want %d", len(token), want)
	}
	if want := len(APITokenPrefix) + apiTokenPrefixLength; len(prefix) != want {
		t.Errorf("prefix length = %d, want %d", len(prefix), want)
	}
	if !strings.HasPrefix(token, prefix) {
		t.Errorf("token %q should start with its returned prefix %q", token, prefix)
	}
	if hash != HashAPIToken(token) {
		t.Error("returned hash should equal HashAPIToken(token)")
	}
}

func TestGenerateAPITokenIsUnique(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		token, _, _, err := GenerateAPIToken()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if seen[token] {
			t.Fatalf("duplicate token generated: %q", token)
		}
		seen[token] = true
	}
}

func TestHashAPIToken(t *testing.T) {
	if HashAPIToken("abc") != HashAPIToken("abc") {
		t.Error("HashAPIToken must be deterministic")
	}
	if HashAPIToken("a") == HashAPIToken("b") {
		t.Error("different inputs must produce different hashes")
	}
	if got := len(HashAPIToken("anything")); got != 64 {
		t.Errorf("hash hex length = %d, want 64", got)
	}
	// known SHA-256 vector for "hello"
	sum := sha256.Sum256([]byte("hello"))
	if want, got := hex.EncodeToString(sum[:]), HashAPIToken("hello"); got != want {
		t.Errorf("HashAPIToken(\"hello\") = %s, want %s", got, want)
	}
}

func TestIsAPIToken(t *testing.T) {
	cases := map[string]bool{
		"fns_abc123": true,
		"fns_":       true,
		"FNS_abc":    false, // case-sensitive prefix
		"abc_fns_x":  false,
		"":           false,
		"token":      false,
	}
	for in, want := range cases {
		if got := IsAPIToken(in); got != want {
			t.Errorf("IsAPIToken(%q) = %v, want %v", in, got, want)
		}
	}
}
