// Package ownership centralizes the deployment's single owner namespace.
//
// This deployment is single-owner: there is exactly one owner, configured once
// at startup from DEPLOYMENT_OWNER. Every owner-scoped read and write uses that
// one owner; the caller's identity governs only permission (RBAC), never
// namespace. The owner lives here in exactly one place so no handler re-derives
// it — historically that per-handler derivation was duplicated with slightly
// different semantics, which let artifacts land under the wrong owner and the
// /dl short link miss them.
//
// During first-boot bootstrap the owner may be empty (no admin exists yet);
// startup only permits an empty owner until the first admin is created, after
// which DEPLOYMENT_OWNER is mandatory (see server.StartServer).
package ownership

import "strings"

// owner holds the deployment-wide single owner. It is written once by Configure
// at startup and only read thereafter.
var owner string

// Configure sets the deployment-wide single owner. Call once at startup, before
// the server accepts requests.
func Configure(deploymentOwner string) {
	owner = strings.TrimSpace(deploymentOwner)
}

// Owner returns the deployment-wide single owner. Every owner-scoped handler
// uses this instead of deriving an owner from the caller, so the namespace is a
// single constant rather than a per-request derivation.
func Owner() string { return owner }
