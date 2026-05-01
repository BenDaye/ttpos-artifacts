# PLAN-012 Dashboard Next 版本卡片与 Add artifact 细节修正

- **status**: completed
- **createdAt**: 2026-05-01 18:26
- **approvedAt**: 2026-05-01 18:26
- **completedAt**: 2026-05-01 18:26
- **relatedTask**: BUG-006

## 现状

BUG-005 已将 version card 调整为 release tile，但用户复核截图后仍指出层级和细节不符合预期。当前确认：

1. `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx` 的 channel chip 仍在 version 下方，不符合“channel chip 放到 version 左侧”。
2. Published / Draft 的状态 badge 视觉区分不足；Published 未使用 primary 实色。
3. Artifacts 行仍用 Badge chip 表示 platform / architecture，且 `package` 只有 `.png` / `.md` 时会直接显示扩展名。
4. `dashboard-next/apps/web/src/features/apps/components/add-artifact-dialog.tsx` 仍包含 changelog textarea，且 native select arrow 位置由浏览器决定。

## 方案

- 将 version header 改为一行优先的 `channel chip + version + status chip`，保留 wrap 能力。
- Published chip 使用 `Badge default` 的 primary token 实色；Draft 使用 warning / muted token，满足 DESIGN token 边界。
- Artifact 行改成文本标题：`platform / architecture`，文件名为副标题；移除 platform / architecture chip。
- 增加 artifact 文件名解析：当 `package` 只是扩展名时，从 `/download?key=...` 的 key 中提取真实文件名。
- Add artifact dialog 移除 changelog state、textarea 和 update payload 中的 changelog。
- Add artifact select 隐藏系统 arrow，并使用 lucide chevron + DESIGN spacing token 定位。
- 更新 app-detail / responsive e2e 覆盖 channel 左侧、无 changelog 字段、artifact 文本展示和无 document overflow。

## 风险

- Add artifact 去掉 changelog 后，不再能在追加 artifact 时顺带修改版本 changelog；用户明确表示这里不需要改 changelog，版本 changelog 仍可通过 edit version 管理。
- Published / Draft 只能使用 DESIGN.md 已映射的 primary 与 neutral token，不引入 orange/green/red 等额外状态色。
- 文件名解析依赖 link 中的 key；若后端只返回扩展名且 link 不含文件名，会回退为 `PNG artifact` 等中性文案。

## 工作量

预计触及：

- `dashboard-next/apps/web/src/features/apps/components/app-detail-page.tsx`
- `dashboard-next/apps/web/src/features/apps/components/add-artifact-dialog.tsx`
- `dashboard-next/e2e/app-detail.spec.ts`
- `dashboard-next/e2e/responsive-layout.spec.ts`
- PMA task / plan / changelog

不改：

- server API
- dashboard-next API client 契约
- 路由路径与 `routeTree.gen.ts`
- localStorage key
- TUF 前端禁用决策

## 批注

- 2026-05-01 18:26：用户以编号反馈明确了修正方向，按上述范围实现。
- 2026-05-01 18:26：实现完成。验证通过：typecheck、lint（existing warnings only）、production build、focused e2e 37/37、static token scans；本地截图确认 version card 不再使用 artifact chips，Add artifact dialog 不再包含 changelog 字段。
