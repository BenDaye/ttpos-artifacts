# PLAN-036 仓库顶层 monorepo 化（top-level monorepo migration）

- **status**: draft（设计已与用户逐段确认，待写实施计划）
- **task**: 待立（实施阶段立 REFACTOR-009）
- **createdAt**: 2026-07-04
- **mode**: DELIBERATE（目录大搬家 + CI/发版/部署命名全链路变更）
- **决策方式**: brainstorming 逐问收敛（目标形态、动机、发版命名、任务编排、迁移节奏、整体方案均由用户逐项拍板）
- **关联**: 承接 PLAN-035（server 单租户焊死已上线）；触碰 AGENTS.md「发版 (dashboard-next)」「关键边界」多条约定，落地后需同步改写

## 背景与动机

当前仓库是「仓库里套仓库」：`dashboard-next/` 自身是一个完整 Bun workspace（apps/web、apps/mcp、packages/config、packages/shared，自带 bun.lock / eslint / playwright / scripts），`server/` 是独立 Go 模块，两者与 deploy、docs、.github 平铺在根下。用户拍板将其迁移为**真正的顶层 monorepo**，动机四项全选：

1. **目录/心智负担**：消除嵌套 workspace，路径、命令、配置统一一层。
2. **前后端共享代码**：为未来 API 契约/共享类型包打基础（本次只搭结构不建包）。
3. **统一工具链/CI**：lint、typecheck、test、发版流程收敛为一套。
4. **为新应用铺路**：后续新 app 直接落 `apps/`。

## 目标结构与命名

```
ttpos-artifacts/
├── apps/
│   ├── web/            # 原 dashboard-next/apps/web，包名保持 @ttpos/web
│   ├── mcp/            # 原 dashboard-next/apps/mcp
│   └── server/         # 原 server/，Go 模块整体平移，go.mod 独立不并入 bun workspace
├── packages/
│   ├── config/         # 原 dashboard-next/packages/config
│   └── shared/         # 原 dashboard-next/packages/shared
├── e2e/                # 原 dashboard-next/e2e + playwright.config.ts 上提到根
├── scripts/            # 原 dashboard-next/scripts（bump-version 改造为 per-app）
├── package.json        # workspace 根：workspaces = ["apps/*", "packages/*"]
├── bun.lock  turbo.json  eslint.config.js  tsconfig.json
├── deploy/  docs/  .github/  DESIGN.md  AGENTS.md ...
```

命名对齐表（用户选定方案 A：全新 `ttpos-*` 命名，deploy 一次性切换）：

| 应用 | 目录 | 发版 tag | ghcr 镜像 |
|---|---|---|---|
| Dashboard | `apps/web` | `web-v*` | `ttpos-web` |
| MCP | `apps/mcp` | `mcp-v*` | `ttpos-mcp` |
| Server | `apps/server` | `server-v*` | `ttpos-server` |

- 所有移动用 `git mv`，历史经 `git log --follow` 追溯；`dashboard-next/` 目录整体消失。
- Go 目录无 package.json 时天然不参与 bun workspace；接入 turbo 的方式见下节。
- 旧 `dashboard-next-v*` tag 与 `faynosync-*` 镜像历史保留不动，仅停止新增。

## 工具链

- 根 `package.json` 合并原 dashboard-next 根的 devDependencies（@antfu/eslint-config、eslint 插件、playwright、typescript），新增 `turbo`（用户选定，替代纯 bun --filter）。
- `turbo.json` 统一 pipeline：`lint` / `typecheck` / `test` / `build`。
- **Go 接入 turbo**：`apps/server` 加薄 `package.json`（`name: @ttpos/server`），scripts 映射 `test → go test ./...`、`build → go build -o faynoSync .`、`lint → go vet ./...`，作为 workspace 成员挂进任务图；turbo 缓存 inputs 限定 `**/*.go`、`go.mod`、`go.sum`。根上 `turbo test` 一条命令同时覆盖 TS 与 Go。
- eslint / tsconfig / playwright 配置上提到根并修正路径；`routeTree.gen.ts` 生成机制不动。
- **server 发版行为变化（用户已确认）**：从「push main 即构建推 `:latest`」改为「打 `server-v*` tag 才推镜像」，与 web/mcp 对齐；push 仍跑质量门（go build / vet / unit）。
- 共享代码包本次不建（YAGNI），未来直接落 `packages/`。

