package mongod

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestMetaDiscriminatorField(t *testing.T) {
	tests := []struct {
		keyType  string
		expected string
	}{
		{keyType: "channel", expected: "channel_name"},
		{keyType: "platform", expected: "platform_name"},
		{keyType: "arch", expected: "arch_id"},
		{keyType: "app", expected: "app_name"},
		{keyType: "unknown", expected: ""},
		{keyType: "", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.keyType, func(t *testing.T) {
			assert.Equal(t, tt.expected, metaDiscriminatorField(tt.keyType))
		})
	}
}

func TestNextSortValue(t *testing.T) {
	zero := 0
	five := 5
	negative := -1

	tests := []struct {
		name     string
		maxSort  *int
		expected int
	}{
		{name: "无任何带 sort 文档", maxSort: nil, expected: 0},
		{name: "max 为 0(已有一个带 sort 文档)", maxSort: &zero, expected: 1},
		{name: "max 为 5", maxSort: &five, expected: 6},
		{name: "max 为负(防御)", maxSort: &negative, expected: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, nextSortValue(tt.maxSort))
		})
	}
}

// makeExistingSet 用一组 ObjectID 构造存在性集合。
func makeExistingSet(ids ...primitive.ObjectID) map[primitive.ObjectID]struct{} {
	set := make(map[primitive.ObjectID]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	return set
}

func TestComputeReorderAssignmentsHappyPath(t *testing.T) {
	a := primitive.NewObjectID()
	b := primitive.NewObjectID()
	c := primitive.NewObjectID()
	existing := makeExistingSet(a, b, c)

	// 客户端给的顺序是 c, a, b。
	got, err := computeReorderAssignments([]string{c.Hex(), a.Hex(), b.Hex()}, existing)
	require.NoError(t, err)
	require.Len(t, got, 3)

	assert.Equal(t, reorderAssignment{ID: c, Sort: 0}, got[0])
	assert.Equal(t, reorderAssignment{ID: a, Sort: 1}, got[1])
	assert.Equal(t, reorderAssignment{ID: b, Sort: 2}, got[2])
}

func TestComputeReorderAssignmentsInvalidHex(t *testing.T) {
	a := primitive.NewObjectID()
	existing := makeExistingSet(a)

	_, err := computeReorderAssignments([]string{"not-a-valid-hex"}, existing)
	assert.ErrorIs(t, err, ErrReorderInvalidID)
}

func TestComputeReorderAssignmentsDuplicate(t *testing.T) {
	a := primitive.NewObjectID()
	b := primitive.NewObjectID()
	existing := makeExistingSet(a, b)

	_, err := computeReorderAssignments([]string{a.Hex(), b.Hex(), a.Hex()}, existing)
	assert.ErrorIs(t, err, ErrReorderDuplicateID)
}

func TestComputeReorderAssignmentsUnknownID(t *testing.T) {
	a := primitive.NewObjectID()
	b := primitive.NewObjectID()
	outsider := primitive.NewObjectID()
	existing := makeExistingSet(a, b)

	// outsider 是合法 hex 但不在作用域内 → 拒绝。
	_, err := computeReorderAssignments([]string{a.Hex(), outsider.Hex()}, existing)
	assert.ErrorIs(t, err, ErrReorderUnknownIDs)
}

func TestComputeReorderAssignmentsEmpty(t *testing.T) {
	got, err := computeReorderAssignments(nil, makeExistingSet())
	require.NoError(t, err)
	assert.Empty(t, got)
}
