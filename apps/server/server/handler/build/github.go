package build

import (
	"bytes"
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

// Config holds everything the trigger handler needs. Credentials come from
// deployment config (never committed); when they are absent the dispatcher
// returns a clear error rather than doing anything unsafe.
//
// Two auth modes, in priority order:
//  1. Token: a fine-grained PAT / token with "Actions: read and write" on the
//     repo. Simplest to provision (a ~2 minute GitHub UI step) and sufficient
//     because this feature only ever targets env=test (the prod actor allowlist
//     that motivated a GitHub App is irrelevant here).
//  2. GitHub App (AppID + InstallationID + PrivateKeyPEM): short-lived, rotating
//     installation tokens; preferred for long-term production use.
type Config struct {
	// Token is a PAT/token used directly as the bearer (auth mode 1).
	Token string

	AppID          int64
	InstallationID int64
	PrivateKeyPEM  string
	Owner          string
	Repo           string
	WorkflowFile   string // e.g. "auto-build.yaml"

	// WorkflowRef is the ref IN THIS repo (ttpos-artifacts) that holds the
	// workflow definition to run — almost always "main". It is NOT the source
	// branch to build: that is DispatchInput.Branch (a ttpos-flutter branch)
	// which is passed as the workflow's `branch` INPUT. Conflating the two makes
	// the dispatch fail when the user picks a source branch (e.g. new-test) that
	// does not exist in this repo.
	WorkflowRef string

	// Env->URL mapping. env is always EnvTest, so only the test URLs are used.
	BaseURLTest   string // e.g. https://api.ttpos.dev/api/v1
	BaseWSURLTest string // e.g. wss://api.ttpos.dev/ws

	// PackageAppMap maps a Flutter package (pos/kds/...) to its FaynoSync app
	// name (TTPOS / "TTPOS Kitchen" / ...). Used for app-scope authorization and
	// completion detection. Deployment-provided; if a package is missing here it
	// is treated as unknown (fail-closed).
	PackageAppMap map[string]string

	MaxLegs int
}

// KnownPackages returns the set of packages the deployment can build (keys of
// PackageAppMap).
func (c Config) KnownPackages() map[string]struct{} {
	set := make(map[string]struct{}, len(c.PackageAppMap))
	for pkg := range c.PackageAppMap {
		set[pkg] = struct{}{}
	}
	return set
}

// Configured reports whether the dispatcher has a usable credential and target.
func (c Config) Configured() bool {
	if c.Owner == "" || c.Repo == "" || c.WorkflowFile == "" {
		return false
	}
	if c.Token != "" {
		return true
	}
	return c.AppID != 0 && c.InstallationID != 0 && c.PrivateKeyPEM != ""
}

// DispatchInput is a single workflow_dispatch of auto-build. Phase 1 sends
// single-or-all package/platform (see ResolveDispatch); env is always "test".
type DispatchInput struct {
	Package       string
	Platform      string
	Branch        string
	Env           string
	BaseURL       string
	BaseWSURL     string
	CorrelationID string
}

// Dispatcher triggers the workflow and returns a human-clickable run URL.
type Dispatcher interface {
	Dispatch(ctx context.Context, in DispatchInput) (runURL string, err error)
}

type githubDispatcher struct {
	cfg        Config
	httpClient *http.Client
	apiBase    string // overridable in tests; defaults to githubAPIBase

	mu         sync.Mutex
	cachedTok  string
	cachedTill time.Time
}

// NewDispatcher builds the real GitHub App dispatcher.
func NewDispatcher(cfg Config) Dispatcher {
	return &githubDispatcher{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 20 * time.Second},
		apiBase:    githubAPIBase,
	}
}

const githubAPIBase = "https://api.github.com"

