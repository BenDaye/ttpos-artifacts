# PLAN-010 Dashboard Next 版本卡片网格密度收敛

- **status**: completed
- **createdAt**: 2026-05-01 17:30
- **approvedAt**: 2026-05-01 17:30
- **completedAt**: 2026-05-01 17:30
- **relatedTask**: BUG-004

## 现状

用户反馈 BUG-003 部署后的 version card 在超宽屏下显得局促。截图显示 4 列逻辑会让单个 version card 变成窄卡，而 version card 内包含版本号、状态、操作按钮和 artifact 列表，信息密度明显高于 platform/channel/architecture 等 taxonomy cards。

已确认代码点：

1. `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx` 使用 `md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`。
2. `dashboard-next/e2e/responsive-layout.spec.ts` 的 grid case 明确要求 1920px 下 4 列。
3. `docs/changelog.md` BUG-003 条目记录为 1/2/3/4 列，需要随行为收敛。

## 方案

- 移除 version grid 的 `2xl:grid-cols-4`，保留 mobile 1 列、`md` 2 列、`xl+` 3 列。
- 将 e2e grid case 改为 1920px 仍 3 列，并保留 document overflow 断言。
- 更新 BUG-003 changelog 描述，并新增 BUG-004 changelog 说明本次密度收敛。
- 执行 focused responsive e2e、typecheck/build、视觉值扫描和 `git diff --check`。

## 风险

- 超宽屏下可见 version 数量下降，但换来更稳定的 action/artifact 可读宽度。
- 如果未来 version card 改成更轻量结构，可以再重新评估 4 列；当前信息密度不适合。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/e2e/responsive-layout.spec.ts`
- `docs/changelog.md`
- PMA task/plan index 和 detail

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策

## 批注

- 2026-05-01 17:30：用户回复 `proceed`，按最多 3 列方案实现。
- 2026-05-01 17:30：实现完成。移除 `2xl:grid-cols-4`，更新 1920px e2e 为 3 列；验证通过：typecheck、build、responsive e2e 27/27、static token scans、git diff --check。
