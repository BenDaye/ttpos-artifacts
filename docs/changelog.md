# 变更日志

## 2026-05-02 12:38 [QUAL-003]

Dashboard UI 文案 brand-neutral 收敛：

- `app-form-dialog.tsx` 创建 application 对话框 name 字段 `placeholder` 从 `ttpos-pos` 改为 `my-app`，不再向用户暗示这是 TTPOS 专属工具
- `tuf/bootstrap-panel.tsx` App name 字段同样收敛（前端入口禁用，但顺手清理避免将来恢复返工）
- 不动 `@ttpos/shared` 等 monorepo 内部 package 命名（结构性命名重命名需单独立项）；不动 demo seed `TTPOS-Cashier`（客户数据，不是产品 brand）
- 在跨 session memory 保存产品定位 feedback（dashboard / server 是通用平台 ZEHub，brand-neutral 准则）

Quality gates passed for dashboard-next: `bun run typecheck`、`bun run test` 12/12、`bun run lint`（0 errors / 46 既存 warnings 无新增）。e2e 无依赖 `ttpos-pos` 字面量。

## 2026-05-02 11:40 [BUG-010]

修复 Upload version 对话框允许编辑 App name 的业务漏洞，并移除孤悬的全局上传入口：

- `upload-version-dialog.tsx` 的 App name 字段从可编辑 `<Input {...form.register('app_name')} />` 改为 `<Input value={appName} disabled readOnly />`；prop 从 optional `defaultAppName` 改为必传 `appName`，并在 `useEffect` 中把 prop 同步进 form state；label 行加 hint "Locked to this app"
- `applications-page.tsx` 顶部的全局 "Upload version" 按钮、`uploading` state、`UploadVersionDialog` 实例与对应的 `Upload` / `UploadVersionDialog` import 全部移除；upload 流程现在只能从 app detail page 触发，从根本上消除"用户在列表页被迫手输 app name"的错位流程
- `app-detail-page.tsx` 调用 `defaultAppName` → `appName`；`apps.json`（en / zh）新增 `upload_dialog.app_name_locked` 词条
- `e2e/applications.spec.ts` 删除依赖被移除按钮的 `upload version button opens upload dialog` 用例（同等覆盖已在 `app-detail.spec.ts` 内的 `upload version button opens upload dialog with app pre-filled` 保留）

Quality gates passed for dashboard-next: `bun run typecheck`、`bun run test` 12/12、`bun run lint`（0 errors，46 既存 warnings 无新增）、`bun run test:e2e` 79/79（少 1 项是移除了不再适用的用例）。

## 2026-05-02 11:25 [BUG-009]

修复 Select popup 与 trigger 视觉脱节、Upload version dialog Flag 行溢出：

- `select.tsx` 在 `<BaseSelect.Positioner>` 显式 `alignItemWithTrigger={false}`，popup 不再以"当前 item 中心对齐 trigger 中心"展开覆盖 label，而是规规矩矩贴 trigger 下方
- `select.tsx` `SelectItem` 改 `text-base px-3 py-2`，与 trigger 的 `text-base h-11 px-5` 字号 / padding 节奏协调，从看起来像两组件变成 trigger + 它的下拉
- `index.css` `.select-popup-width` 从 `min-width: var(--anchor-width)` 改为 `width: var(--anchor-width)`，popup 宽度严格等于 trigger anchor，不再被 popup 内容撑得比 trigger 宽
- `upload-version-dialog.tsx` 把 Publish / Critical / Intermediate 三个 FlagCheckbox 移出 `grid sm:grid-cols-2`，作为 grid 之后的独立一行 `flex flex-wrap gap-x-4 gap-y-2`；先前三个 flag 横排塞在半宽 cell 里、Intermediate 直接溢出 dialog 右边界

Quality gates passed for dashboard-next: `bun run typecheck`、`bun run test` 12/12、`bun run lint`（0 errors，46 既存 warnings 无新增）、`bun run test:e2e` 80/80。

## 2026-05-01 19:35 [BUG-008]

修复 dashboard-next Upload version 对话框的 selector 与文件输入回归：

- `select.tsx` 用 `<BaseSelect.Portal>` 包 Positioner，popup 通过 portal 脱离 `DialogContent` 的 `-translate-x-1/2 -translate-y-1/2` transform 包围；之前 transform 父级让内部 `position: fixed` Positioner 相对 transform 框定位，弹层完全飘出 dialog
- `select.tsx` `SelectField` 增加 `clearable` prop（默认 false），不再无条件在 dropdown 顶部塞 `<SelectItem value="">` 空值项；当前所有调用点都是 required，自动失去会让 form 校验失败的"空选项"
- `checkbox.tsx` 圆角从 `rounded-sm` (8px) 改为 `rounded-xs` (5px)：本项目 `--radius-sm = 8px` 与 16px Checkbox 半径相等导致视觉退化为圆，与 radio 难以区分；改 5px 让 Checkbox 视觉保持方形
- 新增 `shared/components/ui/file-input.tsx`：隐藏 `sr-only <input type="file">` + 可见 `Button` 触发；upload-version / add-artifact / app-form 三个 dialog 的 native file input 全部切换。`common.json` 新增 `file_input.choose_one / choose_many / empty` i18n 词条（中英）；按钮文案不再随浏览器 locale 显示 "选择文件 / 未选择任何文件"

