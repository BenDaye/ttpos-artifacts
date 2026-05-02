# PLAN-016 Select popup 与 trigger 视觉收敛 + Flag 行溢出修复

- **status**: completed
- **createdAt**: 2026-05-02 11:25
- **approvedAt**: 2026-05-02 11:25
- **completedAt**: 2026-05-02 11:25
- **relatedTask**: BUG-009

## 现状

BUG-008 的部署版本上线后用户复核截图反馈两处仍然破：

1. `select.tsx`: `<BaseSelect.Positioner>` 用默认 `alignItemWithTrigger: true`，popup 顶部跑到 trigger 上方覆盖 label；`SelectItem` 用 `rounded-sm px-sm py-xs text-sm`，与 trigger 的 `rounded-pill h-11 px-5 text-base` 视觉脱节；`index.css` 的 `.select-popup-width` 用 `min-width: var(--anchor-width)` 允许 popup 比 trigger 更宽。
2. `upload-version-dialog.tsx`: 三个 FlagCheckbox 塞在 `grid sm:grid-cols-2` 的最后一个 cell（约半宽 226px），但内容 ≈ 354px，Intermediate 溢出 dialog 右边。

## 方案

- `select.tsx`：在 Positioner 显式 `alignItemWithTrigger={false}`，让 popup 走 `side="bottom"` 贴 trigger 下方；SelectItem 改 `text-base px-3 py-2`，与 trigger 字号一致、padding 节奏协调。
- `index.css`：`.select-popup-width` `min-width` → `width`，popup 严格匹配 anchor 宽度。
- `upload-version-dialog.tsx`：把 flag 容器移出 grid，作为 grid 之后的一整行 `flex flex-wrap items-center gap-x-4 gap-y-2`；拿到 dialog 全宽 + 窄屏自动换行兜底。

## 风险

- `alignItemWithTrigger=false` 改变 Base UI Select 默认行为；少数桌面用户习惯于 macOS-native"对齐选中项到 trigger"的开法，但本项目所有 selector 在 dialog 内、紧凑空间，下方贴附更稳，这条 trade-off 接受。
- popup 宽度严格 = anchor，文本超长会 truncate；既有 `truncate` 已在 SelectItem.ItemText 上，OK。
- Flag 容器从 grid 内移到 grid 外，会让 grid 中条件可见的 Updater / Signature 字段排布略变（Architecture 旁边可能空一格 if Updater 不存在）。这是已知 trade-off，比 Intermediate 溢出 dialog 严重程度低。

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/shared/components/ui/select.tsx`
- `dashboard-next/apps/web/src/index.css`
- `dashboard-next/apps/web/src/features/apps/components/upload-version-dialog.tsx`
- PMA task / plan / changelog

不改：

- DialogContent / FileInput / Checkbox / 其他 dialog 实现
- routeTree.gen.ts / TUF / localStorage / 后端 API

## 批注

- 2026-05-02 11:25：用户截图直接复现两处问题，按 AGENTS.md "明确单点视觉收敛"直接进入实施。验证：typecheck、test 12/12、lint（0 errors / 46 既存 warnings 无新增）、e2e 80/80。
