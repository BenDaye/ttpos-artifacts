---
name: pma
description: Project development lifecycle management with a strict three-phase workflow (investigate -> proposal -> implement), file-based plan tracking in docs/plan/, task tracking in docs/task/, and claim-before-work multi-agent coordination. Optionally integrates with Vibe Kanban MCP for issue-driven dispatch and status sync. Use when handling feature development, bug fixes, refactors, planning, progress tracking, or multi-agent execution in an existing codebase.
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

## Kanban Bootstrap (Session Start)

On every session start, attempt to detect Vibe Kanban MCP availability:

1. Call `get_context()`.
   - **Success** → MCP is available. Cache `workspace_id`, `project_id`, `issue_id` from the response.
   - **Failure / tool not found** → MCP is unavailable. Continue with file-only mode.
2. If MCP is available but `project_id` is null:
   - Call `list_organizations()` → `list_projects(organization_id)` to discover the project.
   - Cache the discovered `project_id` for the rest of the session.
3. If MCP is available:
   - Call `list_issues(project_id)` to fetch all remote issues.
   - Compare against `docs/task/index.md`; create local task files for new remote issues.

After bootstrap, a session-scoped flag `kanban_available` (true/false) determines whether Kanban sync steps execute or are silently skipped throughout the workflow.

## Agent Role Detection

After Kanban Bootstrap, determine the agent's role based on `get_context()`:

