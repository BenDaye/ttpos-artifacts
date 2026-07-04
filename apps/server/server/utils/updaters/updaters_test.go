package updaters

import (
	"testing"

	"github.com/gin-gonic/gin"
)

func TestBuildResponseSquirrelDarwin(t *testing.T) {
	// no update and no rollback -> 204 no_content
	if resp, code := BuildResponse(gin.H{}, false, false, "", "squirrel_darwin"); code != 204 || resp["status"] != "no_content" {
		t.Errorf("no update: got %v/%d, want no_content/204", resp, code)
	}

	// found with update_url_zip -> rename to "url", drop other update_url_* keys, keep the rest
	in := gin.H{
		"update_url_zip": "https://example.com/app.zip",
		"update_url_dmg": "https://example.com/app.dmg",
		"version":        "1.2.3",
	}
	resp, code := BuildResponse(in, true, false, "", "squirrel_darwin")
	if code != 200 {
		t.Fatalf("got code %d, want 200", code)
	}
	if resp["url"] != "https://example.com/app.zip" {
		t.Errorf("url = %v, want the zip url", resp["url"])
	}
	if _, ok := resp["update_url_dmg"]; ok {
		t.Error("other update_url_* fields must be excluded")
	}
	if _, ok := resp["update_url_zip"]; ok {
		t.Error("update_url_zip must be renamed away")
	}
	if resp["version"] != "1.2.3" {
		t.Errorf("non update_url_ fields must be preserved, version = %v", resp["version"])
	}

	// found but missing the zip url -> 204
	if _, code := BuildResponse(gin.H{"update_url_dmg": "x"}, true, false, "", "squirrel_darwin"); code != 204 {
		t.Errorf("missing zip url should give 204, got %d", code)
	}
}

func TestBuildResponseSquirrelWindows(t *testing.T) {
	resp, code := BuildResponse(gin.H{"update_url": "https://example.com/RELEASES"}, true, false, "", "squirrel_windows")
	if code != 302 || resp["status"] != "redirect" || resp["url"] != "https://example.com/RELEASES" {
		t.Errorf("got %v/%d, want redirect to RELEASES url / 302", resp, code)
	}
}

func TestBuildResponseElectronBuilder(t *testing.T) {
	if _, code := BuildResponse(gin.H{}, false, false, "", "electron-builder"); code != 204 {
		t.Errorf("no update should be 204, got %d", code)
	}
	resp, code := BuildResponse(gin.H{"update_url_yml": "https://example.com/latest.yml"}, true, false, "", "electron-builder")
	if code != 302 || resp["status"] != "redirect" || resp["url"] != "https://example.com/latest.yml" {
		t.Errorf("got %v/%d, want yml redirect / 302", resp, code)
	}
	if _, code := BuildResponse(gin.H{"update_url": "x"}, true, false, "", "electron-builder"); code != 204 {
		t.Errorf("missing yml should be 204, got %d", code)
	}
}

func TestBuildResponseTauri(t *testing.T) {
	if _, code := BuildResponse(gin.H{}, false, false, "1.0.0", "tauri"); code != 204 {
		t.Errorf("no update should be 204, got %d", code)
	}
	in := gin.H{
		"changelog":  "fixed bugs",
		"update_url": "https://example.com/app.tar.gz",
		"signature":  "sig-data",
		"irrelevant": "drop-me",
	}
	resp, code := BuildResponse(in, true, false, "2.0.0", "tauri")
	if code != 200 {
		t.Fatalf("got code %d, want 200", code)
	}
	if resp["version"] != "2.0.0" {
		t.Errorf("version = %v, want 2.0.0", resp["version"])
	}
	if resp["notes"] != "fixed bugs" {
		t.Errorf("notes = %v, want the changelog value", resp["notes"])
	}
	if resp["url"] != "https://example.com/app.tar.gz" {
		t.Errorf("url = %v, want the update_url value", resp["url"])
	}
	if resp["signature"] != "sig-data" {
		t.Errorf("signature = %v, want sig-data", resp["signature"])
	}
	if _, ok := resp["irrelevant"]; ok {
		t.Error("unmapped fields must be dropped from the tauri response")
	}
}

func TestBuildResponseSparkleAndDefault(t *testing.T) {
	if resp, code := BuildResponse(gin.H{}, true, false, "", "sparkle"); code != 200 || resp["status"] != "test_stub" || resp["updater"] != "sparkle" {
		t.Errorf("sparkle stub mismatch: %v/%d", resp, code)
	}
	in := gin.H{"foo": "bar"}
	resp, code := BuildResponse(in, true, false, "", "some_unknown_type")
	if code != 200 || resp["foo"] != "bar" {
		t.Errorf("default branch should pass the response through with 200, got %v/%d", resp, code)
	}
}
