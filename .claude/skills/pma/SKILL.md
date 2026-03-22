---
name: pma
description: Project development lifecycle management with a strict three-phase workflow (investigate -> proposal -> implement), file-based plan tracking in docs/plan/, task tracking in docs/task/, and claim-before-work multi-agent coordination. Use when handling feature development, bug fixes, refactors, planning, progress tracking, or multi-agent execution in an existing codebase.
---

# PMA - Project Management Assistant

Run delivery work with clear gates, minimal diffs, and explicit task/plan tracking.

## Hard Rules

1. All conversation output, generated documents, task files, plan files, commit messages, and PR content MUST be in Chinese. Skill definitions and config files stay in English.
2. Use English filenames only (e.g. `architecture.md`, `changelog.md`).
3. Read before write: inspect call chains, related config/tests, and recent changelog context before editing logic.
4. Make only the minimal requested changes; do not add unrequested refactors or features.
5. Never use plan mode (`EnterPlanMode`, `mode: "plan"`). Manage plans in `docs/plan/` files only.
6. Do not implement before explicit confirmation (`proceed`).

## Three-Phase Workflow

### Phase 1: Investigation

1. Trace upstream/downstream call chains, symbol references, and types.
2. Search related code, config, tests, migrations, and docs.
3. Read the tail of `docs/changelog.md` for recent context.
4. Inbound sync: call `get_context()` then `list_issues()` to discover Kanban issues not yet in `docs/task/index.md`; create local task files for new ones.
5. Find or create the matching task in `docs/task/index.md` and claim it (`[-]`).
   - If creating a new task, also call `create_issue(title, description, priority)` to sync to Kanban.

Non-trivial task rule:
- If the change touches `>=3` files or crosses modules, create `docs/plan/PLAN-NNN.md` and write findings to the context section.

### Phase 2: Proposal

Output these items (in Chinese), then stop for approval:
- Current state
- Proposal
- Risks
- Scope
- Alternatives (if multiple approaches exist)

For non-trivial tasks:
- Complete remaining sections in `PLAN-NNN.md`.
- Append one line to `docs/plan/index.md` with `[ ]`.
- Wait for user annotations and address all of them before implementation.

### Phase 3: Implement -> Verify -> Record

Only after approval:

1. If a plan exists, set plan index marker to `[-]` and detail `status` to `implementing`.
2. Implement step by step according to the approved proposal.
3. Run focused self-verification (compile, test, deploy verification, etc.).
4. Set task index marker to `[x]` and task detail `status` to `completed`.
5. Call `update_issue(issue_id, status: "Done")` to sync completion to Kanban.
6. If a plan exists, set plan index marker to `[x]` and plan detail `status` to `completed`.
7. Update changelog as needed.

## Task and Plan Files

Use these canonical references instead of redefining formats in-place:

- Task format: [docs/task-format.md](docs/task-format.md)
- Plan format: [docs/plan-format.md](docs/plan-format.md)

Required structure:

- `docs/task/index.md`: one-line task entries
- `docs/task/PREFIX-NNN.md`: task detail files
- `docs/plan/index.md`: one-line plan entries
- `docs/plan/PLAN-NNN.md`: plan detail files

## Claim-Before-Work (Multi-Agent Safety)

Before writing any implementation code:

1. Read `docs/task/index.md`; for `[-]` items, read detail `owner`.
2. If another agent owns the in-progress task, skip it (verify via `list_issue_assignees(issue_id)` if Kanban issue exists).
3. Claim atomically:
   - Update task index `[ ] -> [-]`
   - Update task detail `status -> in_progress`, set `owner`
   - Call `update_issue(issue_id, status: "In Progress")`
   - Call `assign_issue(issue_id, user_id)`
4. Start implementation only after the claim is fully written.

On completion:
- Set task index `[-] -> [x]`
- Set task detail `status -> completed`
- Call `update_issue(issue_id, status: "Done")`

On close/won't do:
- Set task index to `[~]`
- Set task detail `status -> closed` and record reason
- Call `update_issue(issue_id, status: "Cancelled")`

## Vibe Kanban MCP Sync

Files (`docs/task/`, `docs/plan/`) are always the primary data source.
Vibe Kanban MCP is the mandatory sync target — every status change MUST be synced to Kanban.
Task status updates are immediate, never deferred.

### Tool Mapping

| PMA Action | Vibe Kanban MCP Tool | Key Parameters |
|------------|---------------------|----------------|
| Get context | `get_context()` | Returns project_id, workspace_id, issue_id |
| List tasks | `list_issues(project_id)` | Filters: `status`, `priority`, `search`, `tag_name`, `assignee_user_id` |
| Read task | `get_issue(issue_id)` | — |
| Create task | `create_issue(title, description, priority)` | priority: `urgent`/`high`/`medium`/`low` |
| Claim task | `update_issue(issue_id, status: "In Progress")` | + `assign_issue(issue_id, user_id)` |
| Complete task | `update_issue(issue_id, status: "Done")` | — |
| Close task | `update_issue(issue_id, status: "Cancelled")` | — |
| Create subtask | `create_issue(title, parent_issue_id)` | Links child to parent issue |
| Tag issue | `add_issue_tag(issue_id, tag_id)` | Tags: bug, feature, enhancement, documentation |
| Link dependency | `create_issue_relationship(issue_id, related_issue_id, type)` | Types: `blocking`, `related`, `has_duplicate` |
| Check assignee | `list_issue_assignees(issue_id)` | Verify ownership before claiming |
| Dispatch workspace | `start_workspace(name, executor, repositories, issue_id)` | + `run_session_prompt(session_id, prompt)` |
| Track execution | `get_execution(execution_id)` | Poll sub-agent progress |
| Archive workspace | `update_workspace(workspace_id, archived: true)` | After task completion |

