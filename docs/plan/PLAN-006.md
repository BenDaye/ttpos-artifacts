# PLAN-006 Dashboard Next 设计令牌收敛

- **status**: completed
- **createdAt**: 2026-04-30 20:37
- **approvedAt**: 2026-04-30 20:49
- **completedAt**: 2026-04-30 21:00
- **relatedTask**: REFACTOR-004

## 现状

本次调查遵循 `/pma-web` 与根 `CLAUDE.md`/协作指南；`CLAUDE.md` 当前仅指向根 `AGENTS.md`，因此以根协作指南和 `DESIGN.md` 为准。`code-review-graph` 最小上下文显示仓库图已存在，当前调查风险低，Dashboard 关键流包括 `SignInPage`、`SignUpPage`、`StatisticsPage`。Serena 用于定位共享 UI primitive 符号。

现有 `dashboard-next` 已完成 REFACTOR-001/002/003，但视觉令牌层仍未满足本轮约束：

1. `dashboard-next/apps/web/src/index.css` 的颜色、半径和 chart/sidebar token 仍是 base-nova/neutral 默认 oklch 值，不是从根 `DESIGN.md` 的 Apple 风格系统映射。
2. 入口 `dashboard-next/apps/web/index.html` 仍有硬编码 `theme-color` hex。
3. 共享 primitives 中存在非 DESIGN.md 视觉值：`button.tsx`、`badge.tsx`、`dialog.tsx`、`card.tsx`、`input.tsx`、`select.tsx`、`switch.tsx`、`checkbox.tsx`、`popover.tsx`、`dropdown-menu.tsx` 等使用 `rounded-md/xl`、`shadow-sm/md/xl`、`text-sm/xs`、固定 `h-9/px-4` 等通用尺寸。
4. 业务组件中存在 Tailwind arbitrary value 和非令牌化尺寸：例如 `w-[min(...)]`、`max-h-[60vh]`、`grid-cols-[...]`、`text-[10px]`、`text-[11px]`、`transition-[width]`。
5. 业务状态颜色仍使用 Tailwind 调色板：例如 `emerald-*`、`amber-*`，与 `DESIGN.md` 单一 Action Blue + neutral surface 的限制冲突。
6. Recharts tooltip/axis 使用裸 `borderRadius: 8`、`fontSize: 11/12`，需要改成 CSS 变量驱动。

## 方案

### R1 主题 token 重建

- 在 `dashboard-next/apps/web/src/index.css` 中把 `DESIGN.md` 的颜色、字号、字重、行高、字距、间距、圆角映射到 Tailwind v4 `@theme`。
- 保留 shadcn/Base UI 语义 token 名称（`--color-background`、`--color-primary`、`--color-card`、`--color-border` 等），但其值全部由 DESIGN.md token 派生。
- 由于 `DESIGN.md` 允许的阴影仅限 product imagery，而 Dashboard 是管理后台，不新增卡片/按钮阴影；把常规 UI elevation 收敛为 hairline/border/backdrop blur。
- 将 meta theme color 改为运行期引用或与 CSS token 一致的非硬编码实现；若浏览器 meta 不能直接引用 CSS 变量，则删除硬编码 meta，避免违反 UI 源码 hex 禁令。

### R2 共享 UI primitives 收敛

- 调整 `Button`、`Badge`、`Card`、`Dialog`、`Input`、`Select`、`Popover`、`DropdownMenu`、`Tabs`、`Switch`、`Checkbox` 等 primitives，使尺寸、半径、字号、阴影和状态色均来自 `@theme` token。
- 统一按钮为 DESIGN.md 的 pill/utility grammar：主操作使用 Action Blue pill，secondary/outline 使用 token 化边框与 surface，danger 操作降级为图标/文案语义加 primary focus，不再引入红色调色板。
- Dialog / popover 的最大宽高使用命名 token 或 CSS class 变体，替代每处 `w-[min(...)]`、`max-h-[...]`。

### R3 业务页面清理

- 逐页替换 arbitrary value、硬编码视觉值和 Tailwind palette 色：Apps、Auth、Taxonomy、Settings、Statistics、TUF disabled surface。
- 对 App list/board 中复杂 grid arbitrary columns，改为 CSS module-like 命名 utility class 或标准 responsive grid/flex 组合，确保没有 arbitrary value。
- Statistics/Recharts 样式改用 CSS 变量读取 DESIGN.md typography/radius token，保留现有数据展示能力。

### R4 质量门禁与防回归

- 增加或复用静态扫描命令，确保 `dashboard-next/apps/web/src` 和 `index.html` 不含 hex 字面量、Tailwind arbitrary value、未允许 palette 色与 shadow utility。
- 运行 `bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`。
- 若 UI 改动影响 e2e selector 或布局，补跑 `bun run test:e2e`；必要时用浏览器截图检查登录页、应用列表、设置页、统计页。

## 风险

- `DESIGN.md` 是面向 Apple marketing/gallery 风格的设计系统，而 `dashboard-next` 是运维后台；直接套用大字号和低密度页面会降低管理工具效率。实施时应映射视觉 token，不把营销页面布局照搬到后台信息架构。
- 移除红/绿/黄状态色可能削弱状态识别；可用图标、文字和边框权重表达状态，若业务确实需要状态语义色，需要先把这些语义补入 `DESIGN.md`。
- 去掉 arbitrary grid 可能影响 App list/board 的桌面布局密度，需要用 e2e/浏览器验证。
- 大范围视觉类名替换容易产生无行为变化但快照/选择器波动；实现时优先改共享 primitive，再清理业务组件。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/index.css`
- `dashboard-next/apps/web/index.html`
- `dashboard-next/apps/web/src/shared/components/ui/*`
- `dashboard-next/apps/web/src/shared/components/{app-shell,page-header,empty-state,loading-spinner,...}.tsx`
- `dashboard-next/apps/web/src/features/*/components/*.tsx`
- 必要的测试或 e2e fixture

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策
- 旧版 `dashboard/`

## 备选方案

- **方案 A：一次性完成 DESIGN token compliance（推荐）**。优点是一次消除违规视觉值，后续 UI 开发规则清晰；缺点是视觉 diff 较大，需要完整前端 gate。
- **方案 B：只改 `index.css` token**。优点是改动小；缺点是 arbitrary value、palette 色和 shadow utility 仍留在业务代码里，不满足用户明确约束。
- **方案 C：先调整 `DESIGN.md` 以补后台语义 token**。优点是能保留状态色；缺点是扩大设计系统范围，需要用户先确认新的视觉值，本轮不默认采用。

## 批注

- 2026-04-30 20:37：draft created. Waiting for user approval before implementation per PMA.
- 2026-04-30 20:49：用户回复 `proceed`，开始实现。
- 2026-04-30 21:00：实现完成。执行内容：
  - `index.css` 已以 Tailwind v4 `@theme` 映射 `DESIGN.md` 的 Apple 色彩、字号、间距、圆角与无阴影 UI 策略。
  - 共享 UI primitives 已收敛按钮、badge、card、dialog、input/select、popover/menu、tabs、switch/checkbox 的视觉 token。
  - Apps/Auth/Settings/Statistics/TUF 相关 UI 已清理 arbitrary value、硬编码 hex、调色板状态色和 shadow utility。
  - 已补充静态扫描并通过 typecheck、lint、unit tests、build、Playwright e2e。