func (g *githubDispatcher) Dispatch(ctx context.Context, in DispatchInput) (string, error) {
	if !g.cfg.Configured() {
		return "", fmt.Errorf("github credentials are not configured; set GITHUB_PAT (or app id/installation id/private key) plus repo owner/name")
	}
	token, err := g.bearerToken(ctx)
	if err != nil {
		return "", err
	}

	// Inputs mirror auto-build.yaml's workflow_dispatch inputs. correlation_id
	// is a NEW input the workflow (Track 2) threads into version + run-name.
	inputs := map[string]string{
		"branch":         in.Branch,
		"env":            in.Env, // always "test" (server constant)
		"package":        in.Package,
		"platform":       in.Platform,
		"base_url":       in.BaseURL,
		"base_ws_url":    in.BaseWSURL,
		"faynosync":      "on",
		"correlation_id": in.CorrelationID,
	}
	// return_run_details asks GitHub to return the created run's URL instead of
	// a bare 204 (GitHub changelog 2026-02). Verify availability on the target
	// GitHub tier at implementation time; older tiers 204 and we fall back to a
	// deep link to the workflow runs list.
	// ref = the workflow-holding branch in THIS repo (default main); the source
	// branch to build (in.Branch, a ttpos-flutter branch) travels only in inputs.
	workflowRef := g.cfg.WorkflowRef
	if workflowRef == "" {
		workflowRef = "main"
	}
	body := map[string]any{
		"ref":                workflowRef,
		"inputs":             inputs,
		"return_run_details": true,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/repos/%s/%s/actions/workflows/%s/dispatches",
		g.apiBase, g.cfg.Owner, g.cfg.Repo, g.cfg.WorkflowFile)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	switch resp.StatusCode {
	case http.StatusNoContent:
		// Old behavior: no run id. Fall back to a deep link to the runs list.
		return g.runsListURL(), nil
	case http.StatusOK:
		// Verified response shape (return_run_details=true, 2026-02):
		// {"workflow_run_id":<id>,"run_url":"<api url>","html_url":"<web url>"}
		var out struct {
			HTMLURL string `json:"html_url"`
			RunURL  string `json:"run_url"`
			URL     string `json:"url"`
		}
		if err := json.Unmarshal(raw, &out); err == nil {
			if out.HTMLURL != "" {
				return out.HTMLURL, nil
			}
			if out.RunURL != "" {
				return out.RunURL, nil
			}
			if out.URL != "" {
				return out.URL, nil
			}
		}
		return g.runsListURL(), nil
	default:
		return "", fmt.Errorf("github dispatch failed: %d %s", resp.StatusCode, string(raw))
	}
}

func (g *githubDispatcher) runsListURL() string {
	return fmt.Sprintf("https://github.com/%s/%s/actions/workflows/%s",
		g.cfg.Owner, g.cfg.Repo, g.cfg.WorkflowFile)
}

// bearerToken returns the credential to use as the Authorization bearer:
// the configured PAT if present, otherwise a (cached) App installation token.
func (g *githubDispatcher) bearerToken(ctx context.Context) (string, error) {
	if g.cfg.Token != "" {
		return g.cfg.Token, nil
	}
	tok, err := g.installationToken(ctx)
	if err != nil {
		return "", fmt.Errorf("obtain installation token: %w", err)
	}
	return tok, nil
}

// installationToken returns a cached installation token, refreshing it when it
// is within 5 minutes of expiry.
func (g *githubDispatcher) installationToken(ctx context.Context) (string, error) {
	g.mu.Lock()
	if g.cachedTok != "" && time.Until(g.cachedTill) > 5*time.Minute {
		tok := g.cachedTok
		g.mu.Unlock()
		return tok, nil
	}
	g.mu.Unlock()

	appJWT, err := g.appJWT()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", g.apiBase, g.cfg.InstallationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("installation token request failed: %d %s", resp.StatusCode, string(raw))
	}
	var out struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	if out.Token == "" {
		return "", fmt.Errorf("installation token response missing token")
	}

	g.mu.Lock()
	g.cachedTok = out.Token
	g.cachedTill = out.ExpiresAt
	g.mu.Unlock()
	return out.Token, nil
}

// appJWT builds a short-lived RS256 App JWT (iss=AppID).
func (g *githubDispatcher) appJWT() (string, error) {
	key, err := parseRSAKey(g.cfg.PrivateKeyPEM)
	if err != nil {
		return "", err
	}
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Issuer:    fmt.Sprintf("%d", g.cfg.AppID),
		IssuedAt:  jwt.NewNumericDate(now.Add(-30 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(9 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(key)
}

func parseRSAKey(pemStr string) (*rsa.PrivateKey, error) {
	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(pemStr))
	if err != nil {
		return nil, fmt.Errorf("parse github app private key: %w", err)
	}
	return key, nil
}
