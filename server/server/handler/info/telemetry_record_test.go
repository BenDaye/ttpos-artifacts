package info

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
)

func newDeviceIDContext(t *testing.T, header, remoteAddr, userAgent string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/checkVersion", nil)
	if header != "" {
		req.Header.Set("X-Device-ID", header)
	}
	if userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
	}
	if remoteAddr != "" {
		req.RemoteAddr = remoteAddr
	}
	c.Request = req
	return c
}

func TestResolveDeviceIDPrefersHeader(t *testing.T) {
	c := newDeviceIDContext(t, "explicit-device", "203.0.113.5:1111", "TTPOS/1.0")
	assert.Equal(t, "explicit-device", resolveDeviceID(c))
}

func TestResolveDeviceIDFallbackIsStableAndPseudonymous(t *testing.T) {
	a := resolveDeviceID(newDeviceIDContext(t, "", "203.0.113.5:1111", "TTPOS/1.0"))
	b := resolveDeviceID(newDeviceIDContext(t, "", "203.0.113.5:2222", "TTPOS/1.0"))
	c := resolveDeviceID(newDeviceIDContext(t, "", "198.51.100.9:1111", "TTPOS/1.0"))
	d := resolveDeviceID(newDeviceIDContext(t, "", "203.0.113.5:1111", "Other/2.0"))

	assert.True(t, len(a) > len("anon-"))
	assert.Contains(t, a, "anon-")
	// Same IP + UA (port ignored by ClientIP) -> same id.
	assert.Equal(t, a, b)
	// Different IP or UA -> different id.
	assert.NotEqual(t, a, c)
	assert.NotEqual(t, a, d)
	// Never leaks the raw IP/UA.
	assert.NotContains(t, a, "203.0.113.5")
	assert.NotContains(t, a, "TTPOS/1.0")
}

func TestResolveTelemetryDateRange(t *testing.T) {
	now := time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC)

	today, err := resolveTelemetryDateRange("today", "", now)
	assert.NoError(t, err)
	assert.Equal(t, []string{"2026-06-03"}, today)

	week, err := resolveTelemetryDateRange("week", "", now)
	assert.NoError(t, err)
	assert.Len(t, week, 8) // inclusive of both endpoints
	assert.Equal(t, "2026-05-27", week[0])
	assert.Equal(t, "2026-06-03", week[len(week)-1])

	month, err := resolveTelemetryDateRange("month", "", now)
	assert.NoError(t, err)
	assert.Len(t, month, 31)

	_, err = resolveTelemetryDateRange("decade", "", now)
	assert.Error(t, err)

	// Empty range falls back to explicit date, or today.
	explicit, err := resolveTelemetryDateRange("", "2026-01-15", now)
	assert.NoError(t, err)
	assert.Equal(t, []string{"2026-01-15"}, explicit)

	fallback, err := resolveTelemetryDateRange("", "", now)
	assert.NoError(t, err)
	assert.Equal(t, []string{"2026-06-03"}, fallback)
}

func TestCachedUpdateAvailable(t *testing.T) {
	assert.True(t, cachedUpdateAvailable(map[string]interface{}{"update_available": true}))
	assert.False(t, cachedUpdateAvailable(map[string]interface{}{"update_available": false}))
	assert.False(t, cachedUpdateAvailable(map[string]interface{}{}))
	assert.False(t, cachedUpdateAvailable("not-a-map"))
	assert.False(t, cachedUpdateAvailable(nil))
}

func TestTrackClientTelemetryRecordsMetrics(t *testing.T) {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	ctx := context.Background()
	date := time.Now().UTC().Format("2006-01-02")

	params := map[string]interface{}{
		"owner":    "ownerA",
		"app_name": "appA",
		"version":  "1.0.0",
		"platform": "android",
		"arch":     "arm64",
		"channel":  "prod",
	}

	// Outdated client (an update is available).
	trackClientTelemetry(ctx, client, params, true, "dev-1")

	base := "stats:ownerA:appA"
	requests, _ := client.Get(ctx, base+":requests:"+date).Result()
	assert.Equal(t, "1", requests)
	assert.True(t, mustSIsMember(t, client, base+":unique_clients:"+date, "dev-1"))
	assert.True(t, mustSIsMember(t, client, base+":channels:"+date+":prod", "dev-1"))
	assert.True(t, mustSIsMember(t, client, base+":platforms:"+date+":android", "dev-1"))
	assert.True(t, mustSIsMember(t, client, base+":architectures:"+date+":arm64", "dev-1"))
	assert.True(t, mustSIsMember(t, client, base+":known_versions", "1.0.0"))
	assert.True(t, mustSIsMember(t, client, base+":version_usage:"+date+":1.0.0", "dev-1"))
	assert.True(t, mustSIsMember(t, client, base+":clients_outdated:"+date, "dev-1"))
	assert.False(t, mustSIsMember(t, client, base+":clients_using_latest_version:"+date, "dev-1"))

	// Up-to-date client (no update available) lands in the latest set.
	trackClientTelemetry(ctx, client, params, false, "dev-2")
	assert.True(t, mustSIsMember(t, client, base+":clients_using_latest_version:"+date, "dev-2"))
	assert.False(t, mustSIsMember(t, client, base+":clients_outdated:"+date, "dev-2"))

	requests, _ = client.Get(ctx, base+":requests:"+date).Result()
	assert.Equal(t, "2", requests)
}

func TestTrackClientTelemetrySkipsWhenNoClient(t *testing.T) {
	// Must not panic when redis is unavailable.
	assert.NotPanics(t, func() {
		trackClientTelemetry(context.Background(), nil, map[string]interface{}{
			"owner": "o", "app_name": "a", "version": "1", "platform": "p", "arch": "x", "channel": "c",
		}, true, "dev")
	})
}

func mustSIsMember(t *testing.T, client *redis.Client, key, member string) bool {
	t.Helper()
	ok, err := client.SIsMember(context.Background(), key, member).Result()
	if err != nil {
		t.Fatalf("SIsMember(%s,%s): %v", key, member, err)
	}
	return ok
}
