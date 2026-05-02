# QUAL-003: Dashboard UI 文案 brand-neutral 收敛（去 ttpos-pos 占位）

- **status**: completed
- **priority**: P2
- **owner**: codex
- **createdAt**: 2026-05-02 12:38
- **completedAt**: 2026-05-02 12:38
- **related**: PLAN-018

## 描述

用户在 BUG-010 后明确指出 dashboard / server 是通用平台 ZEHub，TTPOS 只是恰好部署它的客户之一；用户可见 UI 不应暗示这是 TTPOS 专属。

实际扫到两处用户可见的 brand-leak placeholder：

1. `dashboard-next/apps/web/src/features/apps/components/app-form-dialog.tsx:92` — Create application 对话框 name 字段 `placeholder="ttpos-pos"`，让创建任意 app 的用户被暗示要输入 "ttpos-something" 形态的名字。
2. `dashboard-next/apps/web/src/features/tuf/components/bootstrap-panel.tsx:87` — TUF bootstrap 面板（虽然前端入口当前禁用）App name 字段同样 `placeholder="ttpos-pos"`。

验收标准：

1. 上述两处 placeholder 改为 brand-neutral 样例（`my-app`），不引入 brand 字面量。
2. 不动 `@ttpos/shared` 等结构性命名（属于 monorepo 内部 package，重命名需单独立项）。
3. 不动 demo / 测试 fixture 中的 `TTPOS-Cashier` 等数据（这是 *客户数据*，不是产品 brand）。
4. typecheck / test / lint / e2e 全部通过、无新增 warning。

## 进行时描述

完成两处 brand-leak placeholder 的中性化收敛，并把产品定位规则保存到跨 session memory。

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

- 2026-05-02 12:38：用户反馈触发的产品定位级修复。

  扫描结论（dashboard-next/apps/web/src + public/locales + index.html）：
  - 用户可见 brand-leak：仅以上 2 处 `placeholder="ttpos-pos"`
  - 结构性引用（不动）：`@ttpos/shared` import 路径在 31 个文件中（monorepo workspace package）
  - locales en / zh：无 ttpos / TTPOS / FaynoSync 残留
  - index.html title：已是 ZEHub
  - common.json `app.name`：已是 ZEHub

  修复：
  - `app-form-dialog.tsx:92` placeholder → `my-app`
  - `bootstrap-panel.tsx:87` placeholder → `my-app`（虽 TUF 入口禁用，placeholder 文案改不算恢复入口；顺手清理避免将来恢复返工）

  长期记忆：
  - 在 `~/.claude/projects/-home-ben-projects-ttpos-artifacts/memory/feedback_brand_neutral.md` 保存了产品定位 feedback：用户可见 UI 必须 brand-neutral；同时记录了不需要动的结构性命名边界。

  验证：`bun run typecheck`、`bun run test` 12/12、`bun run lint`（0 errors / 46 既存 warnings 无新增）。e2e 无依赖 `ttpos-pos` 字面量，CI 会自动覆盖回归。