- **`issue_id` is non-null** → **Implementer Mode**: this workspace was dispatched to implement a specific issue. Skip directly to the [Implementer Protocol](#implementer-protocol-dispatched-agents).
- **`issue_id` is null** → **Orchestrator Mode**: this is the user's workspace. Follow the full [Three-Phase Workflow](#three-phase-workflow) below.

**This detection is critical.** Dispatched agents must NOT re-enter the three-phase workflow or attempt further task decomposition. They receive a complete implementation spec in the issue description and should implement it directly.

## Three-Phase Workflow

> **Applies only to Orchestrator Mode** (`issue_id` is null).

### Phase 1: Investigation

1. Trace upstream/downstream call chains, symbol references, and types.
2. Search related code, config, tests, migrations, and docs.
3. Read the tail of `docs/changelog.md` for recent context.
4. Find or create the matching task in `docs/task/index.md` and claim it (`[-]`).
   - If creating a new task: create detail file first → append index line → **if `kanban_available`**: call `create_issue(title, description, priority, project_id)` and record `issue_id` in the detail file.

Non-trivial task rule:
- If the change touches `>=3` files or crosses modules, create `docs/plan/PLAN-NNN.md` and write findings to the context section.

### Phase 2: Proposal & Decomposition

Output these items (in Chinese), then stop for approval:
- Current state
- Proposal
- **Sub-task breakdown** (if task involves ≥2 independent changes)
- Risks
- Scope
- Alternatives (if multiple approaches exist)

For non-trivial tasks:
- Complete remaining sections in `PLAN-NNN.md`.
- Append one line to `docs/plan/index.md` with `[ ]`.
- Wait for user annotations and address all of them before implementation.

**Decomposition rule**: if the task can be split into independently-implementable sub-tasks (e.g. separate files, separate features, separate layers), list them explicitly in the proposal. Each sub-task should be dispatchable to a separate workspace.

### Phase 3: Implement -> Verify -> Record

Only after explicit approval (`proceed`):

1. If a plan exists, set plan index marker to `[-]` and detail `status` to `implementing`.

2. **Choose execution mode** based on `kanban_available`:

   **Mode A — Kanban Dispatch** (when `kanban_available` is true):

   a. Create the **parent issue** (if not exists): `create_issue(title, description, priority, project_id)`.
      - **`project_id` is required** — use the cached value from bootstrap.

   b. **For each sub-task** in the approved proposal:
      1. Create a **sub-issue**: `create_issue(title, description, priority, project_id, parent_issue_id)`.
         - The `description` MUST follow the [Issue Description Template](#issue-description-template) — this is the agent's ONLY prompt.
         - Include: goal, files to modify, patterns to follow, acceptance criteria, and verification commands.
      2. Obtain `repo_id` and `branch` from `get_context().workspace_repos`.
      3. Dispatch: `start_workspace(name: "<parent-id>/<sub-task-id>", executor: "CLAUDE_CODE", repositories: [{repo_id, branch}], issue_id: sub_issue_id)`.
         - Sub-issue status automatically moves to `In Progress`.
      4. Record `workspace_id` in the task detail file under a `## 执行` section.

   c. **Monitor** all dispatched workspaces:
      - Use `get_execution(execution_id)` to poll status periodically.
      - Report progress to user.
      - To provide additional instructions: `create_session(workspace_id, executor: "CLAUDE_CODE")` → `run_session_prompt(session_id, prompt)`.
        **Always specify `executor: "CLAUDE_CODE"` explicitly** — the default is unreliable.

   d. **After all sub-workspaces complete**:
      - Review each workspace's diff for correctness.
      - Resolve any cross-workspace conflicts (merge branches if needed).
      - Run full verification (build, lint, test).
      - Set task file `status` to `completed`, index marker to `[x]`.
      - For each sub-issue: verify status is "Done" (the implementer should have done this).
      - Complete the **parent issue**: `update_issue(parent_issue_id, status: "Done")`.
      - Archive all workspaces: `update_workspace(workspace_id, archived: true)`.

   **If the task is a single leaf task** (no decomposition needed):
   - Create the issue with a complete description following the template.
   - Dispatch a single workspace with `issue_id`.
   - Monitor → verify → complete as above.

   **Mode B — Local Implementation** (when `kanban_available` is false):
   a. Implement step by step in the current session according to the approved proposal.
   b. Run focused self-verification (compile, test, etc.).
   c. Set task file `status` to `completed`, index marker to `[x]`.

3. If a plan exists, set plan index marker to `[x]` and detail `status` to `completed`.
4. Update changelog as needed.

## Implementer Protocol (Dispatched Agents)

> **Applies only to Implementer Mode** (`issue_id` is non-null).
> Dispatched agents **MUST NOT** create further sub-issues or dispatch further workspaces.

When a workspace is created from an issue via `start_workspace`, the agent in that workspace follows this protocol:

### Step 1: Understand the Task

1. Call `get_context()` → extract `issue_id`.
2. Call `get_issue(issue_id)` → read the issue `description` as the implementation spec.
3. The description contains: goal, files to modify, patterns, acceptance criteria, and verification commands.

### Step 2: Investigate (Quick, Targeted)

1. Read ONLY the files mentioned in the issue description.
2. Understand existing patterns in those files.
3. Do NOT create task files (`docs/task/`) or plan files (`docs/plan/`) — the orchestrator manages those.

### Step 3: Implement

1. Make the code changes as specified.
2. Follow existing code style and patterns.
3. Make only the changes described — no unrequested refactors.

### Step 4: Verify

Run the verification commands listed in the issue description. At minimum:
1. `yarn build` (or equivalent) — must pass.
2. `yarn lint` (or equivalent) — must pass.
3. Any specific test commands mentioned.

### Step 5: Commit & Complete

1. Stage changed files: `git add <specific files>` (never `git add -A`).
2. Commit with **conventional commits** format: `feat: <中文描述>` (or `fix:`, `refactor:`, etc.).
   - Example: `feat: 添加应用列表页多维筛选功能`
   - Do NOT use free-form messages. The type prefix is mandatory.
3. **Call `update_issue(issue_id, status: "Done")` via Vibe Kanban MCP** — this step is mandatory and must not be skipped.
4. Do NOT archive the workspace — the orchestrator handles that.

### What Implementers Must NOT Do

- Do NOT create sub-issues or dispatch sub-workspaces.
- Do NOT create `docs/task/` or `docs/plan/` files.
- Do NOT wait for user approval — the orchestrator already approved.
- Do NOT run the full three-phase PMA workflow.
- Do NOT push to remote — the orchestrator handles integration.

## Issue Description Template

When creating issues for workspace dispatch, the description MUST be a self-contained implementation spec. The dispatched agent receives ONLY this description as its prompt.

```markdown
## 目标
[一句话描述要实现什么]

## 背景
[相关的代码上下文，现有模式，API 信息]

## 实现要求
- [具体要求 1]
- [具体要求 2]
- [具体要求 3]

## 涉及文件
- `path/to/file1.ts` — [要做什么修改]
- `path/to/file2.ts` — [要做什么修改]

## 参考模式
[指向现有代码中可参考的模式，如 "参考 src/hooks/use-query/useAppsQuery.ts 中 useAppsQuery 的写法"]

## 验收标准
- [ ] [标准 1]
- [ ] [标准 2]

## 验证命令
- `yarn build` — 编译通过
- `yarn lint` — 无 lint 错误
```

**Effective descriptions are specific.** Bad: "实现筛选功能". Good: "在 Dashboard.tsx 中添加 Channel/Platform/Architecture 三个 Select 筛选框，使用 shadcn/ui Select 组件，筛选状态通过 useState 管理，筛选逻辑调用 useFilteredApps hook".

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
2. If another agent owns the in-progress task, skip it.
   - **If `kanban_available`**: verify via `list_issue_assignees(issue_id)`.
3. Claim atomically:
   - Update task index `[ ] -> [-]`
   - Update task detail `status -> in_progress`, set `owner`
   - **If `kanban_available`**: call `update_issue(issue_id, status: "In Progress")` + `assign_issue(issue_id, user_id)`
4. Start implementation only after the claim is fully written.

On completion:
- Set task index `[-] -> [x]`, detail `status -> completed`
- **If `kanban_available`**: call `update_issue(issue_id, status: "Done")`

On close/won't do:
- Set task index to `[~]`, detail `status -> closed` with reason
- **If `kanban_available`**: call `update_issue(issue_id, status: "Cancelled")`

## Vibe Kanban MCP Integration (Pluggable)

Vibe Kanban MCP is an **optional but preferred** integration. When available, it provides:
- Issue-driven workspace dispatch (Issue → Workspace → Session)
- Automatic status transitions (`start_workspace` or `link_workspace_issue` → issue moves to `In Progress`)
- Multi-agent orchestration via workspace dispatch
- Issue metadata: tags, relationships (`blocking`/`related`/`has_duplicate`), assignees, sub-issues

Files (`docs/task/`, `docs/plan/`) are **always** the primary data source regardless of MCP availability.

### Issue-First Workflow (Recommended)

The correct Vibe Kanban usage flow is Issue-Driven:
```
Organization → Project → Issue → Workspace → Session
```

- **Issue** is the fundamental work unit — its title+description becomes the agent prompt.
- **Workspace** is created **from** an Issue, not independently.
- Creating a workspace linked to an issue **automatically** moves the issue to `In Progress`.
- One issue can have **multiple workspaces** (parallel agent execution).
- Workspaces without issues are only for quick ad-hoc queries, not formal tasks.

### Tool Reference

| PMA Action | Vibe Kanban MCP Tool | Notes |
|------------|---------------------|-------|
| Discover project | `list_organizations()` → `list_projects(org_id)` | Run once per session |
| Sync issues | `list_issues(project_id)` | **`project_id` required**; filterable by status, priority, search, assignee, tag_name, tag_id, parent_issue_id, simple_id |
| Read issue | `get_issue(issue_id)` | Returns full detail including sub_issues, relationships, tags, assignees |
| Create issue | `create_issue(title, description, priority, project_id)` | **Always pass `project_id`** |
| Create subtask | `create_issue(title, parent_issue_id, project_id)` | Links child to parent; **`project_id` still required** |
| Update issue | `update_issue(issue_id, ...)` | Can update title, description, status, priority, parent_issue_id |
| Claim issue | `update_issue(issue_id, status: "In Progress")` | + `assign_issue(issue_id, user_id)` |
| Complete issue | `update_issue(issue_id, status: "Done")` | Parent must be completed **manually** (see constraints) |
| Close issue | `update_issue(issue_id, status: "Cancelled")` | — |
| Dispatch workspace | `start_workspace(name, executor, repositories, issue_id)` | **Must pass `issue_id` or `prompt`** (see constraints) |
| Link workspace to issue | `link_workspace_issue(workspace_id, issue_id)` | Also triggers auto status → `In Progress` |
| Add session | `create_session(workspace_id)` → `run_session_prompt(session_id, prompt)` | **Always pass `executor: "CLAUDE_CODE"`** to `create_session` |
| Track progress | `get_execution(execution_id)` | Poll status |
| Archive workspace | `update_workspace(workspace_id, archived: true)` | **Use archive, not delete** (see constraints) |
| Tags | `list_tags(project_id)`, `add_issue_tag(issue_id, tag_id)`, `remove_issue_tag(issue_tag_id)` | `list_issue_tags(issue_id)` to inspect |
| Relationships | `create_issue_relationship(issue_id, related_issue_id, relationship_type)` | Types: `blocking`, `related`, `has_duplicate` |
| Delete relationship | `delete_issue_relationship(relationship_id)` | Get relationship_id from `get_issue()` |
| Assignees | `assign_issue(issue_id, user_id)`, `unassign_issue(issue_assignee_id)` | `list_issue_assignees(issue_id)` to get `issue_assignee_id` |
| Members | `list_org_members(organization_id)` | To discover `user_id` for assignment |

### Known Constraints

These constraints are verified through E2E testing. Violating them causes errors or unexpected behavior:

1. **`project_id` is always required explicitly**
   - `create_issue()` and `list_issues()` require `project_id` as a parameter.
   - `get_context()` may return `project_id: null` if the workspace was not created from a project context.
   - **Fallback**: always run `list_organizations()` → `list_projects(org_id)` to discover and cache `project_id`.

2. **`start_workspace` requires `prompt` OR `issue_id`**
   - Calling `start_workspace` without both `prompt` and `issue_id` returns HTTP 400: *"Provide prompt, or issue_id that has a non-empty title/description."*
   - **Preferred**: always pass `issue_id` (Issue-First pattern). The issue's title+description becomes the agent prompt.

3. **`create_session` executor defaults are unreliable**
   - If `executor` is omitted, the system may default to a different executor (e.g. CODEX instead of CLAUDE_CODE).
   - **Always specify `executor: "CLAUDE_CODE"` explicitly** when creating sessions.

4. **Auto status transitions (multiple triggers)**
   - `start_workspace(issue_id)` automatically moves the linked issue to `In Progress`.
   - `link_workspace_issue(workspace_id, issue_id)` **also** triggers the same auto-transition.
   - Do **not** manually call `update_issue(status: "In Progress")` after these operations — it is redundant.

5. **Sub-issues are status-independent from parent**
   - Completing all child issues does **NOT** auto-complete the parent issue.
   - The parent issue status must be updated **manually** via `update_issue(issue_id, status: "Done")`.
   - Similarly, completing a parent does not cascade to children.

6. **Workspace deletion vs archiving**
   - `delete_workspace()` fails with HTTP 409 Conflict if a session execution is still running.
   - **Always use `update_workspace(workspace_id, archived: true)` instead of `delete_workspace()`** for completed workspaces.
   - Only use `delete_workspace()` for cleanup of test/temporary workspaces with no active sessions.

7. **`get_context()` field nullability**
   - `project_id`, `issue_id`, `workspace_id` may all be null depending on how the workspace was created.
   - A null `project_id` does not mean MCP is unavailable — it means the project must be discovered via the fallback path.
   - Only treat MCP as unavailable if `get_context()` itself fails or the tool is not found.

8. **Issue relationship types are fixed**
   - Only three relationship types are supported: `blocking`, `related`, `has_duplicate`.
   - `get_issue()` returns relationships in the response; use `relationship_id` from there to delete.

9. **Tag and assignee operations use junction IDs**
   - `remove_issue_tag()` takes `issue_tag_id` (not `tag_id`). Get it from `list_issue_tags(issue_id)`.
   - `unassign_issue()` takes `issue_assignee_id` (not `user_id`). Get it from `list_issue_assignees(issue_id)`.
   - These are junction table IDs, not the entity IDs themselves.

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
