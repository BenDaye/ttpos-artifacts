# PLAN-018 Dashboard UI 文案 brand-neutral 收敛

- **status**: completed
- **createdAt**: 2026-05-02 12:38
- **approvedAt**: 2026-05-02 12:38
- **completedAt**: 2026-05-02 12:38
- **relatedTask**: QUAL-003

## 现状

用户指出 dashboard / server 是通用平台 ZEHub，TTPOS 只是部署它的客户。扫描 `dashboard-next/apps/web/src + public/locales + index.html` 后发现两处用户可见 brand-leak：

- `apps/web/src/features/apps/components/app-form-dialog.tsx:92` — Create application 对话框 `placeholder="ttpos-pos"`
- `apps/web/src/features/tuf/components/bootstrap-panel.tsx:87` — TUF bootstrap 面板（前端入口禁用）`placeholder="ttpos-pos"`

其余检查项：
- locales en / zh：无残留
- index.html title：已是 ZEHub
- common.json `app.name`：已是 ZEHub
- `@ttpos/shared` 等 monorepo 内部 package 命名：结构性，不在本次范围

## 方案

- 两处 placeholder 直接替换为 brand-neutral 样例 `my-app`
- 不动 monorepo 包名 / 镜像名 / workflow 名等结构性命名（重命名需单独立项）
- 不动 demo seed 数据（`TTPOS-Cashier` 等）— 这是客户数据，不是产品 brand
- 把产品定位规则写入跨 session memory（`feedback_brand_neutral.md`），未来面对任何 UI 文案选择时自动参考

## 风险

- placeholder 仅是输入框 hint，不影响 form 提交、不影响 e2e 选择器（已确认 e2e 无依赖 `ttpos-pos` 字面量）
- TUF panel 前端入口禁用，改 placeholder 不会激活流程，符合 AGENTS.md 的"TUF 只读"边界

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx`
- `dashboard-next/apps/web/src/features/tuf/components/bootstrap-panel.tsx`
- `~/.claude/projects/-home-ben-projects-ttpos-artifacts/memory/feedback_brand_neutral.md` + `MEMORY.md`
- PMA task / plan / changelog

不改：

- `@ttpos/shared` / `faynosync-*` 镜像名 / Dockerfile / workflow 名等结构性命名
- demo seed 数据 `TTPOS-Cashier` 等
- locales / index.html title（已是 ZEHub）

## 批注

- 2026-05-02 12:38：用户反馈触发产品定位级文案收敛。直接进入实施。验证：typecheck、test 12/12、lint（0 errors / 46 既存 warnings 无新增）。
