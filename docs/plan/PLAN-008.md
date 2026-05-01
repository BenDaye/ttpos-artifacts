# PLAN-008 Dashboard Next 窄屏交互细节优化

- **status**: completed
- **createdAt**: 2026-05-01 04:48
- **approvedAt**: 2026-05-01 04:57
- **completedAt**: 2026-05-01 05:03
- **relatedTask**: BUG-002

## 现状

本次反馈来自 BUG-001 上线后的实际体验，遵循 `/pma`、`/pma-web`、根 `AGENTS.md`、`CLAUDE.md` 和 `DESIGN.md`。本轮不改变 API 契约、路由、localStorage key、TUF 禁用决策，也不新增 `DESIGN.md` 之外的视觉值。

调查到的具体代码点：

1. `shared/components/empty-state.tsx` 使用 `p-12`、标题 `text-base`、描述 `max-w-md`，在 320px 左右可用宽度下容易把文案和按钮压成紧凑块。
2. `applications-page.tsx` 搜索区域是 `w-full max-w-sm`，没有 `focus-within` 宽度/边框/背景反馈；channels/platforms/architectures 也有同类搜索模式。
3. `layout-switcher.tsx` 通过 `data-pressed={layout === value}` 标记当前布局，但 `toggle-group.tsx` 当前选中态只是 `data-pressed:bg-accent data-pressed:text-accent-foreground`，和外层 background 差异不足。
4. `app-detail-page.tsx` 的 `VersionRow` 仍是 `flex-wrap justify-between`：版本号/badge 在左，操作按钮在右。它能换行，但信息架构仍按单行头部设计，长版本号、多 badge、多按钮时会变成拥挤的横向争抢。

## 方案

### R1 EmptyState 窄屏可读性

- 调整 `EmptyState` 容器为 `w-full min-w-0`，窄屏 padding 使用 `p-lg`，较宽屏再提升到现有大留白。
- 标题、描述和 action 容器补齐 `max-w-full`、`break-words`、`flex-wrap`，避免标题或按钮被压缩。
- 保持视觉值来自 Tailwind v4 `@theme` 中已映射的 spacing、radius、typography token。

### R2 搜索框聚焦展开

- 抽出或增加命名 utility，例如 `dashboard-search-shell`，默认宽度与 focus-within 宽度都由 `--spacing-*` 组合计算。
- 应用到 Applications、Channels、Platforms、Architectures 的搜索框；移动端保持 `w-full`，桌面聚焦时从紧凑宽度扩到更宽但不超过父容器。
- 过渡只使用 width / border-color / background-color 等明确属性，并支持 reduced motion。

### R3 LayoutSwitcher 选中态

- 将 LayoutSwitcher 的当前选中态改成更明确的 primary token 反馈：例如 `data-pressed:bg-primary data-pressed:text-primary-foreground` 或 primary border + foreground。
- 保持 aria-label / aria-pressed，必要时补充 e2e 断言当前布局按钮具有可检测的 selected/pressed 状态。

### R4 VersionRow 多行布局

- 将 version row header 从“左右挤压”改成分区布局：版本信息区、状态 badge 区、操作区可独立换行。
- 长版本号使用 `break-all` 或 `overflow-wrap`，但 action buttons 独立成下一行/右对齐区域，不再和版本标题争抢同一行。
- artifact 列表同样按移动端 stacked、桌面横向对齐处理，保证 package 名、platform/arch badge 和下载/删除操作在窄屏下可读。

### R5 验证

- 扩展 `responsive-layout.spec.ts`：
  - 空版本状态在 320/375px 下标题和 action 可见、无 document overflow。
  - 搜索框 focus 后宽度增加或达到预期 expanded 状态。
  - LayoutSwitcher 切换后当前按钮有高亮/pressed 状态。
  - 长版本号 fixture 下 VersionRow 无 document overflow，操作按钮仍可见。
- 运行静态视觉扫描、`bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`、`bun run test:e2e`。

## 风险

- 搜索框展开可能影响 header actions 换行，需要限制 `max-width` 并让其只在可用空间内展开。
- LayoutSwitcher 使用 primary 高亮会更醒目，但要避免与主 CTA 混淆；如果过强，可退回 primary border + secondary background。
- VersionRow 改为多行会增加卡片高度，但更符合长版本/多 artifact 的真实数据展示。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/shared/components/empty-state.tsx`
- `dashboard-next/apps/web/src/shared/components/ui/toggle-group.tsx`
- `dashboard-next/apps/web/src/shared/components/layout-switcher.tsx`
- `dashboard-next/apps/web/src/features/apps/components/applications-page.tsx`
- `dashboard-next/apps/web/src/features/{channels,platforms,architectures}/components/*-page.tsx`
- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/apps/web/src/index.css`
- `dashboard-next/e2e/responsive-layout.spec.ts`

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策
- 旧版 `dashboard/`

## 备选方案

- **方案 A：按四个反馈点整体修复（推荐）**。统一处理空状态、搜索、切换器和 version row，e2e 覆盖完整体验。
- **方案 B：只调 class 微修**。改动小，但无法验证长版本号和搜索展开的真实行为，容易再次出现窄屏局部崩塌。
- **方案 C：只更新文案/隐藏部分按钮**。可以让页面短期不挤，但会牺牲功能可达性，不建议。

## 批注

- 2026-05-01 04:48：draft created. Waiting for user approval before implementation per PMA.
- 2026-05-01 04:57：用户回复 `proceed`，开始实现。
- 2026-05-01 05:03：实现完成。执行内容：
  - EmptyState 改为窄屏 token 化 padding、可换行标题/描述和 action 容器。
  - Applications/Channels/Platforms/Architectures 搜索框改为 `.dashboard-search-shell`，支持 focus-within 展开并遵守 reduced motion。
  - LayoutSwitcher 当前项使用 primary token 高亮，保留 `aria-pressed`。
  - App detail VersionRow 改为版本信息、状态 badges、actions、artifacts 分区多行布局。
  - `responsive-layout.spec.ts` 新增空版本、搜索展开、布局高亮、长 version row 回归。
  - 验证通过：静态视觉扫描、typecheck、lint、unit tests、build、responsive e2e 21/21、full Playwright e2e 74/74。
