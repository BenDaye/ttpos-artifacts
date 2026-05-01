# PLAN-011 Dashboard Next 版本卡片视觉层级重设

- **status**: completed
- **createdAt**: 2026-05-01 17:46
- **approvedAt**: 2026-05-01 17:46
- **completedAt**: 2026-05-01 17:55
- **relatedTask**: BUG-005

## 现状

用户反馈当前 version card 设计仍不够好看。截图和源码确认：

1. `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx` 中 `VersionRow` 在 draft 时同时显示顶部 Draft 胶囊和 metadata Draft badge，状态信息重复且过度抢眼。
2. Changelog、Download、Add artifact 使用 outline pill buttons，占据了卡片中部最强视觉层级。
3. 每个 artifact 又被包成独立 bordered rounded block，形成 card-in-card 的重量感。
4. 网格密度已经在 BUG-004 收敛为最多 3 列，问题主要转为单卡视觉层级，而非列数。

## 方案

- 将 Version card 改成 release tile：版本号使用更强的 display/text token，metadata 作为紧随其后的 compact chips。
- Draft 仅保留为 metadata 状态 chip，移除顶部 corner badge 和 draft 边框强调，避免重复和 CTA 化。
- 将 Changelog、Download、Add artifact 改成克制的 primary text/ghost tool row，保留可发现的文字标签和 accessible name。
- 将 artifacts 从子卡片改为分隔列表：platform/arch 作为轻量 chip，文件名作为主要文本，下载/删除在行尾。
- 调整 version grid breakpoint：移动端 1 列，`lg`/`xl` 2 列，`2xl` 以上 3 列，避免 1280/1440 下单卡过窄。
- 更新 focused e2e，继续覆盖 long version、action buttons、artifact 名称和 document overflow。

## 风险

- Draft 不再是角标后可能变得不够醒目；通过 metadata 状态 chip 和测试保留可见性。
- 操作入口降级后需要确保仍可被快速发现；保留文字标签，不改交互语义。
- DOM 层级调整可能影响 Playwright selector；同步更新 focused 用例。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/e2e/responsive-layout.spec.ts`
- `docs/task/BUG-005.md`
- `docs/plan/PLAN-011.md`
- `docs/task/index.md`
- `docs/plan/index.md`
- `docs/changelog.md`

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策

## 批注

- 2026-05-01 17:46：用户要求“遵循 DESIGN 再来一版”，按 version card 视觉层级重设方案实现。
- 2026-05-01 17:46：本地截图确认 1280px 下 3 列仍造成卡片局促，方案收敛为 `lg:grid-cols-2 2xl:grid-cols-3`。
- 2026-05-01 17:55：实现完成。验证通过：typecheck、lint（existing warnings only）、unit tests、production build、focused e2e 37/37、full e2e 80/80、static token scans、git diff --check；本地 Playwright screenshots 记录在 `tmp/version-card-redesign-*.png`。
