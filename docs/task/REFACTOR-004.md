# REFACTOR-004: 收敛 Dashboard Next 设计令牌

- **status**: completed
- **priority**: P1
- **owner**: codex
- **createdAt**: 2026-04-30 20:37
- **completedAt**: 2026-04-30 21:00
- **related**: PLAN-006, REFACTOR-001, REFACTOR-002, REFACTOR-003

## 描述

`dashboard-next` 已完成生产替换阻断项修复，但 UI 令牌层仍沿用 base-nova/neutral 默认值，未严格从根目录 `DESIGN.md` 映射；组件层还存在 Tailwind arbitrary value、硬编码色值、非 DESIGN.md 半径/字号/间距/阴影等视觉值。需要按 `/pma-web` 和根协作指南重构 Dashboard Next 的视觉令牌使用方式，使 UI 视觉值统一来自 `DESIGN.md` 并通过 Tailwind v4 `@theme` 接入。

验收标准：

1. `dashboard-next/apps/web/src/index.css` 中 Tailwind v4 `@theme` 与 CSS 变量完整映射 `DESIGN.md` 的颜色、字号、间距、圆角与允许的阴影语义。
2. `dashboard-next` UI 源码不再新增或保留 hex 字面量、Tailwind arbitrary value、未令牌化的颜色/字号/间距/圆角/阴影。
3. 共享 UI primitives 与业务页面改用设计令牌类或少量命名组件变体，不改变现有 API 契约、路由、localStorage key、TUF 禁用决策。
4. `bun run typecheck`、`bun run lint`、`bun run test`、`bun run build` 在 `dashboard-next/` 内通过；必要时补充 e2e 或浏览器验证。

## 进行时描述

已按 DESIGN.md 收敛 Dashboard Next 视觉令牌。

## 依赖

- **blocked by**: (无)
- **blocks**: Dashboard Next 视觉一致性与后续 UI 改动

## 笔记

- 2026-04-30 20:37：创建并认领任务。已完成调查，等待用户审批 PLAN-006 后再修改 `dashboard-next` 代码。
- 2026-04-30 20:49：PLAN-006 已获批准，开始实现。
- 2026-04-30 21:00：实现完成。`dashboard-next` 已清理 UI 源码中的 hex、Tailwind arbitrary class、非 DESIGN.md 调色板色名与 shadow utility；质量门禁通过：typecheck、lint（保留既有 warnings）、unit tests、build、Playwright e2e 53/53。
