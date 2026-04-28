# REFACTOR-003: 修复 Dashboard Next 生产替换阻断项

- **status**: completed
- **priority**: P1
- **owner**: codex
- **createdAt**: 2026-04-28 16:46
- **completedAt**: 2026-04-28 17:16
- **related**: PLAN-005, REFACTOR-002, BKD e2y73amh

## 描述

dashboard-next 已通过本地质量门禁，但生产替换审计发现多处真实后端契约与旧 dashboard 业务能力不一致，导致它暂不具备无条件取代旧 dashboard 的标准。本任务修复这些阻断项，并在修复后重新评估是否可投入生产替换。

## 范围

- 修复 CI/CD token 创建与撤销的前后端契约：allowed app 使用 ObjectID，撤销使用 JSON body。
- 修复私有 artifact 下载与复制链接流程：通过鉴权请求换取后端返回的 `download_url`。
- 恢复 platform updater 管理能力，并保持 `/platform/update` 必填 `updaters` 契约。
- 恢复版本上传与追加 artifact 的 updater / signature / intermediate 字段能力。
- 恢复 channels / platforms / architectures 的搜索过滤。
- 修复登录后返回原受保护路径。
- 修正 team user allowed scope 使用 ID 值，显示层再映射为名称。
- 增补 e2e / 单元测试，覆盖真实契约风险点。

## 不包含

- TUF 多步向导恢复。用户已明确仍不需要 TUF；`/settings/tuf` 继续保持停用占位。
- 后端接口重构或权限模型大改。

## 验收标准

1. `dashboard-next` token 创建传 app ObjectID，空 scope 不再提交；撤销 token 使用 DELETE JSON body 并通过后端契约测试。
2. 私有下载按钮与复制链接均先带 Bearer token 请求 artifact link，正确处理 `{ download_url }`。
3. platform 创建/编辑可配置 updater 列表与默认 updater；编辑不会清空或遗漏 `updaters`。
4. upload / add artifact 支持 updater、Tauri signature、intermediate。
5. taxonomy 页面搜索可用，登录 redirect 可保留。
6. scoped team user allowed values 存储 ID，UI 显示名称。
7. `bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`、`bun run test:e2e` 通过。
8. 完成后重新输出 dashboard-next 替换 dashboard 的生产评估。

## 进行时描述

Completed dashboard-next production replacement blocker fixes.

## 依赖

- **blocked by**: 用户批准 PLAN-005
- **blocks**: dashboard-next production replacement decision

## 笔记

- 2026-04-28 16:46：创建并认领任务；BKD issue `e2y73amh` 已创建为 `todo`，等待 PMA proposal approval 后再切到 `working`。
- 2026-04-28 17:16: Implemented PLAN-005 scope and verified `dashboard-next` with typecheck, lint, unit tests, production build, and Playwright e2e. Reassessment: the audited blockers in REFACTOR-003 are fixed; dashboard-next meets the production replacement bar for this scope. TUF remains intentionally disabled by prior product decision.
