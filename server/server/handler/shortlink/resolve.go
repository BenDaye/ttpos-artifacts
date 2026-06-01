package shortlink

import "strings"

// Resolve maps a short target token such as "cashier.apk" to its configured app
// name and platform target. It mirrors the previous handler.resolveShortLatestTarget
// behavior exactly: the token is lower-cased, split on the last dot, and both the
// alias and extension must exist in the catalog. A leading dot (empty alias) or a
// trailing dot (empty extension) is rejected.
func (c *Catalog) Resolve(target string) (appName string, t Target, ok bool) {
	normalized := strings.ToLower(target)
	dotIndex := strings.LastIndex(normalized, ".")
	if dotIndex <= 0 || dotIndex == len(normalized)-1 {
		return "", Target{}, false
	}

	alias := normalized[:dotIndex]
	extension := normalized[dotIndex+1:]

	appName, ok = c.Aliases[alias]
	if !ok {
		return "", Target{}, false
	}

	t, ok = c.Targets[extension]
	if !ok {
		return "", Target{}, false
	}

	return appName, t, true
}
