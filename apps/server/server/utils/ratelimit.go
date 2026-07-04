package utils

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type IPRateLimiter struct {
	ips     map[string]*rateLimiterEntry
	mu      sync.Mutex
	r       rate.Limit
	b       int
	cleanup time.Duration
	done    chan struct{}
}

type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	rl := &IPRateLimiter{
		ips:     make(map[string]*rateLimiterEntry),
		r:       r,
		b:       b,
		cleanup: 10 * time.Minute,
		done:    make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

func (i *IPRateLimiter) Close() {
	close(i.done)
}

func (i *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	if len(i.ips) > 10000 {
		for ip := range i.ips {
			delete(i.ips, ip)
			if len(i.ips) <= 5000 {
				break
			}
		}
	}

	entry, exists := i.ips[ip]
	if !exists {
		entry = &rateLimiterEntry{
			limiter:  rate.NewLimiter(i.r, i.b),
			lastSeen: time.Now(),
		}
		i.ips[ip] = entry
		return entry.limiter
	}
	entry.lastSeen = time.Now()
	return entry.limiter
}

func (i *IPRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(i.cleanup)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			i.mu.Lock()
			for ip, entry := range i.ips {
				if time.Since(entry.lastSeen) > i.cleanup {
					delete(i.ips, ip)
				}
			}
			i.mu.Unlock()
		case <-i.done:
			return
		}
	}
}

func RateLimitMiddleware(limiter *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !limiter.getLimiter(c.ClientIP()).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, please try again later"})
			return
		}
		c.Next()
	}
}
