package mongod

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

// TestGetBasePipelineFiltersGhostArtifacts 守护 BUG-016 的修复:
// 当某版本删光全部构建物后 artifacts 为空数组，getBasePipeline 中的
// $unwind(preserveNullAndEmptyArrays)+$addFields+$group 会凭空产生一个空对象 {}，
// 前端渲染成 "Unknown platform / Unknown architecture"。修复在 $group 之后追加
// 一个按 link 过滤的 $filter，把幽灵空对象剔除。该测试断言这个 $filter 仍在，
// 防止有人回退修复。行为正确性（空版本→[]、满版本原样保留）已在真实数据上验证。
func TestGetBasePipelineFiltersGhostArtifacts(t *testing.T) {
	pipeline := (&appRepository{}).getBasePipeline()

	found := false
	for _, stage := range pipeline {
		for _, elem := range stage {
			if elem.Key != "$addFields" {
				continue
			}
			raw, err := bson.MarshalExtJSON(elem.Value, false, false)
			if err != nil {
				t.Fatalf("marshal $addFields stage: %v", err)
			}
			text := string(raw)
			if strings.Contains(text, "$filter") && strings.Contains(text, "artifacts") && strings.Contains(text, "link") {
				found = true
			}
		}
	}

	if !found {
		t.Fatal("getBasePipeline 必须在 $group 后通过 $filter(按 link)剔除空 artifacts 数组产生的幽灵对象，否则删光构建物的版本会显示 Unknown platform/architecture")
	}
}
