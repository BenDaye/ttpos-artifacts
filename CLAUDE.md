# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Rules

- All output (docs, code comments, commit messages, PR descriptions) MUST be in Chinese by default.
- Communicate with the user in Chinese.
- Do not mention AI assistants, agents, or collaborator model names in any remote-visible content.

## Git

- Commit messages, PR titles, PR descriptions, and all remote-visible Git metadata MUST be in Chinese.
- Conventional commits format: <type>: <Chinese description> (type in English: feat, fix, refactor, docs, test, chore, perf, ci).
- Do not mention AI assistants or model names (Codex, Claude, ChatGPT, OpenAI, Anthropic, etc.) in any remote-visible content.

## Documentation Rules

- Do not create unnecessary doc files (e.g. summary.md, report.md). Temporary files go to ./tmp/.
- Frontend/backend API docs live in code as source of truth. When adding/modifying APIs, update both sides together.
- Human-authored project docs (requirements, design, etc.) are maintained by the user. AI may add implementation status annotations only with confirmation.

## Project Preferences

- If a project uses the PMA skill for management, strictly follow the PMA workflow (investigate -> proposal -> implement). Do not skip phases or bypass the file-based task tracking process.

## Project Overview

This repository (`ttpos-artifacts`) serves two purposes:

1. **FaynoSync Dashboard** — A React 18 SPA for managing app versions, artifacts, channels, platforms, and user permissions. It is the admin frontend for the [FaynoSync](https://github.com/ku9nov/faynoSync) update distribution API.
2. **TTPOS Build Workflows** — GitHub Actions CI/CD pipelines that build the TTPOS Flutter POS applications (Android/Windows/macOS/iOS/Web) from the private repo `innet8/ttpos-flutter`.

## Build & Dev Commands

```bash
yarn install          # Install dependencies (Yarn 4, immutable lockfile)
yarn dev              # Vite dev server on port 3000
yarn build            # tsc -b && vite build (production build)
yarn lint             # ESLint check
yarn preview          # Preview production build locally
yarn commitlint       # Validate commit message format
```

## Repository Structure

```
src/                        # Dashboard React app source
├── main.tsx                # Entry point (QueryClient + AuthProvider + ThemeProvider + Router)
├── route/                  # React Router config (lazy-loaded pages, auth guards)
├── providers/              # AuthProvider (JWT/localStorage), ThemeProvider (light/dark/auto)
├── config/                 # env.ts (VITE_* vars), axios.ts (interceptors, 401 redirect)
├── pages/                  # 8 pages: Home, SignIn, SignUp, Channels, Platforms, Architectures, Statistics, Settings
├── components/             # 70+ components
│   ├── ui/                 # shadcn/ui primitives (Button, Card, Dialog, Input, Select, ToggleGroup)
│   ├── layouts/            # Dashboard view modes: CardView, ListView, BoardView, LayoutSwitcher
│   ├── common/             # BaseModal, StepperModal, CRUD modals
│   ├── settings/           # UsersSettings, TokenSettings, TufSettings + TUF sub-components
│   └── ...                 # Feature modals (Upload, Create/Edit/Delete App/Version/Channel/Platform/Arch)
├── hooks/                  # useToast, useSearch, useLayoutPreference, useMediaQuery
│   └── use-query/          # 10 React Query hooks (apps, versions, channels, platforms, architectures, upload, telemetry, users)
├── styles/                 # CSS: linear-theme.css (HSL variables, light/dark), animations, cards, sidebar
├── lib/utils.ts            # cn() helper (clsx + tailwind-merge)
└── utils/clipboard.ts      # Copy-to-clipboard
faynosync/                  # Docker Compose stack config for self-hosting FaynoSync
│   ├── docker-compose.yml  # 6 services: api (Go), dashboard, mongo, redis, minio, minio-init
│   ├── .env.example        # S3, MongoDB, Redis, security keys template
│   ├── README.md           # Deployment guide (Chinese)
│   └── FLUTTER_INTEGRATION.md  # Flutter updater package design doc
.github/workflows/          # 10 GitHub Actions workflows
│   ├── build-dashboard.yaml    # Dashboard Docker image → ghcr.io (on push to main/release)
│   ├── commitlint.yaml         # Conventional Commits validation on PRs
│   ├── auto-build.yaml         # Multi-platform build orchestrator
│   ├── dispatch.yaml           # Repository dispatch handler (test-build / release-push)
│   ├── build-android.yaml      # APK builds (ubuntu-latest)
│   ├── build-ios.yaml          # IPA builds (macos-latest)
│   ├── build-windows.yaml      # Inno Setup EXE (windows-latest)
│   ├── build-macos.yaml        # Signed/notarized DMG (~880 lines, most complex)
│   ├── build-web.yaml          # Docker images → ghcr.io
│   └── build-web-hitosea.yaml  # Docker images → hub.hitosea.com
docs/                       # macOS/iOS signing configuration guides
```

## Tech Stack

| Layer           | Technology                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| Framework       | React 18 + TypeScript (strict)                                                           |
| Build           | Vite 6                                                                                   |
| Routing         | React Router v6 (lazy-loaded pages, PrivateRoute/PublicRoute guards)                     |
| State           | React Context (auth, theme) + TanStack React Query v5 (server state)                     |
| Forms           | Formik + Yup                                                                             |
| HTTP            | Axios (Bearer token interceptor, 401 → redirect to /signin)                              |
| Styling         | Tailwind CSS 3 + CSS variables (HSL) + shadcn/ui (Radix-UI)                              |
| Icons           | Lucide React                                                                             |
| Charts          | Recharts                                                                                 |
| Dark mode       | CSS class strategy (`darkMode: 'class'`), auto mode (time-of-day + prefers-color-scheme) |
| Package manager | Yarn 4.5.1 (Corepack)                                                                    |
| Linting         | ESLint + Prettier                                                                        |
| Commit lint     | commitlint (Conventional Commits)                                                        |

## Architecture Patterns

### Authentication Flow
- JWT stored in `localStorage` (key: `token`)
- `AuthProvider` context exposes `login()`, `signUp()`, `logout()`
- Axios request interceptor attaches `Authorization: Bearer` header
- Axios response interceptor clears token on 401 and redirects to `/signin`
- `PrivateRoute` guard redirects unauthenticated users; `PublicRoute` redirects authenticated users away from auth pages

### Data Fetching (React Query)
- All API calls go through custom hooks in `src/hooks/use-query/`
- Pattern: `useQuery` for reads, `useMutation` with `onSuccess` → `queryClient.invalidateQueries()`
- Hierarchical query keys: `['apps', appName, page, filters]`
- Infinite queries for paginated version lists (board view load-more)

### Styling System
- Theme variables defined in `src/styles/linear-theme.css` (Linear.app-inspired grayscale palette)
- Light/dark modes via CSS variables in HSL color space
- `tailwind.config.js` maps semantic tokens (`background`, `foreground`, `primary`, etc.) to CSS vars
- Component styles: Tailwind utilities + shadcn/ui primitives + CSS Modules (auth pages) + custom CSS files

### Dashboard View Modes
- Three interchangeable layouts: **Card** (grid), **List** (table), **Board** (kanban by channel)
- Persisted to localStorage via `useLayoutPreference` hook
- Toggled via `LayoutSwitcher` component

### Modal System
- `BaseModal` shared structure → specialized Create/Edit/Delete modals
- `StepperModal` for multi-step wizards (TUF configuration)
- All modals use Radix Dialog primitive

## Docker Deployment

- **Multi-stage build**: Node 20 (build) → Nginx Alpine (serve)
- **Runtime env injection**: `VITE_API_URL` compiled as placeholder `__VITE_API_URL_PLACEHOLDER__`, replaced at container startup via `docker-entrypoint.sh` sed
- **Nginx**: Port 3000, SPA fallback (`try_files`), immutable asset caching (1 year), uncached `index.html`
- **Image**: `ghcr.io/<owner>/ttpos-artifacts/faynosync-dashboard`

## FaynoSync Infrastructure (faynosync/)

Docker Compose stack for self-hosting the update distribution backend:
- **api** (`ku9nov/faynosync:v1.5.4`) — Go-based update API on port 9000
- **dashboard** — This React app, served from ghcr.io
- **db** (MongoDB 7) — Version/app metadata storage
- **cache** (Redis 7) — Performance caching
- **s3** (MinIO) — Artifact binary storage (APK/EXE/DMG)

Client-facing endpoints: `GET /checkVersion` (no auth), `POST /upload` (CI token required).

## TTPOS Build Workflows

All Flutter build workflows share a common pattern:
1. Matrix strategy (`fail-fast: false`) to build multiple app packages in parallel
2. Checkout `innet8/ttpos-flutter` at user-specified branch
3. Flutter 3.41.2 + Melos bootstrap
4. Generate environment files (`.env.{production|test|development}.local`)
5. Build via Dart scripts → Upload to GitHub Artifacts + GCS/SCP/FaynoSync

### App Packages

| Platform | Packages                                      | Output               |
| -------- | --------------------------------------------- | -------------------- |
| Android  | pos, kds, shop, assistant, tablet, qds, kiosk | APK                  |
| iOS      | pos, kds, shop, assistant, tablet, kiosk      | IPA                  |
| Windows  | pos, kds, assistant, tablet, shop, kiosk      | Inno Setup EXE       |
| macOS    | pos, assistant, kds, tablet, shop, kiosk      | Signed/notarized DMG |
| Web      | menu, mobile, member                          | Docker images        |

### Environment System

- `dev` → `.env.development.local`
- `test` → `.env.test.local`
- `prod` → `.env.production.local`

### Distribution Paths

- **release branch** → `Prod/` paths (GCS, SCP, no `test-` Docker prefix)
- **other branches** → `Test/` paths (with `test-` Docker prefix)

## Editing Guidelines

### General Conventions

- Path alias: `@/` → `src/` (configured in tsconfig + vite)
- Dev proxy: set `VITE_DEV_PROXY_TARGET` for CORS-free local API access (leave `VITE_API_URL` empty)
- Workflow UIs use Chinese (中文) for step names and descriptions
- Chinese pub mirrors: `PUB_HOSTED_URL=https://pub.flutter-io.cn`
- SCP uses a two-hop relay pattern: runner → relay → target

### Dashboard

- Follow existing patterns: React Query hooks for data, Radix/shadcn for UI
- Use `cn()` utility for conditional Tailwind classes
- Respect the HSL CSS variable theme system (don't hardcode colors)
- Keep TypeScript strict mode compliance (`noUnusedLocals`, `noUnusedParameters`)
- Prettier: 2-space indent, single quotes, semicolons, trailing commas (ES5)

### Workflows

- Maintain `fail-fast: false` on all matrix strategies
- Keep the `should_run` check pattern for "all" vs single package builds
- Preserve env suffix mapping (`dev→development`, `test→test`, `prod→production`)
- macOS: never break the YAML anchor relationship (`&mac_steps` / `*mac_steps`)
- Keep SCP paths and URL options in sync

## Project Development

Use `/pma` for task management. Tasks and plans live in `docs/task/` and `docs/plan/` (git-tracked, portable across environments).

### MANDATORY: Agent Role Detection on Session Start

**Every agent MUST execute this decision tree at session start, BEFORE doing any work:**

```
1. Call get_context() via Vibe Kanban MCP
2. If get_context() fails → file-only mode, skip MCP
3. Extract issue_id from response

4. If issue_id is NULL:
   → You are an INTERACTIVE ORCHESTRATOR (user's workspace)
   → Use /pma skill, follow full three-phase workflow with user approval gates
   → STOP here, do not proceed to step 5

5. If issue_id is NON-NULL:
   → Call get_issue(issue_id) → read the description field
   → Check: does the description contain "## 验证命令"?

6. If description CONTAINS "## 验证命令":
   → You are an IMPLEMENTER (leaf task with detailed spec)
   → Follow the Implementer Protocol below
   → STOP here, do not proceed to step 7

7. If description DOES NOT CONTAIN "## 验证命令":
   → You are an AUTONOMOUS ORCHESTRATOR (complex task, needs decomposition)
   → Use /pma skill, follow full three-phase workflow
   → AUTO-PROCEED through all phases (no user approval gates)
   → Your job is to DECOMPOSE the task, CREATE sub-issues, and DISPATCH sub-workspaces
   → Do NOT implement code directly yourself
```

### Implementer Protocol (Leaf Tasks Only)

> Only when the decision tree above leads to step 6 (description contains `## 验证命令`).

When `get_context()` returns a non-null `issue_id` AND the issue description contains `## 验证命令`, you are a dispatched implementer. Follow these steps exactly:

1. Call `get_issue(issue_id)` → read the `description` field as your implementation spec
2. Read ONLY the files mentioned in the description; implement the specified changes
3. Run verification commands listed in the description (e.g. `yarn build`, `yarn lint`)
4. Stage specific files: `git add <file1> <file2>` (never `git add -A`)
5. Commit using **conventional commits** format: `feat: <中文描述>` (or `fix:`, `refactor:`, etc.)
6. **Call `update_issue(issue_id, status: "Done")` via Vibe Kanban MCP** — this is mandatory

Dispatched agents must NOT: create sub-issues, dispatch workspaces, create `docs/task/` or `docs/plan/` files, wait for user approval, or run the PMA three-phase workflow.

### Autonomous Orchestrator Protocol (Complex Tasks)

> Only when the decision tree above leads to step 7 (description does NOT contain `## 验证命令`).

When dispatched for a complex task, you are an autonomous orchestrator. Your job is NOT to implement code yourself, but to:

1. **Investigate** the codebase to understand the task scope
2. **Decompose** the task into independently-implementable sub-tasks
3. **Create sub-issues** under the parent issue (with `parent_issue_id`), each with a detailed description following the Issue Description Template (MUST include `## 验证命令`)
4. **Dispatch sub-workspaces** for each sub-issue via `start_workspace(issue_id: sub_issue_id, ...)`
5. **Monitor** sub-workspace execution via `get_execution()`
6. **Verify** results after sub-workspaces complete
7. **Archive** all sub-workspaces: `update_workspace(workspace_id, archived: true)`
8. **Complete** the parent issue: `update_issue(issue_id, status: "Done")`
9. **Archive self**: `update_workspace(own_workspace_id, archived: true)` — get `own_workspace_id` from `get_context().workspace_id`

Key rules:
- Use `/pma` skill for the full workflow
- Auto-proceed through all phases (no user approval gates needed)
- `project_id` must be discovered via `list_organizations()` → `list_projects()` if `get_context()` returns null
- Obtain `repo_id` and `branch` from `get_context().workspace_repos`
- Each sub-issue description MUST include `## 验证命令` so sub-workspace agents enter Implementer mode
- Always specify `executor: "CLAUDE_CODE"` when calling `start_workspace` or `create_session`

### Vibe Kanban MCP Integration (Pluggable)

Vibe Kanban MCP is an optional but preferred integration for issue tracking and workspace dispatch. It is **auto-detected** at session start via `get_context()`.

**Issue-First workflow** (when MCP is available):
```
Orchestrator:
  list_organizations() → list_projects(org_id)
    → create_issue(parent) → create_issue(sub-issue, parent_issue_id)
      → start_workspace(sub_issue_id, executor, repos) → [auto: "In Progress"]
        → monitor via get_execution()
          → verify → update_issue(parent, status: "Done") → archive workspaces

Implementer (in dispatched workspace):
  get_context() → get_issue(issue_id) → implement → commit → update_issue(status: "Done")
```

Core rules:
- Files (`docs/task/`, `docs/plan/`) are **always** the primary data source — Kanban is the sync target
- Issue is the entry point: create Issue first, then create Workspace from Issue (not the reverse)
- Creating a workspace linked to an issue **automatically** moves the issue to `In Progress`
- `link_workspace_issue()` also triggers the same auto `In Progress` transition
- `project_id` must be passed explicitly to `create_issue()` and `list_issues()`
- If `get_context()` returns `project_id: null`, discover it via `list_organizations()` → `list_projects()`
- When MCP is unavailable, continue with file-only workflow — no errors, no warnings

Critical constraints (verified by E2E testing):
- `start_workspace` requires either `issue_id` or `prompt` — omitting both returns HTTP 400
- `create_session` must specify `executor: "CLAUDE_CODE"` explicitly — the default is unreliable
- Sub-issues are status-independent: completing all children does NOT auto-complete the parent
- Use `update_workspace(archived: true)` instead of `delete_workspace()` — delete fails with 409 if sessions exist
- `remove_issue_tag()` and `unassign_issue()` take junction IDs, not entity IDs
- Issue description must be a complete implementation spec (see Issue Description Template in PMA skill)

Full tool mapping, status/priority mapping, constraint details, and dispatch protocol are defined in the PMA skill (`/pma`).
