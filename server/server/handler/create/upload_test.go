package create

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvalidateCacheDeletesExactAndNormalizedAppNameKeys(t *testing.T) {
	ctx := context.Background()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	exactKey := "owner=ttpos&app_name=TTPOS Kitchen&version=&channel=prod&platform=android&arch=arm64&package=apk"
	normalizedKey := "owner=ttpos&app_name=ttpos_kitchen&version=&channel=prod&platform=android&arch=arm64&package=apk"
	otherKey := "owner=ttpos&app_name=TTPOS Shop&version=&channel=prod&platform=android&arch=arm64&package=apk"

	require.NoError(t, rdb.Set(ctx, exactKey, "exact", 0).Err())
	require.NoError(t, rdb.Set(ctx, normalizedKey, "normalized", 0).Err())
	require.NoError(t, rdb.Set(ctx, otherKey, "other", 0).Err())

	err := InvalidateCache(ctx, map[string]interface{}{
		"app_name": "TTPOS Kitchen",
		"channel":  "prod",
	}, rdb)

	require.NoError(t, err)
	assert.False(t, mr.Exists(exactKey))
	assert.False(t, mr.Exists(normalizedKey))
	assert.True(t, mr.Exists(otherKey))
}
