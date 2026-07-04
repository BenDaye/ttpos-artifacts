package updaters

import (
	"faynoSync/server/model"
	"mime/multipart"
	"testing"
)

func TestValidateUpdater(t *testing.T) {
	for _, typ := range ValidUpdaterTypes {
		if err := ValidateUpdater(model.Updater{Type: typ}); err != nil {
			t.Errorf("ValidateUpdater(%q) unexpected error: %v", typ, err)
		}
	}
	invalid := []string{"", "unknown", "Manual", "squirrel", "tauri2", "electron_builder"}
	for _, typ := range invalid {
		if err := ValidateUpdater(model.Updater{Type: typ}); err == nil {
			t.Errorf("ValidateUpdater(%q) expected error, got nil", typ)
		}
	}
}

func TestValidateUpdaters(t *testing.T) {
	cases := []struct {
		name     string
		updaters []model.Updater
		wantErr  bool
	}{
		{"empty list", nil, true},
		{"single valid default", []model.Updater{{Type: "manual", Default: true}}, false},
		{"valid pair with one default", []model.Updater{{Type: "manual", Default: true}, {Type: "tauri"}}, false},
		{"no default", []model.Updater{{Type: "manual"}}, true},
		{"two defaults", []model.Updater{{Type: "manual", Default: true}, {Type: "tauri", Default: true}}, true},
		{"duplicate type", []model.Updater{{Type: "manual", Default: true}, {Type: "manual"}}, true},
		{"invalid type alongside valid", []model.Updater{{Type: "manual", Default: true}, {Type: "bogus"}}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := ValidateUpdaters(c.updaters); (err != nil) != c.wantErr {
				t.Errorf("ValidateUpdaters() error = %v, wantErr %v", err, c.wantErr)
			}
		})
	}
}

// CreateFileValidator routes by prefix to a concrete validator type. Assert on the
// concrete type (not GetUpdaterType, which merely echoes the input) so a broken switch
// would actually fail this test.
func TestCreateFileValidatorRouting(t *testing.T) {
	cases := []struct {
		updaterType string
		want        string // concrete type name expected
		match       func(FileValidator) bool
	}{
		{"electron-builder", "*ElectronBuilderFileValidator", func(v FileValidator) bool { _, ok := v.(*ElectronBuilderFileValidator); return ok }},
		{"electron-builder-x64", "*ElectronBuilderFileValidator", func(v FileValidator) bool { _, ok := v.(*ElectronBuilderFileValidator); return ok }}, // prefix routing
		{"squirrel_windows", "*SquirrelWindowsFileValidator", func(v FileValidator) bool { _, ok := v.(*SquirrelWindowsFileValidator); return ok }},
		{"squirrel_darwin", "*SquirrelDarwinFileValidator", func(v FileValidator) bool { _, ok := v.(*SquirrelDarwinFileValidator); return ok }},
		{"manual", "*NoOpFileValidator", func(v FileValidator) bool { _, ok := v.(*NoOpFileValidator); return ok }},
		{"tauri", "*NoOpFileValidator", func(v FileValidator) bool { _, ok := v.(*NoOpFileValidator); return ok }}, // no file validator -> NoOp default
	}
	for _, c := range cases {
		v, err := CreateFileValidator(c.updaterType)
		if err != nil {
			t.Fatalf("CreateFileValidator(%q) error: %v", c.updaterType, err)
		}
		if !c.match(v) {
			t.Errorf("CreateFileValidator(%q) = %T, want %s", c.updaterType, v, c.want)
		}
	}
}

// ValidateFiles dispatches to the routed validator's real Validate logic.
func TestValidateFilesBehaviorByType(t *testing.T) {
	zip := []*multipart.FileHeader{{Filename: "App.ZIP"}}        // case-insensitive .zip
	releases := []*multipart.FileHeader{{Filename: "RELEASES"}} // case-insensitive RELEASES
	other := []*multipart.FileHeader{{Filename: "app.dmg"}}

	if err := ValidateFiles(zip, "squirrel_darwin"); err != nil {
		t.Errorf("squirrel_darwin with a zip should pass: %v", err)
	}
	if err := ValidateFiles(other, "squirrel_darwin"); err == nil {
		t.Error("squirrel_darwin without a zip should fail")
	}
	if err := ValidateFiles(releases, "squirrel_windows"); err != nil {
		t.Errorf("squirrel_windows with RELEASES should pass: %v", err)
	}
	if err := ValidateFiles(other, "squirrel_windows"); err == nil {
		t.Error("squirrel_windows without RELEASES should fail")
	}
	if err := ValidateFiles(other, "manual"); err != nil {
		t.Errorf("manual (NoOp) should accept any files: %v", err)
	}
	if err := ValidateFiles(other, ""); err != nil {
		t.Errorf("empty updater type should short-circuit to no-op: %v", err)
	}
}

// CreateParamValidator routes tauri to the signature-requiring validator, everything else to NoOp.
func TestCreateParamValidatorAndValidate(t *testing.T) {
	v, err := CreateParamValidator("tauri")
	if err != nil {
		t.Fatalf("CreateParamValidator(tauri) error: %v", err)
	}
	if _, ok := v.(*TauriParamValidator); !ok {
		t.Errorf("CreateParamValidator(tauri) = %T, want *TauriParamValidator", v)
	}
	if err := v.ValidateParams(map[string]interface{}{"signature": "sig"}); err != nil {
		t.Errorf("tauri with signature should pass: %v", err)
	}
	if err := v.ValidateParams(map[string]interface{}{}); err == nil {
		t.Error("tauri without signature should fail")
	}
	if err := v.ValidateParams(map[string]interface{}{"signature": ""}); err == nil {
		t.Error("tauri with empty signature should fail")
	}

	nv, err := CreateParamValidator("manual")
	if err != nil {
		t.Fatalf("CreateParamValidator(manual) error: %v", err)
	}
	if _, ok := nv.(*NoOpParamValidator); !ok {
		t.Errorf("CreateParamValidator(manual) = %T, want *NoOpParamValidator", nv)
	}
	if err := nv.ValidateParams(map[string]interface{}{}); err != nil {
		t.Errorf("NoOp param validator should accept anything: %v", err)
	}

	// ValidateParams helper short-circuits on empty updater type.
	if err := ValidateParams(map[string]interface{}{}, ""); err != nil {
		t.Errorf("empty updater type should skip param validation: %v", err)
	}
}
