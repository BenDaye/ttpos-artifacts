# PLAN-036 仓库顶层 monorepo 化（top-level monorepo migration）

- **status**: implementing（用户已批准，分支 refactor/plan-036-monorepo 实施中）
- **task**: 待立（实施阶段立 REFACTOR-009）
- **createdAt**: 2026-07-04
- **mode**: DELIBERATE（目录大搬家 + CI/发版/部署命名全链路变更）
- **决策方式**: brainstorming 逐问收敛（目标形态、动机、发版命名、任务编排、迁移节奏、整体方案均由用户逐项拍板）；实施计划经 ralplan 共识（Planner → Architect → Critic，两轮迭代后 Critic APPROVE）
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

---

# 实施计划（共识版，pending approval）

> 经 Planner → Architect → Critic 两轮闭环，Critic 终裁 APPROVE。**对 spec 的两处有意偏离**（评审发现，须记入 REFACTOR-009）：
> 1. **workflow 文件名**：spec 原写「重命名为 build-web.yaml」，但该文件已被 Flutter POS Web 构建（menu/mobile/member）占用，直接改名会覆盖它 → Dashboard 工作流改名 **`build-dashboard.yaml`**（镜像仍 `ttpos-web`、tag 仍 `web-v*`，命名对齐表不变）。
> 2. **server 验证门**：spec 写「go test ./... 通过」，但集成套件（faynoSync_test.go、mongod 等）依赖 Mongo/Redis/S3，本地/CI 无服务必红（PLAN-035 已知缺口）→ `test` 收窄为单元包（ownership/utils，与现 CI 一致），全量归 `test:integration` 逃生口，由 QUAL-004 闭合。

## 分支与前置

- 单分支 `refactor/plan-036-monorepo`；动手前确认**无在途分支**（目录大搬家会造成海量冲突）。
- 实施前一句话核对：Dashboard 工作流命名为 `build-dashboard.yaml`，未回退成 `build-web.yaml`。

## 阶段 A — 目录搬家（纯 git mv，不改内容）

1. `git mv server apps/server`（go.mod module `faynoSync` 不变；`server/.dockerignore`、`docker-compose.dev.yaml` 随迁）。
2. `git mv dashboard-next/apps/web apps/web`、`dashboard-next/apps/mcp apps/mcp`、`dashboard-next/packages packages`、`dashboard-next/e2e e2e`、`dashboard-next/scripts scripts`。
3. 根配置上提：package.json、bun.lock、eslint.config.js、tsconfig.json、playwright.config.ts；根 .gitignore 与 dashboard-next/.gitignore **合并**（.turbo/、coverage/，`server/faynoSync(_tests)` → `apps/server/...`）。
4. `dashboard-next/Dockerfile` → `apps/web/Dockerfile`（与 mcp 对称）；`dashboard-next/CHANGELOG.md` → `apps/web/CHANGELOG.md`；删空目录。
- 已核验：apps 内 tsconfig 用 `extends @ttpos/config/*`（包解析）、vite 用 `__dirname`，搬家本身不需改内容。
- gate：`git status` 全为 rename；`git log --follow` 抽查 web/server 各一文件。回滚：`git reset --hard`。

## 阶段 B — 根 workspace + Turborepo

- 根 package.json：name `ttpos-artifacts`、version 固定 `0.0.0`（根不是发布单元）、workspaces `["apps/*","packages/*"]`、合并原 devDeps、新增 `turbo`；scripts 改 `turbo lint/typecheck/test/build` + `test:e2e: playwright test`。
- 新建 turbo.json：pipeline lint/typecheck/test/build（build 依赖 `^build`）。
- **连带影响（MAJOR-1/2 根因）**：阶段 C 给 apps/server 加 package.json 后，它**进入 bun workspace 图**，`bun install` 会在 **bun.lock 新增 `@ttpos/server` 条目**。三处必须一致：bun.lock 有 @ttpos/server ⟺ web/mcp Dockerfile 有 `COPY apps/server/package.json` ⟺ 根 .dockerignore 有 `!apps/server/package.json`。
- gate（**必须实跑取证**，「eslint/tsconfig/playwright 配置上提后不用改」是待验证假设，跑绿才算证实）：`bun install` 成功重建 lock → `turbo lint` 0 error → `turbo typecheck` 全过 → `bun run test:e2e` 全绿。任一失败回到配置修正，不得跳过。

## 阶段 C — apps/server 接入 turbo

新建 `apps/server/package.json`：

```json
{
  "name": "@ttpos/server", "version": "0.0.0", "private": true,
  "scripts": {
    "test": "go test ./server/ownership/... ./server/utils/...",
    "test:integration": "go test ./...",
    "build": "go build -o faynoSync .",
    "lint": "go vet ./...",
    "typecheck": "go vet ./..."
  }
}
```

