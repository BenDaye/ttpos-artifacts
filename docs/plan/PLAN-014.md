# PLAN-014 收敛 Permission Matrix 类型强转

- **status**: completed
- **createdAt**: 2026-05-01 19:25
- **approvedAt**: 2026-05-01 19:25
- **completedAt**: 2026-05-01 19:25
- **relatedTask**: QUAL-002

## 现状

`apps/web/src/features/settings/components/permission-matrix.tsx` 中 `PermissionGroupCard` 子组件需要 `flagValues: Record<string, boolean>` 来渲染勾选项，父组件直接把整个权限组对象 `value.Apps` / `value.Channels` / `value.Platforms` / `value.Archs` 通过 `as unknown as Record<string, boolean>` 强转传入。但这些对象同时包含 `Allowed: string[]`，不符合 `Record<string, boolean>` 契约；强转一旦后端把布尔字段误传为 null/undefined（`normalizePermissions` 之外的旁路），UI 也会静默吃掉。

## 方案

- 在 `permission-matrix.tsx` 增加并导出 `pickBoolFields(group: object): Record<string, boolean>`，遍历 `Object.entries`，仅保留 `typeof === 'boolean'` 的键值对。
- 4 处调用从 `value.<Group> as unknown as Record<string, boolean>` 改为 `pickBoolFields(value.<Group>)`。
- 子组件 `PermissionGroupCard` 接口与现有 `flagValues[flag]` 渲染逻辑均保持不变。
- 单测扩展：覆盖 `Allowed` 数组被丢弃、null/undefined 布尔字段被丢弃。

## 风险

- helper 的 `object` 入参类型放弃了静态字段保证，但合同由调用点的 `value.<Group>` 静态类型守住；helper 自身职责单一、可单测。
- 不改变运行时语义：之前 `flagValues['Allowed']` 不会被 `flags` 列表查询到；现在 helper 直接不输出该键，行为等价。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/features/settings/components/permission-matrix.tsx`
- `dashboard-next/apps/web/src/features/settings/components/permission-matrix.test.ts`
- PMA task / plan / changelog 同步

不改：

- 后端权限契约
- TUF / routeTree.gen.ts / localStorage key
- 任何其他模块的类型或测试

## 批注

- 2026-05-01 19:25：单文件类型收敛 + helper 单测，按 AGENTS.md 视为质量收敛任务直接进入实施。验证通过：`bun run typecheck`、`bun run test`（12/12，新增 2 项）、`bun run lint`（既存 46 warnings，无新增）。