## CI 工作流改造

- `build-dashboard-next.yaml` → 重命名 `build-web.yaml`：路径过滤改 `apps/web/**`、`packages/**`、根 workspace 文件；tag 触发 `web-v*`，`type=match` 提取 `web-v(.*)`；`IMAGE_NAME: ttpos-web`；`GIT_COMMIT` build-arg 与运行时 `VITE_API_URL` 注入机制保持不变。
- `build-mcp.yaml`：路径改 `apps/mcp/**`，Dockerfile 路径/构建上下文按新目录修正，镜像 `ttpos-mcp`，tag `mcp-v*`。
- `build-server.yaml`：路径改 `apps/server/**`，`go-version-file`、`working-directory`、Dockerfile 路径同步；镜像 `ttpos-server`；build/push 段改为 `server-v*` tag 门控。
- 质量门 job 从仓库根跑 `turbo lint typecheck test`（可带 `--filter`），或保持 per-app working-directory——实现时取更简单者。
- Flutter 多平台构建工作流（build-android/ios/macos/windows、auto-build、dispatch 等）不引用受迁移目录，保持不动；`fail-fast: false`、`should_run`、`dev/test/prod` 环境映射、macOS YAML anchor、SCP 路径等既有约束逐字保留。
- 各 Dockerfile `COPY` 路径按新目录修正；web 镜像构建上下文从 `dashboard-next/` 变为仓库根（或调整 COPY 层级），需与 bun workspace 安装拓扑对齐，配套核对 `.dockerignore`。

## 部署切换

- `deploy/docker-compose.yml` 三个镜像改名：`faynosync-server/faynosync-dashboard-next/faynosync-mcp` → `ttpos-server/ttpos-web/ttpos-mcp`，仍拉 `:latest`。
- 切换顺序：合并迁移分支 → 依次打 `server-v*`、`web-v*`、`mcp-v*` 使新镜像名下产生 `:latest` → vm-node02 更新 compose 并 `docker compose up -d`。
- 回滚路径：compose 改回旧镜像名即可；旧镜像与旧 tag 均未破坏。

## 迁移步骤（单分支一次性执行，用户选定）

1. `git mv` 目录搬家：`server/` → `apps/server/`；`dashboard-next/` 内容上提（apps、packages、e2e、scripts、配置）。
2. 根 workspace + `turbo.json` + eslint/tsconfig/playwright 路径修正，`bun install` 重建 `bun.lock`。
3. `apps/server` 薄 package.json 接入 turbo。
4. 三个 build 工作流 + Dockerfile 改造。
5. deploy compose 改镜像名；`scripts/bump-version.ts` 改造为 per-app（形如 `bun run version:patch --app web`，实现时定）。
6. 文档同步：AGENTS.md（仓库地图、常用命令、发版流程、关键边界）、README、docs/task 记录。

## 验证 gate

- 根上 `turbo lint typecheck test build` 全绿；`apps/server` 内 `go test ./...` 通过。
- Playwright e2e 通过。
- 本地 `docker build` 三个镜像全部成功（重点验 web 的新构建上下文）。
- 三个 workflow YAML 语法与路径人工核对。
- **已知验证缺口**：CI 真实闭环只能在合并后首次打 tag 时验证；通过「合并后立即打三个 tag 演练 + vm-node02 切换观察」补齐。

## 风险

- **在途分支冲突**：目录大搬家使任何未合并分支产生海量冲突；迁移前确认无在途工作（或先合并）。
- **Docker context 变更**（最易翻车点）：web 构建 context 从 `dashboard-next/` 变为根，COPY 层与 `.dockerignore` 必须本地 build 验证。
- **`git log --follow` 依赖**：整目录移动后部分工具 blame/历史体验变差，可接受。
- **server 发版流程变化**：上线多一步打 tag；需在 AGENTS.md 与团队约定中写明。

## 非目标

- 不新建前后端共享类型/契约包（只留 `packages/` 位置）。
- 不改 Go module path、不动 server 内部代码逻辑。
- 不动 TUF 禁用状态、路由/localStorage key/公共 API 路径等兼容契约。
- 不删除旧 tag、旧镜像。