Quality gates passed for dashboard-next: `bun run typecheck`, `bun run test` 12/12, `bun run build`, `bun run lint`（0 errors，46 既存 warnings、无新增），focused upload / add-artifact Playwright e2e 5/5，full Playwright e2e 80/80。

## 2026-05-01 19:25 [QUAL-002]

收敛 dashboard-next Permission Matrix 类型强转：

- `permission-matrix.tsx` 引入 `pickBoolFields(group: object)`，仅提取布尔字段返回 `Record<string, boolean>`
- Apps / Channels / Platforms / Archs 4 组渲染从 `value.<Group> as unknown as Record<string, boolean>` 改为 `pickBoolFields(value.<Group>)`，消除全部强转
- 单测新增两项：`Allowed: string[]` 等非布尔字段会被丢弃；后端把布尔字段误序列化为 null/undefined 时也被丢弃，避免静默落入 falsy

Quality gates passed for dashboard-next: `bun run typecheck`, `bun run test` 12/12（新增 2 项），`bun run lint`（0 errors，46 既存 warnings、无新增）。

## 2026-05-01 19:03 [BUG-007]

修正 dashboard-next version 状态表达与 selector 视觉回归：

- Version card 顶部留白改用 `pt-xl`，解决顶部 padding 不足的问题
- Version header 改为 `version + uppercase channel`，channel 固定在 version 右侧并允许换行
- Draft / Published / Critical 不再用状态 badge 承担主视觉，改由 version text 颜色表达：Critical 使用 `text-destructive`，Published 使用 `text-primary`，Draft 使用默认 `text-foreground`；Intermediate 作为辅助状态文本，不覆盖颜色优先级
- 新增共享 `SelectField`，Upload version / Edit version / Add artifact 全部迁移到同一 selector 实现
- Base UI selector option 行改为固定 indicator 槽 + 文本列，trigger 与 option 的文本和 icon 对齐；select popup 留在 Dialog DOM 内，避免被 dialog 层级拦截
- 更新 e2e 覆盖 channel 右侧/uppercase、状态颜色优先级、selector 对齐、长 version mobile 可读性和全量回归

Quality gates passed for dashboard-next: static token scan, typecheck, lint (existing warnings only), unit tests 10/10, production build, focused app-detail Playwright e2e 10/10, responsive Playwright e2e 27/27, and full Playwright e2e 80/80.

## 2026-05-01 18:26 [BUG-006]

修正 dashboard-next version card 与 Add artifact 细节：

- Version header 改为 `channel chip + version + status chip`，channel 位于 version 左侧
- Published chip 改用 primary token 实色，Draft 保持 muted neutral token，状态颜色明确区分
- Artifacts 不再用 chip 表现 platform / architecture，改为 `platform / architecture` 文本标题 + 文件名副标题
- Artifact 文件名在 `package` 只有 `.png` / `.md` 等扩展名时，从下载 link 的 key 中回退解析真实文件名
- Add artifact 移除 changelog 字段，不再允许在追加 artifact 时顺带修改版本 changelog
- Add artifact select 隐藏浏览器默认 arrow，改用 DESIGN spacing token 定位的 lucide chevron

Quality gates passed for dashboard-next: static token scans, typecheck, lint (existing warnings only), production build, focused Playwright e2e 37/37, and visual screenshots for version card / Add artifact dialog.

## 2026-05-01 17:55 [BUG-005]

重设 dashboard-next version card 视觉层级：

- Version card 改为更克制的 release tile：版本号作为主视觉，Draft 收敛为 metadata chip，移除顶部 Draft 胶囊和 draft 边框强调
- Changelog / Download / Add artifact 改为 text-link tool row，降低操作按钮对内容的抢占
- Artifacts 从嵌套子卡片改为分隔列表，platform / arch 保持轻量 chip，文件名和行内下载/删除动作更易扫描
- Version grid 调整为移动端 1 列、`lg/xl` 2 列、`2xl` 3 列；1280px 卡片宽度从约 323px 提升到约 490px，1440px 约 570px，仍保持 1920px 3 列
- 本地 Playwright 视觉截图验证 1280、1440、375 viewport 的 document width 均等于 viewport width，无横向溢出

Quality gates passed for dashboard-next: static token scans, typecheck, lint (existing warnings only), unit tests, production build, focused Playwright e2e 37/37, full Playwright e2e 80/80, and `git diff --check`.

## 2026-05-01 17:30 [BUG-004]

收敛 dashboard-next version card 网格密度：

- 应用详情 version cards 保持移动端 1 列、中屏 2 列、宽屏最多 3 列，不再在超宽屏压缩到 4 列
- 响应式 Playwright grid case 更新为 1920px 仍最多 3 列，继续验证无 document overflow

Quality gates passed for dashboard-next: focused responsive Playwright e2e, typecheck, production build, static token scans, and `git diff --check`.

## 2026-05-01 06:04 [BUG-003]

修复 dashboard-next 响应式视觉回归：

- EmptyState 增加 token 化 readable 内容容器，`No versions yet`、`No API tokens` 等描述不再被压成窄列
- 应用详情 version cards 改为按屏幕宽度响应式排列，单个 version 不再在超宽屏占满整行
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
