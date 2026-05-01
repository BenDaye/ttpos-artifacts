# QUAL-002: 收敛 Permission Matrix 类型强转

- **status**: completed
- **priority**: P2
- **owner**: codex
- **createdAt**: 2026-05-01 19:25
- **completedAt**: 2026-05-01 19:25
- **related**: PLAN-014, QUAL-001

## 描述

`permission-matrix.tsx` 渲染 4 个权限组（Apps / Channels / Platforms / Archs）时，把整个权限对象通过 `as unknown as Record<string, boolean>` 传给子组件 `PermissionGroupCard`。该对象既含布尔标志，也含 `Allowed: string[]`，强转绕过了类型检查；如果后端为某个布尔字段返回 null/undefined，UI 会被静默渲染为 falsy 而不会暴露契约偏差。

验收标准：

1. 移除 `permission-matrix.tsx` 中所有 `as unknown as Record<string, boolean>` 强转。
2. 由 helper 在父组件层显式提取布尔字段，子组件接口不变。
3. helper 行为有单测覆盖：丢弃数组 / null / undefined 字段，仅保留 boolean。
4. dashboard-next 既有 typecheck / test / lint gate 全部通过，无新增 warning。

## 进行时描述

完成 permission-matrix 类型强转收敛与 helper 单测。

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

- 2026-05-01 19:25：直接进入实施。引入 `pickBoolFields(group: object): Record<string, boolean>`，对每个权限组调用一次；4 处 `as unknown as` 全部消除。新增两个单测覆盖：`Allowed` 数组被丢弃；后端返回 null/undefined 的布尔字段被丢弃。验证：`bun run typecheck`（pass）、`bun run test`（12/12 pass，新增 2 项）、`bun run lint`（0 errors，46 既存 warnings、无新增）。
