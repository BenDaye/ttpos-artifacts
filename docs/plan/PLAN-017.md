# PLAN-017 锁定 Upload version 的 App name 并移除孤悬的全局上传入口

- **status**: completed
- **createdAt**: 2026-05-02 11:40
- **approvedAt**: 2026-05-02 11:40
- **completedAt**: 2026-05-02 11:40
- **relatedTask**: BUG-010

## 现状

`upload-version-dialog.tsx` 的 App name 字段是普通可编辑 `<Input {...form.register('app_name')} />`，绑定 form 的 `app_name` 字段（schema `z.string().min(1)`）。`Props.defaultAppName?: string` 是 optional，applications-page 上有一个不传该 prop 的全局 "Upload version" 按钮（`applications-page.tsx:89`，顶部 actions 区），让用户在多 app 列表页随手点击后被迫手输 app name。card / list / board view 都没有 per-app upload 入口。app-detail-page 进入上传时会传 `defaultAppName={appName}`，但 dialog 仍允许用户改成任意字符串，绑到错误甚至不存在的 app。

## 方案

- `upload-version-dialog.tsx`：
  - `Props.defaultAppName?: string` → `Props.appName: string`（必传）
  - `useForm.defaultValues.app_name = appName`，加 `useEffect([appName, form])` 把 prop 同步进 form state（覆盖 reset / 重新打开后的初始值）
  - JSX 改 `<Input value={appName} disabled readOnly />`；label 加 inline hint "Locked to this app" / "锁定到当前应用"
  - `apps.json` (en / zh) 新增 `upload_dialog.app_name_locked` 词条
- `app-detail-page.tsx`：调用 prop `defaultAppName` → `appName`
- `applications-page.tsx`：移除顶部全局按钮、相关 state、dialog 实例和不再使用的 `Upload` / `UploadVersionDialog` import
- `e2e/applications.spec.ts`：删除依赖全局按钮的用例；同等覆盖已在 `app-detail.spec.ts` 保留

## 风险

- 移除全局按钮是行为变更：用户原先在 applications 列表页随手点击的入口消失。但因为没有 per-app 入口，原入口的实际作用就是"再让用户输一遍 app name"——无价值，移除后用户必须先选具体 app 再上传，路径更安全。
- App name 字段从 schema 形式上仍存在（z.string().min(1)），值由 prop 注入；不会破坏后端契约。
- 删除一条 e2e 用例是因为按钮消失，不是测试本身降级；同等用例已在 app-detail 内覆盖。

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/features/apps/components/upload-version-dialog.tsx`
- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/apps/web/src/features/apps/components/applications-page.tsx`
- `dashboard-next/apps/web/public/locales/en/apps.json`
- `dashboard-next/apps/web/public/locales/zh/apps.json`
- `dashboard-next/e2e/applications.spec.ts`
- PMA task / plan / changelog

不改：

- 后端 upload 契约 / form schema 字段集
- detail page 上传按钮位置
- routeTree.gen.ts / TUF / localStorage

## 批注

- 2026-05-02 11:40：用户反馈"为什么 upload version 还能改 app name"直接定位漏洞，按 AGENTS.md "明确单点业务漏洞收敛"直接进入实施。验证：typecheck、test 12/12、lint（0 errors / 46 既存 warnings 无新增）、e2e 79/79。
