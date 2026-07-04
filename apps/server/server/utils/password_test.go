package utils

import "testing"

func TestValidatePasswordStrength(t *testing.T) {
	cases := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{"valid letters and digits", "abcd1234", false},
		{"valid at 8-char boundary", "a1234567", false},
		{"valid unicode letter plus digit", "café1234", false}, // 9 bytes, IsLetter+IsDigit
		{"too short", "ab12", true},
		{"empty", "", true},
		{"seven chars is too short", "abc1234", true},
		{"letters only", "abcdefgh", true},
		{"digits only", "12345678", true},
		{"long but no letter and no digit", "--------", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidatePasswordStrength(c.password)
			if (err != nil) != c.wantErr {
				t.Errorf("ValidatePasswordStrength(%q) error = %v, wantErr %v", c.password, err, c.wantErr)
			}
		})
	}
}
