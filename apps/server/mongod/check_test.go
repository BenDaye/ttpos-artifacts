package mongod

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
