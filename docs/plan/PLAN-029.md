# PLAN-029 Dashboard Next App board version 快速详情弹层

- **status**: completed
- **createdAt**: 2026-05-09
- **approvedAt**: 2026-05-09
- **completedAt**: 2026-05-09
- **relatedTask**: ENH-009

## 现状

Applications board 视图中，每个 app column 使用 `useQueries` 拉取该 app 的版本列表。Column header 点击进入 app detail，version card 点击也调用同一个 `onSelect(app)`，因此用户在 board 中点击具体版本时会被带离当前 board。

App detail 页面里的 `VersionRow` 已经沉淀了较稳定的 version card 信息架构：version + uppercase channel、Critical / Published / Draft 优先级颜色、状态摘要、changelog/download/add artifact/edit/delete 操作和 artifact 列表。board version card 当前只展示简略信息。

## 方案

1. 在 `AppBoardView` 内增加 selected version 状态，version card click / keyboard activation 改为打开 dialog。
2. 新增 `VersionDetailDialog`，使用现有 Base UI Dialog 封装作为承载面，不在 dialog 内再嵌套外层 card。
3. Dialog 内复用 app detail version card 的状态层级、artifact 文件名 fallback、download URL resolution、add artifact、edit version、delete version 和 delete artifact 行为。
4. 保留 board column header 的 app detail 跳转能力；如需要深度详情，dialog footer 提供进入 app detail 的 command。
5. 在 `applications.spec.ts` 增加 board version quick detail 行为断言，覆盖点击 version 不跳转、dialog 内容可见、header 仍可跳转。

## 风险

| 风险 | 缓解 |
|------|------|
| Dialog 内再打开 edit/add/download 等弹层造成焦点混乱 | quick detail 负责主详情，download/copy 内联处理；edit/add/delete 使用既有 dialog primitive 并维持清晰 open state |
| 复用 app detail 逻辑导致代码重复 | 抽出小型 version UI helper，避免在 board 与 detail 中复制状态/文件名规则 |
| Mutation 后 selected version 数据短暂陈旧 | 既有 mutations 已 invalidate `app-search`；delete version 成功后关闭 quick detail |
| Board 滚动修复回退 | 不触碰 `app-board-page` / `app-board-scroll-area` 高度链，并保留 responsive e2e |

## 范围外

- 不改变 `/applications/:appName` 路由和 app detail 页面主体结构。
- 不改变 server API、query key 契约或 version search limit。
- 不重做 board column 分组方式或 card/list 视图。
- 不恢复 TUF 前端入口。

## 验收

- 修改范围限定在 Dashboard Next apps feature、聚焦 e2e 和 PMA 文档。
- Dashboard focused gate 运行并记录结果。

## 执行结果

- `AppBoardView` 新增 selected version state，board version card click / Enter / Space 打开 quick detail dialog，不再直接跳转 app detail。
- `VersionDetailDialog` 使用现有 Dialog surface 展示 version、uppercase channel、状态摘要、changelog、artifact 列表、copy/download、edit、add artifact、delete version 和 delete artifact 入口。
- Column header 保留原有 app detail 跳转；dialog footer 也提供 `Open app detail` command。
- `version-ui.ts` 抽出 version tone 与 artifact 文件名 fallback，避免 app detail 与 board dialog 分叉维护。
- `applications.spec.ts` 增加 board version quick detail 回归：点击 version 不离开 `/applications`，dialog 内容可见，Edit dialog 可从 quick detail 打开，关闭后 column header 仍可进入 app detail。

## 验证记录

- `bun run typecheck`
- `bun run lint`（0 errors，45 warnings 为既有 React warning）
- `bun run test`（12/12 passed）
- `bun run build`
- `bun run test:e2e -- applications.spec.ts`（8/8 passed）
- `git diff --check`
- Browser dev server smoke：`http://localhost:3000/applications` 可打开；未配置真实后端或浏览器级 mock 时按认证流程停在登录页，board dialog 视觉以 Playwright mock e2e 验收。
