package utils

import "testing"

func TestIsValidVersion(t *testing.T) {
	valid := []string{
		"0.0.1",
		"1.0.0",
		"0.0.0",
		"999.999.999",
		"1.0.0-alpha",
		"1.0.0-alpha.1",
		"1.0.0-0.3.7",
		"1.0.0-x.7.z.92",
		"1.0.0-alpha+001",
		"1.0.0+20130313144700",
		"1.0.0-beta+exp.sha.5114f85",
		"1.0.0+build.123",
		"10.20.30",
		"1.2.3-beta.1",
		"1.0.0-rc.1",
	}
	for _, v := range valid {
		if !IsValidVersion(v) {
			t.Errorf("expected %q to be valid semver", v)
		}
	}

	invalid := []string{
		"",
		"1",
		"1.0",
		"1.0.0.137",
		"...",
		"---",
		"v1.0.0",
		".1.2.3",
		"1.0.0-",
		"1.0.0+",
		"01.0.0",
		"1.02.0",
		"1.0.03",
		"hello",
		"1.0.0.0",
		"1.0.0-alpha..1",
	}
	for _, v := range invalid {
		if IsValidVersion(v) {
			t.Errorf("expected %q to be invalid semver", v)
		}
	}
}

func TestIsValidAppName(t *testing.T) {
	valid := []string{"testapp", "TTPOS", "TTPOS Go", "my-app", "app123"}
	for _, v := range valid {
		if !IsValidAppName(v) {
			t.Errorf("expected %q to be valid app name", v)
		}
	}

	invalid := []string{"", "app@name", "app/name", "app.name"}
	for _, v := range invalid {
		if IsValidAppName(v) {
			t.Errorf("expected %q to be invalid app name", v)
		}
	}
}

func TestIsValidChannelName(t *testing.T) {
	valid := []string{"", "stable", "beta", "nightly", "prod123"}
	for _, v := range valid {
		if !IsValidChannelName(v) {
			t.Errorf("expected %q to be valid channel name", v)
		}
	}

	invalid := []string{"my-channel", "chan nel", "ch@n"}
	for _, v := range invalid {
		if IsValidChannelName(v) {
			t.Errorf("expected %q to be invalid channel name", v)
		}
	}
}

func TestIsValidPlatformName(t *testing.T) {
	valid := []string{"", "windows", "macos", "android", "macos-arm64"}
	for _, v := range valid {
		if !IsValidPlatformName(v) {
			t.Errorf("expected %q to be valid platform name", v)
		}
	}

	invalid := []string{"win dows", "mac@os"}
	for _, v := range invalid {
		if IsValidPlatformName(v) {
			t.Errorf("expected %q to be invalid platform name", v)
		}
	}
}

func TestIsValidArchName(t *testing.T) {
	valid := []string{"", "amd64", "arm64", "x86"}
	for _, v := range valid {
		if !IsValidArchName(v) {
			t.Errorf("expected %q to be valid arch name", v)
		}
	}

	invalid := []string{"x86-64", "arm 64"}
	for _, v := range invalid {
		if IsValidArchName(v) {
			t.Errorf("expected %q to be invalid arch name", v)
		}
	}
}
