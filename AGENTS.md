# TTPOS Artifacts 协作指南

本文件是仓库根级工作入口，只保留会影响每次任务判断的稳定规则。具体实现、接口、部署细节以源码、`README.md`、`docs/`、脚本和当前命令输出为准；不要把可从代码中查到的长目录树或流程细则复制到这里。

## 工作原则

- 默认用中文与用户沟通；文档、代码注释、提交信息、PR 标题和描述也默认中文。
- 对外可见内容不得写入具体协作工具、模型名称、内部执行过程或临时调试细节，除非用户明确要求。
- 先读后写：改动前确认当前分支、脏工作树、相关文件和既有实现；不要覆盖用户已有改动。
- 不运行破坏性 Git 命令；需要提交时使用 Conventional Commit，格式为 `<type>: <中文描述>`。
- 不创建非必要说明文件。临时产物放 `tmp/`，任务状态、计划和验收记录优先放 `docs/task/`、`docs/plan/` 或既有文档。
- 功能、缺陷、重构和跨模块计划按三阶段执行：investigate -> proposal -> implement；明确的文档整理或单文件配置收敛可按用户要求直接处理。
- 开发任务先调查，再 proposal，获批后实现，并同步 `docs/task/*.md`；复杂编排按需用 `/bkd`。
- 不创建非必要说明文件。临时产物放 `tmp/`。

## 工具使用

- 简单检索优先 `rg` / `rg --files`，再读源码和脚本确认事实。
- 第三方库、工具行为或外部最佳实践需要确认时，按需使用 context7、exa 或可用的网页/官方文档；缺少某个工具时说明后用可用来源补足。
- 跨调用链、影响面或符号关系不清时，按需使用 code-review-graph 和 Serena；code-review-graph 优先从最小上下文开始。
- 单文件文档、配置或小范围文案整理不需要强行调用 MCP。

## UI

- 交互组件使用成熟 headless UI；不要手写 focus trap、scroll lock、ARIA、键盘导航。
- 视觉以 **shadcn base-mira + taupe 主题（preset b5x2IxUsi）**为准（`packages/ui/src/styles/globals.css` 承载主题变量，OKLCH 紫色系）；正文字体为 **JetBrains Mono 全站等宽**（`apps/web/src/index.css` 的 `html { font-mono }` 承载，`--font-mono`/`--font-heading` 定义在 globals.css）；`DESIGN.md` 已退役，不再作为视觉事实来源。
- UI 组件统一从 `packages/ui`（`@ttpos/ui`）引入，alias `@ttpos/ui/components/*`；新组件优先用 `bunx shadcn@latest add` 落到 `packages/ui`，保持 `style=base-mira`、`iconLibrary=phosphor`、`baseColor=taupe` 与双端 `components.json` 一致。图标统一用 `@phosphor-icons/react`（`*Icon` 后缀别名），**禁止再引入 `lucide-react`**。
- UI 基座保持 `@base-ui-components/react`（headless primitives），**禁止引入 `radix-ui` 依赖**。

## 仓库地图

仓库是顶层 Bun workspace + Turborepo monorepo（PLAN-036）：

- `apps/web/`：生产 Dashboard（admin 后台），React 19、Vite、TanStack Router/Query、Tailwind v4、Base UI/shadcn/ui。镜像 `ttpos-web`——注意与 Flutter 侧 `ttpos-web-menu/mobile/member`（POS Web 三端）无关，勿混淆。
- `apps/mcp/`：只读 MCP server，封装 FaynoSync API。镜像 `ttpos-mcp`。
- `apps/server/`：FaynoSync Go API（module `faynoSync` 不变），负责版本、应用、上传、下载、认证、遥测和 TUF 相关服务。镜像 `ttpos-server`。经薄 `package.json`（`@ttpos/server`）挂进 turbo 任务图；其 `test` 只跑单元包，`test:integration` 为全量逃生口（需 Mongo/Redis/S3，见 QUAL-004）。
- `packages/`：`config`（共享 tsconfig 等）、`shared`（共享 TS 代码）、`ui`（`@ttpos/ui`，shadcn base-mira 共享 UI 组件包，源码直出无构建，`exports` 映射 `components/*`/`lib/*`/`hooks/*`/`globals.css`）。
- `.github/workflows/`：TTPOS Flutter 多平台构建与 FaynoSync 分发流程（`build-dashboard.yaml` / `build-mcp.yaml` / `build-server.yaml` 对应三镜像；`build-web.yaml` 属 Flutter，勿动）。
- `deploy/`：本项目的部署产物——app compose（接入外部 `caddy-net`）+ 贡献给主机 Caddy 的**站点片段** `deploy/Caddyfile` + splice 脚本。**Caddy 本体、全局配置、网络与别的项目路由都归主机 infra，不进本仓库**（详见 PLAN-037）；container_name/网络别名保持 `faynosync-*`，Caddy 反代依赖，勿改名。
- `docs/`：changelog、plan/task 文档和项目决策记录。