- `test` 与现 CI 对齐只跑单元包（spec 偏离 2，入 REFACTOR-009）；`test:integration` 注明「需 MongoDB/Redis/S3 服务容器，QUAL-004 容器化后接入 turbo」。
- turbo.json 为该成员限定 inputs `["**/*.go","go.mod","go.sum"]`。
- gate：`turbo test --filter @ttpos/server`、`turbo build --filter @ttpos/server` 通过。

## 阶段 D — CI 工作流 + Dockerfile（最易翻车，逐字项）

**D1 `build-dashboard-next.yaml` → `build-dashboard.yaml`**：paths 改 `apps/web/**`、`packages/**`、根 workspace 文件；tag 触发 `web-v*`；质量门从根跑 turbo（删 `working-directory: dashboard-next`）；build job `if: startsWith(github.ref,'refs/tags/web-v')`、`IMAGE_NAME: ttpos-web`、`type=match,pattern=web-v(.*)`、`context: .`、`file: apps/web/Dockerfile`；`GIT_COMMIT` build-arg、`flavor: latest=false` + `type=raw,value=latest` 机制不变；artifact 路径去前缀。

**D2 `build-mcp.yaml`**：paths `apps/mcp/**` + `packages/**`；`IMAGE_NAME: ttpos-mcp`；`context: .`、`file: apps/mcp/Dockerfile`；tag `mcp-v*` 不变。

**D3 `build-server.yaml`**（tag 门控为 spec 拍板的行为变更，逐字三处）：
1. `on.push` 增加 `tags: ["server-v*"]`；paths 改 `apps/server/**`；`working-directory`/`go-version-file` 同步（`go test ./server/ownership/...` 相对路径不变——server 内有嵌套 server/ 子目录）。
2. build job 新增 `if: startsWith(github.ref, 'refs/tags/server-v')`。
3. meta 段整段替换为与 build-mcp.yaml 同构：`flavor: latest=false` + `type=match,pattern=server-v(.*),group=1` + `type=raw,value=latest` + `type=sha,prefix=,format=short`；**删除** `type=raw,value=latest,enable=<main||release>` 与 `type=ref,event=branch`（不删则 tag 事件下 `:latest` 永远不更新，vm-node02 拿不到新镜像）。
4. `IMAGE_NAME: ttpos-server`；`context: apps/server`。push 分支仍跑质量门，只是不推镜像。

**D4 Docker context 与 .dockerignore**：
- web/mcp Dockerfile COPY 已是 workspace 相对路径，context 从 `./dashboard-next` 改根后 COPY 主体不变，但（MAJOR-1）两个 Dockerfile 在 `RUN bun install --frozen-lockfile` 之前**各加一行** `COPY apps/server/package.json apps/server/`（与既有「COPY apps/mcp/package.json + frozen 注释」同款模式）。
- **新建根 `.dockerignore`**（白名单式，last-match-wins；注意 `!apps` 与 `apps/server/*` 两行顺序不可被格式化工具重排）：

```
*
!package.json
!bun.lock
!tsconfig.json
!eslint.config.js
!packages
!apps
apps/server/*
!apps/server/package.json
**/node_modules
**/dist
**/.turbo
**/playwright-report
**/test-results
.git
```

  嵌套产物排除必须 `**/` 前缀（裸写只匹配根一层）。Docker 再包含行为有实现差异：**本地三镜像 build 成功是最终裁决门**；若再包含失效，降级为黑名单式（显式排 `apps/server/server`、`apps/server/go.*` 等，保留 manifest）。
- `apps/server/.dockerignore` 内容不变，server 构建 context 仍是 `apps/server`，不受根文件影响。
- gate：本地 `docker build -f apps/web/Dockerfile .`、`docker build -f apps/mcp/Dockerfile .`、`docker build apps/server` 三镜像全部成功；三 YAML 语法核对（actionlint 或 yaml 解析）。

## 阶段 E — deploy 切换（含硬门）

- `deploy/docker-compose.yml` **只改三处 `image:`**：`faynosync-server→ttpos-server`、`faynosync-dashboard-next→ttpos-web`、`faynosync-mcp→ttpos-mcp`（registry 前缀不变）。**不动 `container_name`（faynosync-api/dashboard/mcp）与网络别名**——Caddyfile:6/41/60 以 `faynosync-dashboard:3000`、`faynosync-mcp:3010`、`faynosync-api:9000` 做反代，改名即断链。prod-caddy 变体只含 caddy，不改。
- 切换顺序（发布 checklist）：合并 → 依次打 `server-v*` → `web-v*` → `mcp-v*`（每打一个确认对应 `ttpos-*:latest` 实际生成再下一个）→ **硬门：vm-node02 上三个新镜像 `docker pull` 全部成功后**才更新 compose 并 `up -d`；任一 pull 失败即中止，compose 保持旧名。→ 冒烟：api 起、dashboard 登录+侧边栏版本号、mcp /healthz。
- 回滚：compose 改回 `faynosync-*`（旧镜像/旧 tag 全程保留不删），秒级；代码层回滚 = `git revert` 合并提交（原子）。

## 阶段 F — bump-version per-app

