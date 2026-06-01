// Package shortlink holds the runtime-configurable catalog that backs the
// public short download links (GET /dl/:target). The catalog is loaded from a
// JSON config file at startup so the deployment owner, channel and the alias /
// target tables are no longer hardcoded in the handler package.
package shortlink

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// Target captures the platform defaults that a short alias extension resolves
// to (e.g. "apk" -> android/arm64/apk).
type Target struct {
	Platform string `json:"platform"`
	Arch     string `json:"arch"`
	Package  string `json:"package"`
}

// Catalog is the parsed short-link configuration. Owner and DefaultChannel are
// shared by every alias; Aliases maps a public alias (e.g. "cashier") to an app
// name, and Targets maps a file extension to its platform defaults.
type Catalog struct {
	Owner          string            `json:"owner"`
	DefaultChannel string            `json:"default_channel"`
	Aliases        map[string]string `json:"aliases"`
	Targets        map[string]Target `json:"targets"`
}

// Load reads and validates a catalog config file. A nil error guarantees a
// usable, non-empty catalog. Alias and target keys are normalized to lower case
// so lookups stay case-insensitive (matching the request-side normalization in
// Resolve).
func Load(path string) (*Catalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read short latest config %q: %w", path, err)
	}

	var catalog Catalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		return nil, fmt.Errorf("parse short latest config %q: %w", path, err)
	}

	catalog.normalize()

	if err := catalog.validate(); err != nil {
		return nil, fmt.Errorf("invalid short latest config %q: %w", path, err)
	}

	return &catalog, nil
}

// normalize lower-cases the lookup keys so config authoring is case-insensitive.
func (c *Catalog) normalize() {
	if len(c.Aliases) > 0 {
		aliases := make(map[string]string, len(c.Aliases))
		for alias, appName := range c.Aliases {
			aliases[strings.ToLower(alias)] = appName
		}
		c.Aliases = aliases
	}

	if len(c.Targets) > 0 {
		targets := make(map[string]Target, len(c.Targets))
		for ext, target := range c.Targets {
			targets[strings.ToLower(ext)] = target
		}
		c.Targets = targets
	}
}

// validate rejects configs that would leave /dl serving nothing or producing
// malformed redirects.
func (c *Catalog) validate() error {
	if strings.TrimSpace(c.Owner) == "" {
		return fmt.Errorf("owner is required")
	}
	if strings.TrimSpace(c.DefaultChannel) == "" {
		return fmt.Errorf("default_channel is required")
	}
	if len(c.Aliases) == 0 {
		return fmt.Errorf("at least one alias is required")
	}
	if len(c.Targets) == 0 {
		return fmt.Errorf("at least one target is required")
	}

	for alias, appName := range c.Aliases {
		if strings.TrimSpace(appName) == "" {
			return fmt.Errorf("alias %q maps to an empty app name", alias)
		}
	}

	for ext, target := range c.Targets {
		if strings.TrimSpace(target.Platform) == "" ||
			strings.TrimSpace(target.Arch) == "" ||
			strings.TrimSpace(target.Package) == "" {
			return fmt.Errorf("target %q must set platform, arch and package", ext)
		}
	}

	return nil
}
