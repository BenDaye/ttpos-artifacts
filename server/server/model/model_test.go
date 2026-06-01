package model

import (
	"encoding/json"
	"reflect"
	"sort"
	"testing"
)

// topLevelKeys marshals v to JSON and returns its sorted top-level object keys.
// 用于把对外 JSON 契约的 key 集合固化为回归基线(零信任修复:补 json 标签后锁定 wire)。
func topLevelKeys(t *testing.T, v interface{}) []string {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	return objectKeys(t, raw)
}

func objectKeys(t *testing.T, raw json.RawMessage) []string {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("unmarshal to map failed: %v", err)
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func assertKeys(t *testing.T, name string, got, want []string) {
	t.Helper()
	sort.Strings(want)
	if !reflect.DeepEqual(got, want) {
		t.Errorf("%s json key 集合 = %v, want %v", name, got, want)
	}
}

func TestAppJSONContract(t *testing.T) {
	// Owner/Private 已由 SEC-007 收紧为 json:"-",不再进 wire;Tuf 仍按默认 key 输出。
	assertKeys(t, "App", topLevelKeys(t, App{}),
		[]string{"ID", "AppName", "Logo", "Tuf", "Description", "Updated_at"})
}

func TestChannelJSONContract(t *testing.T) {
	assertKeys(t, "Channel", topLevelKeys(t, Channel{}),
		[]string{"ID", "ChannelName", "Updated_at"})
}

func TestPlatformJSONContract(t *testing.T) {
	// Updaters 不加 omitempty:nil 时仍输出 "Updaters":null,与现状一致。
	assertKeys(t, "Platform", topLevelKeys(t, Platform{}),
		[]string{"ID", "PlatformName", "Updaters", "Updated_at"})
}

func TestArchJSONContract(t *testing.T) {
	// 关键:json key 必须是 Go 字段名 ArchID,而非 bson 的 arch_id。
	assertKeys(t, "Arch", topLevelKeys(t, Arch{}),
		[]string{"ID", "ArchID", "Updated_at"})
}

func TestPermissionsJSONContract(t *testing.T) {
	raw, err := json.Marshal(Permissions{})
	if err != nil {
		t.Fatalf("marshal Permissions failed: %v", err)
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal(raw, &top); err != nil {
		t.Fatalf("unmarshal Permissions failed: %v", err)
	}

	assertKeys(t, "Permissions", topLevelKeys(t, Permissions{}),
		[]string{"Apps", "Channels", "Platforms", "Archs"})

	// Allowed 不带 omitempty:nil 时仍输出 "Allowed":null。
	assertKeys(t, "Permissions.Apps", objectKeys(t, top["Apps"]),
		[]string{"Create", "Delete", "Edit", "Download", "Upload", "Allowed"})
	for _, grp := range []string{"Channels", "Platforms", "Archs"} {
		assertKeys(t, "Permissions."+grp, objectKeys(t, top[grp]),
			[]string{"Create", "Delete", "Edit", "Allowed"})
	}
}
