# PLAN-042 Keep build status across private routes

- **status**: completed
- **task**: BUG-022
- **createdAt**: 2026-07-10

## Context

PLAN-041 moved "Build Test Package" to `/applications`, which corrected the information architecture. The residual risk is that the status sheet and polling state still live inside `ApplicationsPage`. When that route unmounts, the user loses the active status surface.

Current implementation facts:

- `ApplicationsPage` owns `buildTriggering`, `buildStatusOpen`, and `buildResponse`.
- `BuildStatusSheet` polls via `useBuildCompletion` only when `open && correlationId`.
- `_private` renders `AppShell`, which persists across private route navigation and is the natural owner for private-route activity UI.
- The app already uses TanStack Query for server state and Zustand for UI-only client state.

External guidance used in the proposal:

- TanStack Query supports polling with `refetchInterval`, so completion polling should remain query-owned.
- TanStack Router search params are best for serializable URL state, not full build payloads.
- Zustand is appropriate for UI interaction state and can persist bounded state to `sessionStorage`.

## Proposal

1. Add a small build activity store for the active build:
   - `activeBuild`: `correlationId`, `targets`, `runUrl`, `startedAt`.
   - `statusOpen`: whether the shell-level status sheet is open.
   - actions to set active build, open/close the sheet, and clear stale build state.
2. Persist only the active build metadata in `sessionStorage` with a 30-minute TTL. Do not persist `statusOpen`.
3. Move `BuildStatusSheet` ownership from `ApplicationsPage` to an `AppShell`-mounted controller.
4. Keep `TriggerBuildDialog` in `ApplicationsPage`; on success it writes the active build to the store and opens the shell sheet.
5. Clear the active build on sign-out.

## Scope

In scope:

- Frontend store/controller changes.
- Applications trigger handoff to global build activity.
- Focused e2e coverage for cross-route reopen and logout clearing.
- PMA docs and changelog.

Out of scope:

- Server API changes.
- Workflow changes.
- New backend job history.
- Multi-build queue/history.
- URL search-param deep linking for full target payloads.
- Changes to `useBuildCompletion` polling semantics.

## Test plan

Use TDD:

1. Add an e2e test that triggers a build on `/applications`, navigates to app detail, reopens the global status sheet, and asserts the target/platform/Actions run link remain visible.
2. Add logout coverage that proves active build state is cleared after sign-out.
3. Run the focused e2e command and verify RED before production changes.
4. Implement minimal code and rerun focused e2e plus web typecheck/build/lint as appropriate.

## Risks

- Shell-level UI can clutter the top bar. Mitigation: show a compact icon button only when an active build exists.
- Persisting build metadata can show stale builds after refresh. Mitigation: sessionStorage plus 30-minute TTL aligned to `BUILD_TIMEOUT_MS`.
- Query polling should not run forever. Mitigation: the existing sheet still controls visible polling; stale active build cleanup removes old entries.

## Verification

- RED: `bun run test:e2e -- applications.spec.ts:176` failed because no `Build Status` shell button existed after leaving `/applications`.
- GREEN: `bun run test:e2e -- applications.spec.ts:176` passed.
- Focused regression: `bun run test:e2e -- applications.spec.ts app-detail.spec.ts responsive-layout.spec.ts` passed 58/58.
- Static: `bunx turbo typecheck --filter @ttpos/web` passed.
- Lint: `bun run lint` exited 0 with 6 pre-existing warnings outside this change.
- Whitespace: `git diff --check` passed.
