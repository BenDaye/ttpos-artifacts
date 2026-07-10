# PLAN-041 构建测试包入口迁移到 Applications

- **status**: completed
- **task**: BUG-021
- **createdAt**: 2026-07-10
- **source**: `.omx/plans/build-button-applications-entry-ralplan.md`

## 背景

"Build Test Package" 当前出现在 App detail 页，但触发弹窗本身要求用户重新选择应用端、平台和分支。这个任务是全局 QA/PM 构建任务，不是当前 detail app 的版本管理任务。

## 决策

将 `TriggerBuildDialog` 和 `BuildStatusSheet` 的 ownership 从 `AppDetailPage` 移到 `ApplicationsPage`，并把 `/applications` 作为本迭代唯一主入口。App detail 删除构建按钮和相关 state，只保留 Back 与 Upload version。

## 约束

- 不修改 server API、触发请求/响应契约、workflow、branch policy、权限/限流、轮询语义。
- 不修改 route tree 或 `TriggerBuildDialog` 行为。
- 不新增 detail 页快捷入口；当前不做 current-app preselection 语义。

## 实施

1. `ApplicationsPage` 引入 `TriggerBuildResponse`、`HammerIcon`、`TriggerBuildDialog`、`BuildStatusSheet`。
2. 在 Applications header actions 中，把 outline/small 的 "Build Test Package" 按钮放在 `LayoutSwitcher` 与 `New app` 之间，并沿用 `w-full sm:w-auto` 响应式模式。
3. 在 Applications 页持有 `buildTriggering`、`buildStatusOpen`、`buildResponse`，提交成功后复用原 detail 页 `onBuildTriggered` 行为打开 status sheet。
4. 从 `AppDetailPage` 删除 build-trigger imports、state、button、dialog 和 sheet。
5. 更新 e2e，覆盖新入口、详情页无入口、移动端 header actions。

## 验收

- `/applications` 可打开构建弹窗，选择一个 package/platform、填写 branch 并提交后显示 Build Status、目标、平台和 Actions run 链接。
- `/applications/:appName` 不显示 "Build Test Package"，Upload version 仍可打开。
- 320px 与 375px 下 Applications header 中 "Build Test Package" 和 "New app" 均可见且 document 无横向溢出。

## 风险

- Applications header 增加一个按钮后可能挤压移动端布局；已用 e2e 覆盖 320px/375px 分层和无 overflow。
- 移除 detail shortcut 可能影响已习惯入口的用户；本次产品决策明确只保留 Applications 主入口，后续若需要 detail 快捷方式必须先定义 current-app preselection 语义。
