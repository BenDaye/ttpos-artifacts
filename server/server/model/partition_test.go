package model

import (
	"reflect"
	"testing"
)

func links(artifacts []Artifact) []string {
	out := make([]string, 0, len(artifacts))
	for _, a := range artifacts {
		out = append(out, a.Link)
	}
	return out
}

func TestPartitionArtifactsByLink(t *testing.T) {
	artifacts := []Artifact{
		{Link: "a.dmg"},
		{Link: "b.deb"},
		{Link: "c.exe"},
	}

	t.Run("删中间一个只删它且保留顺序", func(t *testing.T) {
		kept, deleted := PartitionArtifactsByLink(artifacts, []string{"b.deb"})
		if want := []string{"a.dmg", "c.exe"}; !reflect.DeepEqual(links(kept), want) {
			t.Fatalf("kept = %v, want %v", links(kept), want)
		}
		if want := []string{"b.deb"}; !reflect.DeepEqual(deleted, want) {
			t.Fatalf("deleted = %v, want %v", deleted, want)
		}
	})

	t.Run("删不存在的 link 不删任何", func(t *testing.T) {
		kept, deleted := PartitionArtifactsByLink(artifacts, []string{"missing.zip"})
		if want := []string{"a.dmg", "b.deb", "c.exe"}; !reflect.DeepEqual(links(kept), want) {
			t.Fatalf("kept = %v, want %v", links(kept), want)
		}
		if len(deleted) != 0 {
			t.Fatalf("deleted = %v, want empty", deleted)
		}
	})

	t.Run("多 link 一次删多个", func(t *testing.T) {
		kept, deleted := PartitionArtifactsByLink(artifacts, []string{"a.dmg", "c.exe"})
		if want := []string{"b.deb"}; !reflect.DeepEqual(links(kept), want) {
			t.Fatalf("kept = %v, want %v", links(kept), want)
		}
		if want := []string{"a.dmg", "c.exe"}; !reflect.DeepEqual(deleted, want) {
			t.Fatalf("deleted = %v, want %v", deleted, want)
		}
	})

	t.Run("删光所有 artifact 时 kept 为空", func(t *testing.T) {
		// 对应 delete.go 把 nil kept 兜成 []Artifact{} 的分支:删光时 kept 必须为空,
		// 不能残留,deletedLinks 含全部。
		kept, deleted := PartitionArtifactsByLink(artifacts, []string{"a.dmg", "b.deb", "c.exe"})
		if len(kept) != 0 {
			t.Fatalf("kept = %v, want empty", links(kept))
		}
		if want := []string{"a.dmg", "b.deb", "c.exe"}; !reflect.DeepEqual(deleted, want) {
			t.Fatalf("deleted = %v, want %v", deleted, want)
		}
	})

	t.Run("空 links 原样返回不删", func(t *testing.T) {
		kept, deleted := PartitionArtifactsByLink(artifacts, nil)
		if !reflect.DeepEqual(links(kept), []string{"a.dmg", "b.deb", "c.exe"}) {
			t.Fatalf("kept = %v, want all", links(kept))
		}
		if deleted != nil {
			t.Fatalf("deleted = %v, want nil", deleted)
		}
	})
}
