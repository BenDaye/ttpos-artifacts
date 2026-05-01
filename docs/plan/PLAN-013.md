# PLAN-013 Dashboard Next 版本状态与选择器视觉收敛

- **status**: completed
- **createdAt**: 2026-05-01 18:52
- **approvedAt**: 2026-05-01 18:52
- **completedAt**: 2026-05-01 19:03
- **relatedTask**: BUG-007

## 现状

用户继续复核应用详情页后指出：

1. Version card 顶部 padding 仍显得拥挤。
2. Channel chip 应跟随 version 右侧展示，并统一 uppercase。
3. Draft / Published / Critical 等状态不应继续依赖状态 badge，而应直接通过 version text 颜色区分。
4. Dashboard Next 中 native selector 分散实现，Add artifact 只是局部修过，Upload version / Edit version 仍有同类 padding 与 icon 问题。

当前源码确认：

- `app-detail-page.tsx` 中 `VersionRow` 使用 `p-lg` 且把 channel 放在 version 左侧。
- `VersionRow` 对 Draft / Published / Critical 仍渲染 `Badge`。
- `add-artifact-dialog.tsx` 自定义了 `inputClass` / `selectClass` 和 chevron。
- `upload-version-dialog.tsx`、`version-edit-dialog.tsx` 仍直接渲染 `<select>`。
- `shared/components/ui/select.tsx` 只有 Base UI select 封装，没有 native select 封装。

## 方案

- 新增共享 native selector 组件，使用 DESIGN token：`h-11`、`rounded-pill`、`px-5`、`py-3`、`pr-xl`、`text-base`、`right-sm`、`size-4`。
- 将 Upload version / Edit version / Add artifact 的 native `<select>` 全部替换为共享 selector。
- 调整 Base UI select item padding：为 indicator 预留固定左槽，文本起点稳定对齐。
- Version header 改为 `version + uppercase channel`；channel 位于 version 右侧，可 wrap。
- 版本状态颜色优先级：
  - Critical：`text-destructive`
  - Published：`text-primary`
  - Draft：`text-foreground`
  - Intermediate 不覆盖颜色，仅作为 secondary status text。
- 顶部 padding 改为 `pt-xl`，其余沿用 DESIGN spacing token。
- 更新 e2e 覆盖 channel 右侧、uppercase、状态颜色和 selector 对齐/无局部 native 样式散落。

## 风险

- DESIGN.md 没有独立 danger 色；实现会使用项目现有 `destructive` 语义 token，不新增 hex 或任意颜色。
- Native `<option>` 的弹层由浏览器/系统渲染，不能完全控制 option row 视觉；本轮统一控制 selector trigger 的 padding、文本和 chevron 对齐，同时修正 Base UI select item 对齐。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/shared/components/ui/select.tsx`
- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/apps/web/src/features/apps/components/add-artifact-dialog.tsx`
- `dashboard-next/apps/web/src/features/apps/components/upload-version-dialog.tsx`
- `dashboard-next/apps/web/src/features/apps/components/version-edit-dialog.tsx`
- `dashboard-next/e2e/app-detail.spec.ts`
- `dashboard-next/e2e/responsive-layout.spec.ts`
- PMA task / plan / changelog

不改：

- server API
- download / upload request contract
- routeTree.gen.ts
- localStorage key
- TUF 前端禁用决策

## 批注

- 2026-05-01 18:52：按用户反馈直接进入实现，目标是修复同类 selector 问题而非继续做局部补丁。
- 2026-05-01 19:03：实现完成。补丁覆盖 version card padding/status/channel、共享 selector、Upload/Edit/Add artifact 选择器迁移及 e2e 回归。验证通过 typecheck、production build、lint（existing warnings only）、unit tests、focused e2e、responsive e2e、full e2e 和 static token scan。
