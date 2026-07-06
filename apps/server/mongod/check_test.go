package mongod

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestNormalizeAppIdentifier(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected string
	}{
		{name: "space", value: "TTPOS Kitchen", expected: "ttpos_kitchen"},
		{name: "already snake", value: "ttpos_kitchen", expected: "ttpos_kitchen"},
		{name: "mixed separators", value: " TTPOS---Go  ", expected: "ttpos_go"},
		{name: "digits", value: "TTPOS 2 KDS", expected: "ttpos_2_kds"},
		{name: "punctuation only", value: " --- ", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, NormalizeAppIdentifier(tt.value))
		})
	}
}

func TestSelectAppMetaByNormalizedIdentifier(t *testing.T) {
	kitchenID := primitive.NewObjectID()
	candidates := []latestAppMeta{
		{ID: primitive.NewObjectID(), AppName: "TTPOS"},
		{ID: kitchenID, AppName: "TTPOS Kitchen"},
	}

	match, err := selectAppMetaByNormalizedIdentifier(candidates, "ttpos_kitchen")

	require.NoError(t, err)
	assert.Equal(t, kitchenID, match.ID)
	assert.Equal(t, "TTPOS Kitchen", match.AppName)
}

func TestSelectAppMetaByNormalizedIdentifierNotFound(t *testing.T) {
	_, err := selectAppMetaByNormalizedIdentifier([]latestAppMeta{
		{ID: primitive.NewObjectID(), AppName: "TTPOS"},
	}, "missing_app")

	assert.True(t, errors.Is(err, ErrAppNameNotFound))
}

func TestSelectAppMetaByNormalizedIdentifierAmbiguous(t *testing.T) {
	_, err := selectAppMetaByNormalizedIdentifier([]latestAppMeta{
		{ID: primitive.NewObjectID(), AppName: "TTPOS Kitchen"},
		{ID: primitive.NewObjectID(), AppName: "TTPOS-Kitchen"},
	}, "ttpos_kitchen")

	assert.True(t, errors.Is(err, ErrAppIdentifierAmbiguous))
}

func TestNormalizePackage(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected string
	}{
		// 库内原始形态带前导点小写（阶段 0 生产实测），归一目标必须保留点。
		{name: "bare lower", value: "apk", expected: ".apk"},
		{name: "bare upper", value: "APK", expected: ".apk"},
		{name: "already dotted", value: ".dmg", expected: ".dmg"},
		{name: "dotted upper", value: ".EXE", expected: ".exe"},
		{name: "surrounding space", value: "  exe ", expected: ".exe"},
		{name: "empty", value: "", expected: ""},
		{name: "space only", value: "   ", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, normalizePackage(tt.value))
		})
	}
}

func TestTargetArtifactElemMatch(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()

	clause := targetArtifactElemMatch(platformID, archID, "apk")

	elem, ok := clause["$elemMatch"].(bson.M)
	require.True(t, ok, "expected $elemMatch clause")

	// platform/arch 必须是 apps_meta ObjectID（$match 跑在 getBasePipeline 名字映射之前），
	// 写成名字会让选版阶段全部漏配。
	assert.Equal(t, platformID, elem["platform"])
	assert.Equal(t, archID, elem["arch"])

	// package 必须等于 normalizePackage 的归一结果（库内原始形态，带点）。
	assert.Equal(t, normalizePackage("apk"), elem["package"])
	assert.Equal(t, ".apk", elem["package"])

	// link 非空条件必须与 platform/arch/package 同处一个 $elemMatch 子文档，
	// 否则幽灵 artifact（无 link）或跨 artifact 拼条件都可能选错版本。
	link, ok := elem["link"].(bson.M)
	require.True(t, ok, "expected link clause")
	assert.Equal(t, true, link["$exists"])
	assert.Equal(t, "", link["$ne"])
}

func TestTargetArtifactElemMatchRejectsMismatchedSubdocument(t *testing.T) {
	platformID := primitive.NewObjectID()
	archID := primitive.NewObjectID()
	otherArchID := primitive.NewObjectID()

	clause := targetArtifactElemMatch(platformID, archID, "apk")
	elem := clause["$elemMatch"].(bson.M)

	matches := func(artifact bson.M) bool {
		if artifact["platform"] != elem["platform"] || artifact["arch"] != elem["arch"] {
			return false
		}
		if artifact["package"] != elem["package"] {
			return false
		}
		link, _ := artifact["link"].(string)
		return link != ""
	}

	// 正样本：同一子文档四条件齐备。
	assert.True(t, matches(bson.M{"platform": platformID, "arch": archID, "package": ".apk", "link": "https://example.test/a.apk"}))
	// 负样本：有 android 但该 artifact 无 link（幽灵）。
	assert.False(t, matches(bson.M{"platform": platformID, "arch": archID, "package": ".apk", "link": ""}))
	// 负样本：有 android 但 package 不符。
	assert.False(t, matches(bson.M{"platform": platformID, "arch": archID, "package": ".txt", "link": "https://example.test/a.txt"}))
	// 负样本：platform 对但 arch 不符（有 android 但缺 arm64）。
	assert.False(t, matches(bson.M{"platform": platformID, "arch": otherArchID, "package": ".apk", "link": "https://example.test/a.apk"}))
}
