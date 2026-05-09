# PLAN-027 Dashboard Next App board 单一纵向滚动收敛

- **status**: completed
- **createdAt**: 2026-05-09
- **approvedAt**: 2026-05-09
- **completedAt**: 2026-05-09
- **relatedTask**: BUG-013

## 现状

Applications page 当前使用普通块级容器承载 header、search 和视图内容。board 视图内部横向滚动容器没有明确填充剩余高度，column 内部通过 `.app-board-scroll-area` 设置基于 `100vh` 推导的 `max-height`。

这个实现有两个问题：

1. board 自身没有被约束到 main 剩余高度，column 内容变高时仍可能撑开页面。
2. column 的 `max-height` 依赖固定 token 计算，无法可靠覆盖不同 viewport、header/search 折行和 sidebar/header 组合。

## 方案

1. 将 `ApplicationsPage` 在 board 布局下切到纵向 flex 容器，并使用可用 viewport 高度约束页面主体。
2. 将 search/header 之下的 view slot 设置为 `min-h-0 flex-1`，只让 board 视图吃满剩余高度。
3. 将 `AppBoardView` 外层设置为 `min-h-0 flex-1 overflow-x-auto`，横向滚动仍留在 board 外层。
4. 将 `BoardColumn` 设置为 `h-full min-h-0`，去掉对 `.app-board-scroll-area` 的固定 `max-height` 依赖。
5. 保留 `.app-board-scroll-area` 的 `overflow-y-auto`，确保只有 version 列表负责纵向滚动。
6. 在 responsive e2e 中增加长版本列表断言：document 无纵向滚动，column scroll area 有可滚动高度且滚动后 scrollTop 生效。

## 风险

| 风险 | 缓解 |
|------|------|
| card/list 视图被强行限制高度 | 只在 board 布局下启用 flex-height view slot，card/list 保持原有自然文档流 |
| 小屏 header/search 折行后可用高度被误算 | 使用 flex `min-h-0` 高度链代替固定 `100vh - token` |
| 横向滚动被 column 或页面接管 | board 外层保留 `overflow-x-auto`，e2e 继续断言 document 无横向溢出 |
| dialog 和 app 删除/编辑按钮事件被影响 | 不触碰交互逻辑，仅调整容器布局 class |

## 范围外

- 不改变 board 数据拉取、每列版本 limit 或 query key。
- 不改变 app card/list 视图视觉结构。
- 不改变 App detail version 列表布局。
- 不引入新的 UI primitive 或设计 token。

## 验收

- 修改范围限定在 Applications board 布局与聚焦 e2e。
- 聚焦 gate 运行并记录结果。

## 执行结果

- `ApplicationsPage` 在 board 布局下启用 `app-board-page flex flex-col`，并将 header/search 作为固定高度区域。
- board view slot 使用 `min-h-0 flex-1`，让 board 填充 header/search 之后的剩余高度。
- `AppBoardView` 外层保留横向滚动并继承完整高度。
- `BoardColumn` 与内部 version scroll area 使用 `h-full` / `min-h-0` / `flex-1`，版本列表纵向滚动限制在 column 内。
- `.app-board-scroll-area` 外增加 `py-2` wrapper，上下视觉留白固定在滚动区域边界；scroll area 自身只承担横向内边距和纵向滚动。
- 移除 `.app-board-scroll-area` 的固定 `100vh` max-height 推导，改为 `.app-board-page` 按 shell header 与 main padding 计算可用 screen 高度。
- responsive e2e 增加长版本列表断言：document 无纵向滚动，column scroll area 可滚动且 `scrollTop` 生效。

## 验证记录

- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`（0 errors，45 warnings 为既有 React warning）
- `bun run build`
- `bunx playwright install chromium`
- `bun run test:e2e -- responsive-layout.spec.ts`（28/28 passed）
- `git diff --check`