- CLI：`bun run scripts/bump-version.ts <patch|minor|major|x.y.z> --app <web|mcp>`（`--app` 必填）。映射：web → `apps/web/package.json` + `apps/web/CHANGELOG.md` + tag 前缀 `web-v`；mcp → `apps/mcp/...` + `mcp-v`（无 CHANGELOG 时沿用脚本既有 skip）。
- 去根版本同步：根 package.json version 固定 `0.0.0`；web 版本源即 `apps/web/package.json`（vite 已读取注入侧边栏）。
- server 不纳入脚本（Go 无 npm 版本语义），发版纯手动打 `server-v*` tag。
- gate：`--app web` / `--app mcp` 干跑，bump 与打印的 tag 前缀正确。

## 阶段 G — 文档同步 + 立项

- **AGENTS.md**：仓库地图（apps/web、apps/mcp、apps/server、packages、turbo；注明 `ttpos-web`＝admin dashboard，与 Flutter 的 `ttpos-web-menu/mobile/member` 区分，防运维误认）；常用命令改根级 turbo；「发版」节整节重写（per-app tag、ttpos-* 镜像、`--app` 参数、**server 需打 tag 才更新 :latest**）；关键边界更新（VITE_API_URL 机制未变）。
- **README.md** 行级更新（workflow 表、镜像名、路径、命令）；`apps/mcp/README.md` 示例路径。
- 新建 `docs/task/REFACTOR-009.md`（含两处 spec 偏离记录）；更新 `docs/task/index.md`；本文件状态推进。
- gate：`git diff --check`；rg 清零三 pattern：`rg dashboard-next`（除本 plan 与历史 CHANGELOG）、`rg 'faynosync-'`（限镜像引用与文档路径清零；container_name/Caddy 别名**有意保留**，需人工区分）、`rg 'dashboard-next-v'`（除历史归档）。

## 合并前总 gate

干净环境 `bun install --frozen-lockfile` 成功；`turbo lint typecheck test build` 全绿（含 @ttpos/server 单元包）；Playwright e2e 全绿；本地三镜像 docker build 成功；三 workflow YAML 核对；`git log --follow` 抽查。**已知验证缺口**：CI 真实闭环（tag 触发/ghcr 推送/版本提取）只能合并后打 tag 演练验证——已通过阶段 E 发布 checklist（逐 tag 确认 + pull 硬门 + 秒级回滚）收敛为可接受残余风险。

## Pre-mortem（4 场景）

1. **web 镜像构建炸**（.dockerignore 误排 COPY 依赖）→ 本地三镜像 build 硬 gate；白名单先松后紧。
2. **tag 提取版本错 → :latest 指坏镜像** → 逐 tag 确认 + pull 硬门 + up -d 前冒烟；meta 与 build-mcp.yaml 同构（现网已验证）；回滚改回旧名。
3. **turbo test 拉起 go 集成套件全红** → server test 收窄单元包，集成归 test:integration/QUAL-004。
4. **frozen-lockfile 击穿**（@ttpos/server 进 lock 但构建上下文缺 manifest）→ 两 Dockerfile 补 COPY + `.dockerignore !apps/server/package.json` + 阶段 B/D 三处一致性检查。

## ADR

- **Decision**：迁为顶层 Bun + Turborepo monorepo（apps/{web,mcp,server} + packages/{config,shared} + 根 e2e/scripts/配置），`ttpos-*` 镜像 + per-app `<app>-v*` tag 门控，单分支一次性迁移；apps/server 以薄 package.json 作 bun workspace 成员接入 turbo。
- **Drivers**：消嵌套目录心智负担；统一工具链/CI；为共享包与新 app 铺路；不破坏现网 `:latest` 且保秒级回滚。
- **Alternatives considered**：渐进迁移（否决：双轨更久、冲突不减）；纯 bun --filter 不引 turbo（否决：Go 无法纳管、无缓存）；保留 faynosync-* 命名（否决：用户已拍板换新）；turbo 绕开 workspace 纳管 apps/server（否决：turbo 包图派生自包管理器 workspace，非成员不可 filter/无 per-package 缓存）；覆盖 build-web.yaml（否决：该文件属 Flutter Web 构建，风险外溢）。
- **Why chosen**：一次性把冲突压进短窗口，`git revert` 原子回滚；turbo 是唯一能同管 TS+Go 任务图并缓存的选择；tag+latest 组合照抄现网已验证的 build-mcp 模式；旧镜像旧 tag 全留兜底。
- **Consequences**：正向——路径/命令/配置收敛一层，新 app 直接落 apps/。负向——server 发版多一步打 tag（已写入文档同步项）；git blame 体验略降；根 .dockerignore 需长期维护；bun.lock 多一条空成员条目。
- **Follow-ups**：QUAL-004 集成套件容器化后 turbo server test 升级全量；未来建 packages/api-contract；tag 演练 CI 闭环证据补入 REFACTOR-009；评估 Flutter build-web.yaml 顺势更名（独立任务）。
