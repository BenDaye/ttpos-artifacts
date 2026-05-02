# PLAN-018 Dashboard UI 文案 brand-neutral 收敛

- **status**: completed
- **createdAt**: 2026-05-02 12:38
- **approvedAt**: 2026-05-02 12:38
- **completedAt**: 2026-05-02 12:38
- **relatedTask**: QUAL-003

## 现状

用户指出 dashboard / server 是通用平台 ZEHub，TTPOS 只是部署它的客户。扫描 `dashboard-next/apps/web/src + public/locales + index.html` 后发现一处用户可见 brand-leak：

- `apps/web/src/features/apps/components/app-form-dialog.tsx:92` — Create application 对话框 `placeholder="ttpos-pos"`

其余检查项：
- locales en / zh：无残留
- index.html title：已是 ZEHub
- common.json `app.name`：已是 ZEHub
- `@ttpos/shared` 等 monorepo 内部 package 命名：结构性，不在本次范围
- TUF 路径：AGENTS.md 边界排除，本次不动

## 方案

- 该处 placeholder 替换为 brand-neutral 样例 `my-app`
- 不动 monorepo 包名 / 镜像名 / workflow 名等结构性命名（重命名需单独立项）
- 不动 demo seed 数据（`TTPOS-Cashier` 等）— 这是客户数据，不是产品 brand
- 不动 TUF 任何代码 / 文案 / 文档 — 前端入口禁用，按 AGENTS.md 边界由用户明确指示前保持只读
- 把产品定位规则写入跨 session memory（`feedback_brand_neutral.md`）；同时新增 `feedback_tuf_off_limits.md` 把 "TUF 不能顺手改" 这条边界单独记录，避免下次扫描类工作里把 TUF 卷进来

## 风险

- placeholder 仅是输入框 hint，不影响 form 提交、不影响 e2e 选择器（已确认 e2e 无依赖 `ttpos-pos` 字面量）

## 工作量

预计触及（实际已落地）：

- `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx`
- `~/.claude/projects/-home-ben-projects-ttpos-artifacts/memory/feedback_brand_neutral.md` + `feedback_tuf_off_limits.md` + `MEMORY.md`
- PMA task / plan / changelog

不改：

- `@ttpos/shared` / 镜像名 / Dockerfile / workflow 名等结构性命名
- demo seed 数据 `TTPOS-Cashier` 等
- locales / index.html title（已是 ZEHub）
- TUF 任何代码 / 文案 / 文档

## 批注

- 2026-05-02 12:38：用户反馈触发产品定位级文案收敛。直接进入实施。验证：typecheck、test 12/12、lint（0 errors / 46 既存 warnings 无新增）。
