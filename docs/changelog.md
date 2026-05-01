# 变更日志

## 2026-05-01 06:04 [BUG-003]

修复 dashboard-next 响应式视觉回归：

- EmptyState 增加 token 化 readable 内容容器，`No versions yet`、`No API tokens` 等描述不再被压成窄列
- 应用详情 version cards 改为按屏幕宽度 1/2/3/4 列排列，单个 version 不再在超宽屏占满整行
- Draft version card 增加卡片级顶部 badge，同时保留 inline 状态 badge
- ToggleGroup 默认 selected 状态改为 primary token 高亮，LayoutSwitcher 和 Statistics range 共享一致反馈
- Statistics range label 增加 default fallback，避免翻译未命中时显示 key
- 响应式 Playwright 用例扩展到 27 条，覆盖空状态 readable 宽度、tokens 空状态、Statistics 高亮、version grid 和 Draft badge

Quality gates passed for dashboard-next: static token scans, typecheck, lint (existing warnings only), unit tests, production build, responsive Playwright e2e 27/27, and full Playwright e2e 80/80.

## 2026-05-01 05:03 [BUG-002]

优化 dashboard-next 窄屏交互细节：

- EmptyState 改为窄屏友好的 token 化 padding、可换行标题/描述和 action 容器，避免 `No versions yet` 等提示文案被压缩
- 应用、渠道、平台、架构搜索框新增 focus-within 展开效果，宽度与过渡由 `DESIGN.md` 已映射 token 驱动
- LayoutSwitcher 当前项改为 primary token 高亮，保留 `aria-pressed` 状态
- 应用详情 VersionRow 改为多行分区布局，长版本号、状态 badge、操作按钮和 artifact 信息不再假设单行展示
- 响应式 Playwright 用例补充空版本、搜索展开、布局高亮和长 version row 回归

Quality gates passed for dashboard-next: static token scans, typecheck, lint (existing warnings only), unit tests, production build, responsive Playwright e2e 21/21, and full Playwright e2e 74/74.

## 2026-05-01 03:51 [BUG-001]

修复 dashboard-next 响应式布局溢出：

- 将移动端主导航改为 overlay drawer + backdrop，避免 sidebar 在小屏继续占用主内容 flex 宽度；桌面端 sticky sidebar 与折叠偏好保持不变
- 为 AppShell、PageHeader、Apps card/list/board、应用详情过滤器、Statistics filters/charts、Settings panels 和 taxonomy 页面补齐收缩边界、局部滚动和换行策略
- board 视图保留横向浏览，但滚动被限制在 board 区域内部，不再把 document 撑宽
- 调整移动端导航过渡为 transform/width 受控过渡，并支持 reduced motion
- 新增响应式 Playwright 用例，覆盖 320/375/768/1024 宽度下 `/applications` card/board、应用详情、`/statistics`、`/settings` 的 document overflow 回归

Quality gates passed for dashboard-next: static token scans, typecheck, lint (existing warnings only), unit tests, production build, responsive Playwright e2e 17/17, and full Playwright e2e 70/70.

## 2026-04-30 21:00 [REFACTOR-004]

收敛 dashboard-next 设计令牌与视觉值来源：

- 将 `dashboard-next/apps/web/src/index.css` 重建为 Tailwind v4 `@theme` token 层，语义 token 派生自根目录 `DESIGN.md` 的 Apple 色彩、字号、间距、圆角与无常规 UI 阴影策略
- 移除 `index.html` 硬编码 theme-color hex
- 收敛共享 UI primitives：Button、Badge、Card、Dialog、Input、Select、Popover、DropdownMenu、Tabs、Switch、Checkbox 等不再使用 arbitrary visual value、调色板状态色或 shadow utility
- 清理 Apps/Auth/Settings/Statistics/TUF 相关 UI 的 `w-[...]`、`text-[...]`、arbitrary grid、`transition-[...]`、emerald/amber/red/blue/gray 状态色等
- Recharts tooltip/axis 样式改为 CSS token 驱动，保持统计图行为不变

Quality gates passed for dashboard-next: static token scans, typecheck, lint, unit tests, production build, and 53/53 Playwright e2e. Lint still reports the existing warning set but exits successfully.

## 2026-04-28 17:16 [REFACTOR-003]

Fixed dashboard-next production replacement blockers from PLAN-005:

- aligned CI/CD token create/revoke with server contracts: non-empty app ObjectID scopes and DELETE JSON body
- restored private artifact copy/download signed URL resolution through authenticated `/download?key=...`
- restored platform updater management with required `updaters` objects and a single default updater
- restored upload/add-artifact updater, Tauri signature, and intermediate support; version edit now preserves intermediate
- restored channels/platforms/architectures local search and safe login redirect preservation
- changed team user allowed scopes to save IDs while displaying names and coercing legacy name values on save
- hardened Playwright mocks to reject incorrect token, platform, upload/update, and private download request shapes

Quality gates passed for dashboard-next: typecheck, lint, unit tests, production build, and 53/53 Playwright e2e. Reassessment: dashboard-next meets the production replacement bar for the audited blockers in REFACTOR-003; TUF remains intentionally disabled.

## 2026-04-26 [REFACTOR-002] Dashboard 业务逻辑补完

REFACTOR-001 后续实测发现 dashboard-next 多处业务能力降级，本任务按 PLAN-004 分 5 阶段在 BKD 编排下补完，每阶段独立上线 vm-node02。