### Priority Mapping

| PMA | Vibe Kanban |
|-----|-------------|
| P0  | `urgent`    |
| P1  | `high`      |
| P2  | `medium`    |
| P3  | `low`       |

### Status Mapping

| PMA File Status | Index Marker | Vibe Kanban Issue Status |
|----------------|-------------|------------------------|
| `pending`      | `[ ]`       | "Backlog" or "Todo"    |
| `in_progress`  | `[-]`       | "In Progress"          |
| `completed`    | `[x]`       | "Done"                 |
| `closed`       | `[~]`       | "Cancelled"            |

### Sync Protocol

**Inbound (Kanban → files)** — execute on session start:
1. Call `get_context()` to obtain project_id
2. Call `list_issues(project_id)` to fetch all issues
3. Compare against `docs/task/index.md`; create local task files and index entries for new issues

**Outbound (files → Kanban)** — sync immediately on every status change:
- New task → `create_issue(title, description, priority)`
- Claim task → `update_issue(status: "In Progress")` + `assign_issue()`
- Complete task → `update_issue(status: "Done")`
- Close task → `update_issue(status: "Cancelled")`

**MCP unavailable**: continue file-only workflow; state sync skip in progress update.

### Workspace Dispatch

When a task needs an isolated environment or parallel agent execution:
1. `start_workspace(name, executor: "CLAUDE_CODE", repositories: [{repo_id, branch}], issue_id)` — create workspace
2. `link_workspace_issue(workspace_id, issue_id)` — link to issue (if not linked via start_workspace)
3. `run_session_prompt(session_id, prompt)` — dispatch implementation instructions
4. `get_execution(execution_id)` — track execution progress
5. `update_workspace(workspace_id, archived: true)` — archive after completion

### Session Checklist

1. Session start: read `docs/task/index.md`, active task details, `docs/plan/index.md`; execute inbound sync.
2. New task: create detail file first, append index line, then call `create_issue()`.
3. Before work: complete Claim-Before-Work (including MCP sync).
4. Session end: verify all statuses are written to files and synced to Kanban; update index header date.

## Documentation System

Canonical structure:

```text
docs/
├── task/
│   ├── index.md
│   └── PREFIX-NNN.md
├── plan/
│   ├── index.md
│   └── PLAN-NNN.md
├── architecture.md
└── changelog.md
```

- Use Chinese template sections for Chinese-language projects while keeping filenames in English.
- Write investigation findings into the plan context section.
- Do not create extra report files; temporary files go to `./tmp/`.

## Changelog Conventions

Entry format:

```markdown
## YYYY-MM-DD HH:MM [tag]

[content in Chinese]
```

Recommended tags:
- `[进度]`, `[BUG-P0]`, `[BUG-P1]`, `[踩坑]`, `[决策]`

## Project Initialization

On first use in a project:

1. Ensure `docs/task/index.md` exists (initialize from [docs/task-format.md](docs/task-format.md)).
2. Ensure `docs/plan/index.md` exists (initialize from [docs/plan-format.md](docs/plan-format.md)).
3. Ensure `docs/changelog.md` exists.

## PR Workflow

### Creating a PR

1. Analyze **full** commit history from branch point, not just the latest commit.
2. Use `git diff [base-branch]...HEAD` to review all changes.
3. Title: under 70 characters, in Chinese.
4. Body format:
   ```
   ## 概要
   <1-3 bullet points>

   ## 测试计划
   - [ ] <checklist items>
   ```
5. Push with `-u` flag if new branch.

### Auto-Review Before PR

Run these checks automatically before creating or updating a PR:

1. **Code review** — review all changed files.
2. **Security scan** — check for hardcoded secrets, input validation, injection vulnerabilities, error message leaks.
3. **Build verification** — ensure build passes.
4. **Tests** — run test suite; verify no regressions.
5. **Lint** — ensure lint passes with no errors.

If any check fails, fix the issue before creating the PR. Do not skip checks with `--no-verify`.

### PR Review Checklist

Before marking a PR ready for review:

- [ ] All auto-review checks pass (code review, security, build, lint, tests)
- [ ] Commit history is clean (no WIP, fixup, or merge commits)
- [ ] PR description accurately reflects all changes
- [ ] Task status updated in `docs/task/index.md`
- [ ] Plan status updated in `docs/plan/index.md` (if applicable)
- [ ] Changelog updated (if user-facing change)

## CI Pipeline

### Standard Stages

```
lint → typecheck → build → test → security-scan
```

All stages must pass before a PR can be merged. Stages run in parallel where possible.

### CI Rules

- **Never** skip CI checks to unblock a merge.
- **Never** add `[skip ci]` to commit messages unless explicitly requested.
- If CI fails, fix the root cause locally before pushing again — do not iterate by pushing repeated fix attempts.
- Keep CI fast: target under 5 minutes for the full pipeline.
- Secrets in CI use environment secrets, never hardcoded.
- Use `gh run view` or `gh run watch` to check CI status from the terminal.
