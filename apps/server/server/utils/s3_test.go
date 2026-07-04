package utils

import "testing"

// TestGetContentType 锁定按后缀推断 Content-Type 的行为。
// 重点回归:安装包(尤其 .apk)必须显式返回可安装包 MIME,
// 否则上传时留空会被对象存储按 ZIP 容器嗅探成 application/zip。
func TestGetContentType(t *testing.T) {
	cases := []struct {
		name     string
		fileName string
		want     string
	}{
		{"apk lowercase", "TTPOS Shop-2.24.5.apk", "application/vnd.android.package-archive"},
		{"apk uppercase ext", "app.APK", "application/vnd.android.package-archive"},
		{"exe", "setup.exe", "application/octet-stream"},
		{"msi", "installer.msi", "application/octet-stream"},
		{"dmg", "app.dmg", "application/octet-stream"},
		{"pkg", "app.pkg", "application/octet-stream"},
		{"ipa", "app.ipa", "application/octet-stream"},
		{"yaml", "latest.yaml", "text/yaml"},
		{"yml", "latest.yml", "text/yaml"},
		{"releases sentinel", "releases", "text/plain"},
		{"unknown falls through", "notes.txt", ""},
		{"no extension", "binary", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := getContentType(tc.fileName); got != tc.want {
				t.Errorf("getContentType(%q) = %q, want %q", tc.fileName, got, tc.want)
			}
		})
	}
}