- **R0** 前端禁用 TUF：settings sidebar 移除 TUF tab，`/settings/tuf` 显示停用占位；features/tuf 代码与脚本生成器保留以便后续 R4 重启
- **R1** Apps 三视图与版本过滤器：LayoutSwitcher（Card/List/Board）+ ui-store 持久化；AppListView 紧凑表格；AppBoardView 按 channel 分列（useQueries 预拉版本判定归属）；详情页 VersionFilterBar 多选 channels/platforms/archs + 文本搜索 + published/critical 切换 + 已激活计数清除
- **R2** Changelog 预览 + Artifact 下载弹窗：版本卡片新增 Changelog (n) / Download (n) 按钮，分别打开 react-markdown 渲染的结构化预览与按 platform 分组的下载弹窗（含 copy URL）；非 admin 用户自改密码功能因 server 端无 `/user/update-self` 端点回退为"请联系管理员"提示
- **R3** Statistics 多维过滤器：TelemetryFilterBar 含 4 个 multi-select popover（apps/channels/platforms/architectures）+ today/week/month 时间范围；过滤变化触发 telemetry 重查
- **R5** e2e 用例迁移与旧 dashboard 退役：fork dashboard/e2e 全 8 套（auth/applications/channels/platforms/architectures/settings-tokens/navigation/app-detail）到 `dashboard-next/e2e/`；mock handlers 与 auth fixture 统一收敛到 `_fixtures/`，按需支持 401 / forbidden 等 overrides；选择器全面适配 Base UI Dialog（`role=dialog` + 双 Close 按钮）/ EntityFormDialog（默认 submit 标签 "Save"）/ react-hook-form Required 校验 / BaseCheckbox 双 role=checkbox 渲染 / `aside[aria-label="Primary"]` 导航；mock 路由对 `/signup` 仅拦截 POST 避免 SPA 路由被劫持；mock ID 改为纯 hex 防止 Badge slice(0,8) 与名称冲突。`bun run test:e2e` 45/45 全绿；`.github/workflows/build-dashboard.yaml` 标记 deprecated（移除 main 分支触发，仅保留 release + workflow_dispatch）。

部署：vm-node02 已切到 dashboard-next 镜像；旧 dashboard 镜像与 workflow 保留作为回滚锚点。

## 2026-04-25 [REFACTOR-001] 按 pma-web 规范重构 Dashboard

新增 `dashboard-next/`，作为现有 `dashboard/` 的并行重写版本，验收完成后将取代旧版。业务逻辑（API 契约、auth 流程、TUF 脚本生成器、localStorage key）完全保留。

技术栈变更：
- React 18 → 19；Vite 6 → 8；TypeScript 5 → 6；Tailwind 3 → 4（@theme + oklch）
- Yarn 4 → Bun workspaces；ESLint 8 + Prettier → ESLint 9 flat + `@antfu/eslint-config`
- React Router v6 → TanStack Router 文件路由；Formik → react-hook-form + Zod
- Axios → 自研 fetch wrapper（`shared/lib/http.ts`）；新增 Zustand UI 状态
- shadcn/ui (`base-nova`) + `@base-ui-components/react` 替代 Radix-UI 自定义封装
- 引入 react-i18next（英文优先，中文可切换）
- 新增 Vitest 4 单元测试 + Playwright 烟测

目录结构（新）：
```
dashboard-next/
├── apps/web/                      React 19 SPA
├── packages/shared/               共享类型与常量
├── packages/config/tsconfig/      共享 TS 基础配置
├── e2e/                           Playwright 烟测
├── Dockerfile                     多阶段构建（bun → nginx）
└── eslint.config.js
```

CI/CD：
- 新增 `.github/workflows/build-dashboard-next.yaml`，独立的 quality-gates（lint/typecheck/test/build/e2e）+ Docker 镜像构建
- 新镜像名：`ghcr.io/<owner>/ttpos-artifacts/faynosync-dashboard-next`
- 旧 `build-dashboard.yaml` 与 `dashboard/` 暂时保留，作为回滚锚点

业务保留承诺：
- 17 条 API 端点请求/响应契约不变
- 路由路径完全一致（`/`、`/applications`、`/applications/:appName`、`/channels`、`/platforms`、`/architectures`、`/statistics`、`/settings`、`/settings/tuf`、`/settings/tokens`、`/signin`、`/signup`）
- localStorage key 不变（`token`、`themeMode`、`layoutPreference`、`tuf-history`）
- TUF 脚本生成器（7 份纯函数文件）原样平移
- 401 重定向行为通过 fetch wrapper 等价实现

后续增强（不阻塞此次合入）：
- `applications` 列表的 list / board 视图（当前仅 card）
- TUF Bootstrap / RotateRootKeys 多步向导（当前仅 Bootstrap 单脚本生成器；旧 dashboard 多步向导仍可用）
- 完整 e2e 用例迁移（当前仅基础烟测；旧 e2e 套件依赖 Formik/Radix 选择器需重写）

## 2026-03-23 [决策]

Fork FaynoSync 后端（ku9nov/faynoSync），断连上游，重构为 monorepo 结构。

主要变更：
- 新增 `server/`：FaynoSync Go 后端（已 fork 至 BenDaye/faynosync-server）
- `src/` → `dashboard/`：Dashboard React SPA 移入子目录
- `faynosync/` → `deploy/`：部署配置重命名
- 修复版本唯一性 bug：`Upload()` 查询加入 `channel_id`，新增 MongoDB 唯一复合索引
- 新增 `build-server.yaml` 工作流：后端 Docker 镜像自动构建
- 更新 `build-dashboard.yaml`：构建上下文路径适配 monorepo
- 更新 `deploy/docker-compose.yml`：后端镜像从 `ku9nov/faynosync` 切换为自建镜像
