package build

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// TriggerLimiter is a NEW in-memory limiter for the build-trigger endpoint.
// It is NOT a reuse of utils.IPRateLimiter (that one keys on client IP and
// cannot express per-user limits). Two guards:
//   - per-user cooldown (primary throttle)
//   - a global hourly ceiling (backstop)
//
// KNOWN LIMITATION (PLAN-040 §3 step 5 / Rec5): state is in-memory and assumes a
// SINGLE server replica. Under multiple replicas the effective limit multiplies
// by replica count; migrate to Redis (server.go already wires a client) if the
// server is ever scaled out. Global-ceiling starvation (one abuser exhausting
// the hourly budget) is an accepted Phase-1 limitation; per-user is the primary
// throttle, global is a high backstop.
type TriggerLimiter struct {
	mu       sync.Mutex
	users    map[string]*userEntry
	perUser  rate.Limit
	perBurst int
	global   *rate.Limiter
	ttl      time.Duration
	done     chan struct{}
}

type userEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewTriggerLimiter builds a limiter allowing one trigger per perUserInterval
// per user (burst perUserBurst) and globalPerHour triggers per hour overall.
func NewTriggerLimiter(perUserInterval time.Duration, perUserBurst, globalPerHour int) *TriggerLimiter {
	tl := &TriggerLimiter{
		users:    make(map[string]*userEntry),
		perUser:  rate.Every(perUserInterval),
		perBurst: perUserBurst,
		global:   rate.NewLimiter(rate.Every(time.Hour/time.Duration(max(globalPerHour, 1))), globalPerHour),
		ttl:      2 * time.Hour,
		done:     make(chan struct{}),
	}
	go tl.cleanupLoop()
	return tl
}

func (t *TriggerLimiter) Close() { close(t.done) }

// AllowGlobal reports whether the global hourly budget permits one more trigger.
func (t *TriggerLimiter) AllowGlobal() bool {
	return t.global.Allow()
}

// AllowUser reports whether the given user is within their per-user cooldown.
func (t *TriggerLimiter) AllowUser(username string) bool {
	return t.getUser(username).Allow()
}

func (t *TriggerLimiter) getUser(username string) *rate.Limiter {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.users) > 10000 {
		for k := range t.users {
			delete(t.users, k)
			if len(t.users) <= 5000 {
				break
			}
		}
	}
	entry, ok := t.users[username]
	if !ok {
		entry = &userEntry{limiter: rate.NewLimiter(t.perUser, t.perBurst), lastSeen: time.Now()}
		t.users[username] = entry
		return entry.limiter
	}
	entry.lastSeen = time.Now()
	return entry.limiter
}

func (t *TriggerLimiter) cleanupLoop() {
	ticker := time.NewTicker(t.ttl)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			t.mu.Lock()
			for k, e := range t.users {
				if time.Since(e.lastSeen) > t.ttl {
					delete(t.users, k)
				}
			}
			t.mu.Unlock()
		case <-t.done:
			return
		}
	}
}
