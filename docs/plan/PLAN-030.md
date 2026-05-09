# PLAN-030 Dashboard Next 移动端工具栏分层布局收敛

- **status**: completed
- **createdAt**: 2026-05-09 11:05
- **approvedAt**: 2026-05-09 11:08
- **completedAt**: 2026-05-09 11:14
- **relatedTask**: BUG-014

## 现状

当前问题集中在局部工具区，而不是页面级 overflow：

1. `VersionFilterBar` 使用单层 `flex max-w-full min-w-0 flex-wrap items-center gap-2`，搜索框为 `min-w-0 flex-1 sm:flex-none sm:w-60`。在 320px / 375px 下，搜索框会与 filter chip 同行竞争宽度，局部读写体验不稳定。
2. `TelemetryFilterBar` 同样使用单层 flex-wrap，Range ToggleGroup、分隔线、多个 filter popover 和 Clear 按钮都处在同一行流里。元素多时虽然可换行，但视觉上会堆在同一块区域。
3. `ApplicationsPage` 的 PageHeader actions 中 `LayoutSwitcher` 和 `New app` button 同行；`PageHeader` 外层 actions 只做 `flex-wrap`，移动端缺少 `w-full` / `items-stretch` 策略，主按钮可点击面积不稳定。
4. `.dashboard-search-shell` 负责桌面 focus 扩展，但 taxonomy pages / applications 的搜索区没有和 header actions 建立移动端分层规则。
5. `responsive-layout.spec.ts` 当前覆盖 320/375/768/1024 宽度下无 document overflow，但没有断言搜索框独占行、过滤条局部滚动、主按钮宽度或控件间距。

## 方案

1. 抽出小型布局约定，而不是重做业务组件：
   - 移动端：工具区 `flex-col items-stretch`，搜索输入 `w-full` / `basis-full`。
   - `sm+`：恢复 `flex-row flex-wrap items-center`，保留桌面密度。
2. 调整 `PageHeader` actions 容器：
   - 移动端 actions 使用 `w-full items-stretch`。
   - `sm+` 保持右侧收拢和自然宽度。
3. 调整 Applications header action group：
   - 移动端 `LayoutSwitcher` 与 `New app` 分层或稳定分布。
   - 主按钮在窄屏下使用 `w-full`，避免与切换器争抢一行。
4. 调整 `VersionFilterBar`：
   - 搜索框移动端独占第一行。
   - filter chip / published / critical / clear 放入局部横向 overflow 工具条，按钮 `shrink-0`。
   - `sm+` 恢复可换行工具行。
5. 调整 `TelemetryFilterBar`：
   - Range ToggleGroup 与 filter popovers 放入同一个局部横向工具条。
   - 移动端不显示垂直分隔线，避免占用可点击空间。
6. 扩展 `responsive-layout.spec.ts`：
   - 320px / 375px 下断言 App detail 搜索框宽度接近内容宽度，filter buttons 位于搜索框下一行。
   - 320px / 375px 下断言 Statistics filter bar 不产生 document overflow，局部工具条可横向滚动或至少不压缩按钮文字。
   - 320px 下断言 Applications 主操作按钮有稳定宽度，不与 LayoutSwitcher 重叠。

## 风险

| 风险 | 缓解 |
|------|------|
| 桌面工具栏密度下降 | 移动端和 `sm+` 分开处理，桌面继续使用现有横向 wrap 体验 |
| 局部横向滚动可发现性不足 | 仅用于 filter chips / range controls 这种按钮条；搜索和主 CTA 保持完整可见 |
| Board 高度链再次受影响 | 不改变 `app-board-page` / board view slot / `.app-board-scroll-area` 规则 |
| e2e 只测无 overflow 仍漏掉体验问题 | 新增 bounding box / width / row-position 断言覆盖控件分层 |

## 工作量

- 预计修改 `dashboard-next/apps/web/src/shared/components/page-header.tsx`。
- 预计修改 `dashboard-next/apps/web/src/features/apps/components/applications-page.tsx`。
- 预计修改 `dashboard-next/apps/web/src/features/apps/components/version-filter-bar.tsx`。
- 预计修改 `dashboard-next/apps/web/src/features/telemetry/components/filter-bar.tsx`。
- 预计修改 `dashboard-next/e2e/responsive-layout.spec.ts`。

## 备选方案

1. **推荐方案：移动端分层 + 局部工具条横向浏览**。最小化业务改动，直接解决堆积和压缩，并保留桌面密度。
2. **只增加 flex-wrap / gap**。改动更小，但搜索框仍会和按钮同一行竞争空间，用户反馈的问题容易复现。
3. **将 filters 收进一个单独 Filter Drawer**。移动端体验更干净，但交互模型变化较大，需要新增状态、入口和更多 e2e，不适合作为本轮最小修复。

## 批注

- 2026-05-09 11:08：用户批准按本方案实现。

## 执行结果

- `PageHeader` actions 容器在移动端改为 `grid w-full`，在 `sm+` 恢复右侧横向 actions。
- `ApplicationsPage` header actions 改为移动端分层：LayoutSwitcher 保持紧凑，`New app` 主按钮独占全宽；搜索 shell 移动端 `max-width: 100%`，桌面继续保留 focus 扩展。
- `AppDetailPage` 的 Back / Upload version actions 在移动端独占行宽，避免按钮挤成一列窄区。
- `VersionFilterBar` 搜索框移动端独占第一行，filter chips / published / critical / clear 放入局部横向工具条，按钮保持 `shrink-0`。
- `TelemetryFilterBar` range ToggleGroup 与 filter popovers 放入局部横向工具条，移动端不再把多个 controls 混在自然换行流里。
- `responsive-layout.spec.ts` 新增 320px / 375px 回归断言：Applications header actions 分层、Version filters 搜索与 controls 分行且局部横向滚动、Statistics filters 使用局部 control strip。

## 验证记录

- `git diff --check`
- `bun run typecheck`
- `bun run lint`（0 errors，45 warnings 为既有 React warning）
- `bun run build`
- `bun run test:e2e -- responsive-layout.spec.ts`（34/34 passed）
- `bun run test:e2e -- applications.spec.ts app-detail.spec.ts`（18/18 passed）
- Browser preview smoke：`http://127.0.0.1:4173/applications` 可打开；未配置后端/登录态时按既有认证流程跳转到 `/signin?redirect=%2Fapplications`。