## 常用命令

在仓库根执行，优先跑和改动范围匹配的聚焦 gate（`--filter`）；跨模块、发布、安全、认证、上传下载、CI/CD 或数据契约改动再升级到全量验证。

```bash
bun install --frozen-lockfile
bun dev                        # apps/web 开发服务器
bun run typecheck              # turbo typecheck（全包，含 @ttpos/server go vet）
bun run lint                   # 根级 eslint
bun run lint:fix
bun run test                   # turbo test（web/mcp vitest + server go 单元包）
bun run test:e2e               # Playwright
bun run build                  # turbo build
bunx turbo test --filter @ttpos/web    # 聚焦单包
```

不带 `--filter` 的 `typecheck/test/build` 会连带跑 `@ttpos/server` 的 go 任务，需要本地 Go 工具链；纯前端改动用 `--filter` 聚焦即可。

### Server（Go 直连方式）

```bash
cd apps/server
go test ./server/ownership/... ./server/utils/...   # 单元包（与 CI 一致）
go test ./...                                       # 全量，需 Mongo/Redis/S3（QUAL-004）
go build -o faynoSync .
```

### Deploy

```bash
cd deploy
docker compose up -d
docker compose build
```

### 发版（per-app tag 门控）

三个镜像都**只在打对应 tag 时构建推送**：`web-v*` → `ttpos-web`、`mcp-v*` → `ttpos-mcp`、`server-v*` → `ttpos-server`；push 到 main/release 只跑质量门、不打包。

```bash
# web / mcp：bump 版本 + 归档 CHANGELOG（server 无 npm 版本，直接打 tag）
bun run version:patch -- --app web    # 或 version:minor / version:major；--app web|mcp 必填
git add -A && git commit -m "chore: 发布 web v<version>"
git push origin main
git tag web-v<version> && git push origin web-v<version>

# server：手动打 tag 即发版
git tag server-v<version> && git push origin server-v<version>
```

- tag 名与 CI `type=match` 闭环；CI 据此推 ghcr 镜像 `:<version>` + `:latest` + `:<short-sha>`；web 镜像经 `GIT_COMMIT` build-arg 注入 commit（侧边栏底部展示版本号）。
- `scripts/bump-version.ts` 只改文件并打印建议的 commit/tag 命令，不自动提交、不自动打标签；根 `package.json` version 恒为 `0.0.0`，不参与发版。
- vm-node02 部署拉 `:latest`，`:latest` 只在打 tag 时更新；**server 发版从「push main 即发」改为「打 server-v* tag 才发」**（PLAN-036）。
- 切换/发布硬门：先在部署机 `docker pull` 确认三个新镜像可拉取，再改 compose `up -d`；回滚 = compose 换回旧镜像名。

## 关键边界

- Dashboard 新功能和修复遵循 `features/<domain>/{api.ts,hooks.ts,components/}`、共享 UI、React Query hooks 和既有 i18n 模式。
- `routeTree.gen.ts` 是生成文件，不手改；路由、localStorage key、公共 API 路径和现有认证行为属于兼容契约。
- 前后端 API 以源码为准。新增或修改 API 时同步 server、dashboard 调用、共享类型、测试和文案。
- TUF 前端入口当前保持禁用；相关脚本和保留代码只在用户明确要求时恢复或调整。
- server 是单 owner 部署：多租户已移除，`owner` 命名空间由 `ownership.Owner()` 返回的部署常量决定（`DEPLOYMENT_OWNER`，一旦有 admin 即必填、启动 fail-closed，首启空库豁免）。调用者身份只管 RBAC，永不决定命名空间；`owner` 字段与查询过滤保留不动。详见 PLAN-035。
- 工作流保持矩阵 `fail-fast: false`、`should_run` 判断、`dev/test/prod` 环境映射、macOS YAML anchor 关系和 SCP 路径/URL 选项同步。
- Dashboard Docker 镜像依赖运行时 `VITE_API_URL` 注入；调整构建或 nginx 时确认该机制仍有效。

## 验证与交付

- 文档-only 改动至少运行 `git diff --check`，并用 `git diff --name-only` 确认没有越界。
- Dashboard 代码改动优先跑对应 `typecheck`、`lint`、`test`；UI 或流程改动补充 e2e 或浏览器验证。
- Server 改动优先跑单元包 `go test ./server/ownership/... ./server/utils/...`（全量 `go test ./...` 需外部服务，见 QUAL-004）；上传、下载、认证、TUF、存储和迁移相关改动需要更聚焦的回归证据。
- Workflow 或部署改动要检查语法、分支/环境映射、secret 名称和分发路径；无法本地完整运行时说明验证缺口。
- 提交或 PR 前汇总实际运行过的命令和结果；不能运行的 gate 要说明原因和剩余风险。
