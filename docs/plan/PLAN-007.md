# PLAN-007 Dashboard Next 响应式布局溢出修复

- **status**: completed
- **createdAt**: 2026-05-01 03:14
- **approvedAt**: 2026-05-01 03:43
- **completedAt**: 2026-05-01 03:51
- **relatedTask**: BUG-001

## 现状

本次调查遵循 `/pma`、`/pma-web`、根 `AGENTS.md`、`CLAUDE.md` 和 `DESIGN.md`。`CLAUDE.md` 当前仅指向根 `AGENTS.md`，所以以根协作指南、`dashboard-next` 源码和 `DESIGN.md` 为准。已用 Serena 定位 `AppShell` 符号，用 code-review-graph 获取最小上下文；本次主要风险集中在共享 shell 与 Apps/Statistics/Settings 视图。

浏览器复现基于本地 preview `http://127.0.0.1:4173`、Playwright route mock 和真实 DOM 宽度测量：

1. `/applications` card 视图：320px/375px 宽度下 `documentElement.scrollWidth` 为 758px，分别溢出 438px/383px；768px 仍溢出 6px。
2. `/applications` board 视图：320px/375px/768px/1024px 分别溢出 1932px/1877px/1500px/1244px。
3. `/applications/TTPOS-Cashier`：320px/375px 分别溢出 326px/271px。
4. `/statistics`：320px/375px 分别溢出 284px/229px。

代码根因：

1. `shared/components/app-shell.tsx` 的 sidebar 在移动端仍是正常 flex 子项，默认展开 `w-60`，直接抢占主内容宽度。
2. `AppShell` 主内容 wrapper 与 `main` 缺少 `min-w-0`，子元素最小内容宽度会向外撑开整个文档。
3. board 视图使用 `flex overflow-x-auto`，但父链没有收缩边界；`app-board-column` 固定为 `calc(var(--spacing-section) * 4)`，多个列会让 scroll container 的 min-content 宽度推大页面，而不是只在局部滚动。
4. `PageHeader` actions、过滤器条和 ToggleGroup/Button 默认 `whitespace-nowrap`，在窄屏下缺少 `min-w-0`、`flex-wrap` 与局部 overflow 策略，容易挤压标题或把页面撑宽。
5. 当前过渡主要依赖 `transition-all` 或宽度变化，移动端导航更适合 transform/opacity 过渡，避免内容区被动画宽度反复重排。

## 方案

### R1 响应式 AppShell

- 将移动端导航改为 fixed drawer + backdrop，不再参与主 flex 宽度；桌面端保留现有 sticky sidebar 与折叠行为。
- 在 AppShell 根、内容 wrapper、header 和 main 上补齐 `min-w-0` / `max-w-full` / 合理的 `overflow-x` 边界，避免子内容把文档撑宽。
- 新增移动端局部状态 `mobileNavOpen`，桌面 `sidebarCollapsed` 持久化逻辑保持不变；移动端菜单按钮只控制 drawer，不污染桌面折叠偏好。
- drawer 使用 `translate-x` 和 opacity/backdrop 过渡，并支持关闭按钮、点击遮罩关闭、路由项点击后关闭。

### R2 内容容器和可滚动面

- 为 `PageHeader` 增加收缩边界：标题区 `min-w-0`，actions 在窄屏允许换行或全宽排列，避免按钮组抢占标题空间。
- 为应用页、应用详情页、统计页和设置页的主容器补齐 `min-w-0 max-w-full`，把宽内容限制在页面内部。
- 将 board 视图包在显式局部滚动容器内，使用 `max-w-full min-w-0 overflow-x-auto`，列宽沿用 `DESIGN.md` 已映射 spacing token，不新增 arbitrary value。

### R3 控件换行与过渡整理

- 调整过滤器条、ToggleGroup、按钮组和长标签 popover trigger：必要时允许 wrap、`min-w-0` 和 truncate，保证长 channel/platform/arch 标签不撑宽页面。
- 将共享 ToggleGroup/Tabs/Button 的过渡保持在 transform/color/opacity 等明确属性，避免新增布局抖动。
- 保持所有视觉值来自既有 Tailwind token，若需要命名尺寸，放入 `index.css` 的命名 utility 并由 `--spacing-*` 组合计算。

### R4 防回归验证

- 增加聚焦 Playwright 响应式用例：在 320px、375px、768px、1024px 宽度验证 `/applications` card/board、应用详情页、`/statistics`、`/settings` 不产生文档级横向滚动。
- 保留既有 e2e fixture/mock，不改真实 API 契约。
- 运行静态视觉扫描、`bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`、`bun run test:e2e`。
- 用 Playwright 浏览器再测一次核心宽度，记录修复后 `scrollWidth <= clientWidth + 1`。

## 风险

- 移动端 drawer 会改变导航交互方式，需要确保键盘焦点、遮罩关闭和路由跳转后关闭行为可用。
- board 视图本身需要横向浏览，修复目标是“局部 board 区域滚动”，不是取消 board 横向滚动；测试需要区分局部滚动和文档级滚动。
- PageHeader actions 改为可换行后，窄屏高度会增加，但比横向溢出更可控。
- 共享组件过渡调整可能影响 e2e 选择器等待时机，需要用完整 e2e 验证。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/shared/components/app-shell.tsx`
- `dashboard-next/apps/web/src/shared/components/page-header.tsx`
- `dashboard-next/apps/web/src/shared/components/ui/{button,toggle-group,tabs}.tsx`
- `dashboard-next/apps/web/src/features/apps/components/*`
- `dashboard-next/apps/web/src/features/telemetry/components/*`
- `dashboard-next/apps/web/src/features/settings/components/*`
- `dashboard-next/apps/web/src/index.css`
- `dashboard-next/e2e/*` 或新增聚焦响应式 spec

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策
- 旧版 `dashboard/`

## 备选方案

- **方案 A：shell + 页面边界 + 聚焦 e2e 一次修复（推荐）**。能直接覆盖用户反馈的导航抢空间、内容崩塌、横向滚动和过渡抖动，改动面中等但风险可被 e2e 锁住。
- **方案 B：只在 `main` 上加 `overflow-x-hidden`**。改动小，但会遮掉 board 等真实宽内容，不能解决导航抢空间和内容不可达问题。
- **方案 C：移动端强制 sidebar collapsed**。能减少宽度占用，但仍在 flex 流中抢空间，320px 内容区仍偏窄，不解决 board 父链 min-content 撑宽。

## 批注

- 2026-05-01 03:14：draft created. Waiting for user approval before implementation per PMA.
- 2026-05-01 03:43：用户回复 `Proceed`，开始实现。
- 2026-05-01 03:51：实现完成。执行内容：
  - `AppShell` 移动端导航改为 fixed drawer + backdrop，桌面 sidebar 折叠逻辑保持不变。
  - 主内容、PageHeader、Apps card/list/board、应用详情过滤器、Statistics filters/charts、Settings panels 和 taxonomy 页面补齐 `min-w-0`、`max-w-full`、局部 overflow 与 wrapping。
  - 新增 `dashboard-next/e2e/responsive-layout.spec.ts`，断言 320/375/768/1024 宽度下核心页面无 document 级横向滚动，并覆盖移动端 drawer 跳转。
  - 验证通过：静态视觉扫描、typecheck、lint、unit tests、build、responsive e2e 17/17、full Playwright e2e 70/70。
