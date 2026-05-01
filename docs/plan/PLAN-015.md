# PLAN-015 Upload version 对话框选择器与文件输入回归修复

- **status**: completed
- **createdAt**: 2026-05-01 19:35
- **approvedAt**: 2026-05-01 19:35
- **completedAt**: 2026-05-01 19:35
- **relatedTask**: BUG-008

## 现状

Upload new version 对话框暴露 4 个独立但叠加体验糟糕的问题：

1. `dashboard-next/apps/web/src/shared/components/ui/select.tsx`: `SelectContent` 没用 `<BaseSelect.Portal>`，而 `DialogContent` 用 `-translate-x-1/2 -translate-y-1/2` transform 居中。CSS transform 父级会让内部 `position: fixed` 元素相对 transform 框（containing block）定位，导致 Base UI Select Positioner 完全无法贴附 trigger，弹层飘到屏幕右下角。
2. `SelectField` 无条件在 dropdown 顶部插入 `<SelectItem value="">{placeholder}</SelectItem>`，所有 required 字段也跟着出现 `—` 空值选项。
3. `dashboard-next/apps/web/src/shared/components/ui/checkbox.tsx`: 用 `rounded-sm` 圆角；本项目 design token `--radius-sm = 8px` 与 16px Checkbox 半径相等 → 视觉为圆，与 radio 难以区分。
4. `upload-version-dialog.tsx` / `add-artifact-dialog.tsx` / `app-form-dialog.tsx`: 文件控件直接用 `<input type="file">`，浏览器自带的 "选择文件 / 未选择任何文件" 文案跟系统语言走，与 dialog 英文不一致。

## 方案

- `select.tsx`：在 `SelectContent` 外层加 `<BaseSelect.Portal>`，让 Positioner 脱离 dialog transform；popup 显式抬 `z-[60]` 保证高于 dialog backdrop。
- `select.tsx`：`SelectField` 增加 `clearable: boolean = false` prop；仅在 clearable=true 时才渲染空值选项。当前所有调用都是必填，全部走默认 false。
- `checkbox.tsx`：圆角改 `rounded-xs` (5px)，让 16px Checkbox 视觉为圆角方形而非完整圆，与 radio 视觉区分；不新增 hex / arbitrary。
- 新增 `shared/components/ui/file-input.tsx`：隐藏 `sr-only <input type="file">` + 可见 `Button` 触发 + 文件 summary span；buttonLabel/emptyLabel/summary 由调用方注入 i18n 已 resolved 的字符串。
- `common.json` 增加 `file_input.choose_one / choose_many / empty`（中英）。
- `upload-version-dialog.tsx` / `add-artifact-dialog.tsx` / `app-form-dialog.tsx` 全部切到 FileInput；保留 single (logo) / multiple (artifacts) 区分。
- e2e 不需要新增：现有 setInputFiles 通过 `input[type="file"]` selector 触发，sr-only 隐藏 input 仍然匹配。

## 风险

- Portal 让 Select popup 脱离 dialog DOM；如果 dialog backdrop z-index 没设对会盖住 popup → 已显式提到 `z-[60]`。
- `clearable=false` 是行为变更：用户在已选择后不能从 dropdown 清空选择。但所有调用点都是 required，schema 也不允许空字符串，原先的"清空"反而会让 form 校验失败，行为变更是正向。
- `rounded-xs` 在本项目 token 是 5px，而非 design token 大圆角口味。这是 checkbox 单点视觉调整，不波及其他控件。
- Native file input 的浏览器内置控件无法 i18n，因此必须包一层。隐藏 input 用 `sr-only` 保留可访问性与 setInputFiles 测试入口。

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/shared/components/ui/select.tsx`
- `dashboard-next/apps/web/src/shared/components/ui/checkbox.tsx`
- `dashboard-next/apps/web/src/shared/components/ui/file-input.tsx`（新增）
- `dashboard-next/apps/web/src/features/apps/components/upload-version-dialog.tsx`
- `dashboard-next/apps/web/src/features/apps/components/add-artifact-dialog.tsx`
- `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx`
- `dashboard-next/apps/web/public/locales/en/common.json`
- `dashboard-next/apps/web/public/locales/zh/common.json`
- PMA task / plan / changelog

不改：

- DialogContent transform 居中（不影响其他 dialog 内非 Select 控件）
- routeTree.gen.ts / TUF 前端入口 / localStorage key / 后端 API

## 批注

- 2026-05-01 19:35：用户截图直接复现了所有 4 个问题；按 AGENTS.md "明确的单点视觉/控件收敛"直接进入实施。验证通过：typecheck、test 12/12、production build、lint（0 errors，46 既存 warnings 无新增）、focused upload/add-artifact e2e 5/5、全套 e2e 80/80。
