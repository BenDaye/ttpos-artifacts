# QUAL-003: Dashboard UI 文案 brand-neutral 收敛（去 ttpos-pos 占位）

- **status**: completed
- **priority**: P2
- **owner**: codex
- **createdAt**: 2026-05-02 12:38
- **completedAt**: 2026-05-02 12:38
- **related**: PLAN-018

## 描述

用户在 BUG-010 后明确指出 dashboard / server 是通用平台 ZEHub，TTPOS 只是恰好部署它的客户之一；用户可见 UI 不应暗示这是 TTPOS 专属。

实际扫到的用户可见 brand-leak placeholder：

1. `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx:92` — Create application 对话框 name 字段 `placeholder="ttpos-pos"`，让创建任意 app 的用户被暗示要输入 "ttpos-something" 形态的名字。

验收标准：

1. 该处 placeholder 改为 brand-neutral 样例（`my-app`），不引入 brand 字面量。
2. 不动 `@ttpos/shared` 等结构性命名（属于 monorepo 内部 package，重命名需单独立项）。
3. 不动 demo / 测试 fixture 中的 `TTPOS-Cashier` 等数据（这是 *客户数据*，不是产品 brand）。
4. 不动 TUF 相关任何代码 / 文案 / 文档（TUF 前端入口禁用，由用户明确指示前都按 AGENTS.md 边界保持只读）。
5. typecheck / test / lint / e2e 全部通过、无新增 warning。

## 进行时描述

完成 app-form-dialog 的 brand-leak placeholder 收敛，并把产品定位规则保存到跨 session memory。

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

- 2026-05-02 12:38：用户反馈触发的产品定位级修复。

  扫描结论（dashboard-next/apps/web/src + public/locales + index.html）：
  - 用户可见 brand-leak：`app-form-dialog.tsx:92` 一处
  - 结构性引用（不动）：`@ttpos/shared` import 路径在 31 个文件中（monorepo workspace package）
  - TUF 路径（前端入口禁用，按边界不动）：扫描结果跳过
  - locales en / zh：无 ttpos / TTPOS / FaynoSync 残留
  - index.html title：已是 ZEHub
  - common.json `app.name`：已是 ZEHub

  修复：
  - `app-form-dialog.tsx:92` placeholder → `my-app`

  长期记忆：
  - 在 `~/.claude/projects/-home-ben-projects-ttpos-artifacts/memory/feedback_brand_neutral.md` 保存了产品定位 feedback：用户可见 UI 必须 brand-neutral；同时记录了不需要动的结构性命名边界。
  - 在 `feedback_tuf_off_limits.md` 单独记录 TUF 任何文件 / 文档变更都需用户明确指示。

  验证：`bun run typecheck`、`bun run test` 12/12、`bun run lint`（0 errors / 46 既存 warnings 无新增）。e2e 无依赖 `ttpos-pos` 字面量，CI 会自动覆盖回归。
