# PLAN-019 移除 New app 表单残留的 Enable TUF metadata 入口

- **status**: completed
- **createdAt**: 2026-05-02 13:02
- **approvedAt**: 2026-05-02 13:02
- **completedAt**: 2026-05-02 13:02
- **relatedTask**: BUG-011

## 现状

`dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx` 里 New app 表单（`!editing` 分支）展示了一个 "Enable TUF metadata" checkbox，绑定 `enableTuf` state，提交时 `useCreateAppMutation` 会把 `tuf: enableTuf` 一起传给后端 `appsApi.createApp`。这是 AGENTS.md "TUF 前端入口当前保持禁用" 边界上**仍然能被用户勾选并激活**的真入口。之前几轮 TUF 边界检查只看 `features/tuf/`，没扫到这里。

`CreateAppPayload.tuf?: boolean` 在 `features/apps/api.ts` 上是 optional — 不传等于 undefined，后端按默认走非 TUF 路径。这给了前端干净移除 checkbox 而不动后端契约的空间。

`apps.json` 里 `form.tuf` 词条是这个 checkbox 的 label。`settings.json` 里 `tuf.disabled_*` 是 TUF settings panel 的"已禁用"提示文案，本来就是 disabled-state、符合现状。

## 方案

`app-form-dialog.tsx` 单文件改动：

- 移除 `enableTuf` state 与 useEffect reset
- mutation 调用里删除 `tuf: enableTuf,` 一行
- JSX `!editing` 分支里删除 `<label><Checkbox checked={enableTuf} .../>{t('form.tuf')}</label>` 整块
- i18n key `apps.form.tuf` 保留为孤儿词条（按 TUF off-limits 不动文案）

不动：
- `useCreateAppMutation` / `appsApi.createApp` / `CreateAppPayload` 类型 — API 契约保持
- `features/tuf/**` 任何文件 — off-limits
- `settings.tuf.disabled_*` 文案 — 本来就是 disabled 提示
- `apps.json` / `apps.zh.json` 的 `form.tuf` 词条 — 按 off-limits 不动 TUF 文案

## 风险

- 行为变更：之前用户能通过 New app 表单把新 app 创建为 tuf-enabled；现在不能。这正是用户期望（"我还不打算接入 TUF"），不是回归。
- API 契约不变：`tuf?` 仍是 optional，后续如果用户决定恢复 TUF，加回 checkbox 即可，不需要改后端。
- e2e 确认无依赖 "Enable TUF" 字面量。

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx`
- PMA task / plan / changelog

不改：

- API / mutation / payload 类型
- `features/tuf/**` 任何文件
- i18n keys
- 后端 / docker / workflow

## 批注

- 2026-05-02 13:02：用户在 QUAL-003 部署后立即点出此入口残留。直接进入实施，按 AGENTS.md "TUF 前端入口禁用" 边界落实。验证：typecheck、test 12/12、lint（0 errors / 45 既存 warnings 无新增；少 1 项是 enableTuf 删除连带 set-state-in-effect warning 消失）、e2e 79/79。
