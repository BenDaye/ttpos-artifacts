# PLAN-009 Dashboard Next 响应式视觉回归修复

- **status**: completed
- **createdAt**: 2026-05-01 05:50
- **approvedAt**: 2026-05-01 05:50
- **completedAt**: 2026-05-01 06:04
- **relatedTask**: BUG-003

## 现状

本轮反馈来自 BUG-002 部署后的实际截图。继续遵循 `/pma`、`/pma-web`、根 `AGENTS.md`、`CLAUDE.md` 和 `DESIGN.md`：不改 API、路由、localStorage key、TUF 禁用决策，不新增 hex 字面量或 arbitrary Tailwind value；视觉值继续通过 `DESIGN.md` 已映射到 Tailwind v4 `@theme` 的 token 或基于这些 token 的 CSS utility 接入。

已确认的根因：

1. `shared/components/empty-state.tsx` 根容器虽然是 `max-w-full`，但 icon/title/description/action 是 `items-center` flex column 下的 auto-width flex item；描述本身没有稳定 readable width，仍可能收缩成窄列。截图中的 `No versions yet` 和 `No API tokens` 属于同一个共享组件问题。
2. `features/apps/components/app-detail-page.tsx` 的 versions 外层仍是 `grid min-w-0 gap-3` 单列；上一轮只改了 `VersionRow` 内部 header 分区，没有把 version cards 变成响应式网格。
3. Draft 状态目前只是版本信息里的普通 `Badge variant="warning"`，在宽卡片上视觉权重过低；需要成为 version card 的卡片级状态标记。
4. `features/telemetry/components/filter-bar.tsx` 的 range `ToggleGroupItem` 只依赖 `ui/toggle-group.tsx` 默认 `accent` selected 样式，和背景差异不够；`LayoutSwitcher` 单独加了 primary selected class，Statistics 没有同步。
5. 现有 `responsive-layout.spec.ts` 只断言无 document overflow 和局部可见，没有覆盖空状态描述宽度、settings tokens 空状态、version grid 列宽、draft badge 的卡片位置，以及 Statistics button group 的 computed selected 差异。

## 方案

### R1 共享 EmptyState 可读宽度

- 在 `EmptyState` 内部增加稳定的文本/action 包裹层，例如 `dashboard-empty-state-body`，宽度使用 `DESIGN.md` spacing token 组合计算，并限制在 `100%` 内。
- 标题、描述和 action 使用 `w-full`、居中和合理换行；描述不再依赖 `sm:max-w-md` 这类会在 flex item 中产生不可控收缩的局部限制。
- 所有引用页自动受益，重点覆盖 `No versions yet`、`No API tokens`、team users、TUF disabled、taxonomy empty states。

### R2 Version cards 响应式网格

- 将应用详情 versions 外层从单列 grid 改为响应式 grid：移动端 1 列，中等屏 2 列，大屏 3 列，超宽 4 列。
- `VersionRow` 保持卡片化，但内部转为纵向信息架构，actions 和 artifacts 按卡片宽度换行，不再假设横向整行布局。
- Artifact 文件名使用可读换行策略，下载/删除操作在窄卡片内保持可达。

### R3 Draft 卡片级 badge

- 对 unpublished version 在 `Card` 顶部加一个卡片级 Draft badge，视觉位置类似 debug badge，使用已有 `Badge` warning/primary token，不新增设计系统外颜色。
- 保留状态列表中的 published/draft 信息可访问性，避免只靠位置或颜色表达状态。

### R4 ToggleGroup selected 样式统一

- 将 primary selected 样式下沉到 `ToggleGroupItem` 默认样式，或抽出稳定 class 供 LayoutSwitcher 和 Statistics 共用。
- 确保 `aria-pressed`、`data-pressed` 和视觉高亮同步，Statistics range 当前项有明显 selected state。

### R5 验证加固

- 扩展 e2e：
  - `No versions yet` 描述在 320/375/1024px 下宽度不小于可读阈值，且无 document overflow。
  - Settings `No API tokens` 空状态同样通过可读宽度断言。
  - App detail 多版本 fixture 在 1024/1440/1920px 下呈现 2/3/4 列级别的 card width 行为。
  - Draft badge 出现在 unpublished version card 的卡片顶层。
  - Statistics range button selected computed background/text 与 inactive 有差异。
- 执行静态扫描，确认无新增 hex 字面量和 arbitrary Tailwind value。
- 运行 `bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`、`bun run test:e2e`。

## 风险

- Version cards 改成 4 列后，单卡可用宽度下降，需要同步收敛 actions/artifacts 的换行策略，否则会把单列溢出转移到卡片内部。
- ToggleGroup 默认 selected 样式下沉会影响所有 toggle group；当前引用面已查到 LayoutSwitcher 和 Telemetry range，需通过 e2e 覆盖两处。
- EmptyState 的 readable width 过大可能让短文案显得松散，因此使用 token 计算上限且保留居中布局。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/shared/components/empty-state.tsx`
- `dashboard-next/apps/web/src/shared/components/ui/toggle-group.tsx`
- `dashboard-next/apps/web/src/shared/components/layout-switcher.tsx`
- `dashboard-next/apps/web/src/features/telemetry/components/filter-bar.tsx`
- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/apps/web/src/index.css`
- `dashboard-next/e2e/responsive-layout.spec.ts`
- PMA task/plan/changelog

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策
- 旧版 `dashboard/`

## 备选方案

- **方案 A：共享组件 + 网格结构整体修复（推荐）**。一次性修掉同类空状态、toggle selected 和 version 卡片响应式问题，并用 e2e 防回归。
- **方案 B：只针对截图页面加 class**。改动更小，但 `EmptyState` 和 `ToggleGroup` 的同类引用仍会再次漏出问题。
- **方案 C：保持单列，只缩窄 version card 宽度**。能缓解超宽单卡，但不能达到 1-4 列的信息密度目标。

## 批注

- 2026-05-01 05:50：proposal created. Waiting for user approval before implementation per PMA.
- 2026-05-01 05:50：用户回复 `proceed`，开始实现。
- 2026-05-01 06:04：实现完成。执行内容：
  - `EmptyState` 增加 `dashboard-empty-state-body` readable 容器，标题、描述和 action 共享稳定宽度。
  - App detail versions 列表改为 1/2/3/4 列响应式 card grid，单个 version 不再在超宽屏占满整行。
  - Draft version card 增加卡片级顶部 badge，并保留 inline 状态 badge。
  - `ToggleGroupItem` 默认 selected 样式改为 primary token，LayoutSwitcher 和 Statistics range 共享高亮。
  - Statistics range labels 增加 default fallback，避免显示 `range.week` 等 key。
  - `responsive-layout.spec.ts` 扩展到 27 条，覆盖空状态 readable 宽度、tokens 空状态、Statistics selected、version grid 和 draft badge。
  - 验证通过：无新增 hex/arbitrary visual value、typecheck、lint、unit tests、build、responsive e2e 27/27、full Playwright e2e 80/80。
