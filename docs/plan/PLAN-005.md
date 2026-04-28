# PLAN-005 Dashboard Next 生产替换阻断项修复

- **status**: completed
- **createdAt**: 2026-04-28 16:46
- **approvedAt**: 2026-04-28 16:51
- **completedAt**: 2026-04-28 17:16
- **relatedTask**: REFACTOR-003

## 现状

本地审计确认 `dashboard-next` 已具备基本工程门禁：typecheck、lint、unit test、production build、Playwright e2e 均可通过。但 e2e 当前大量使用 mock handlers，未覆盖真实后端的关键契约，因此漏掉以下生产阻断项：

1. CI/CD token 创建和撤销与 server 契约不一致：server 要求 `allowed_apps` 为非空 app ObjectID 列表，DELETE `/token/delete` 要 JSON body；dashboard-next 传 app name / 空数组 / query 参数。
2. 私有 artifact 下载退化：server 在 `ENABLE_PRIVATE_APP_DOWNLOADING=false` 时保护 `/download` 并返回 `{ download_url }`；dashboard-next 使用普通 `<a href>`，不会附带 Bearer token。
3. platform updater 管理丢失：server `/platform/update` 要求 `updaters`，旧 dashboard 可配置 manual / squirrel / electron-builder / tauri 等 updater；dashboard-next 只编辑名称。
4. upload / add artifact 缺少 updater、Tauri signature、intermediate 字段；旧 dashboard 支持这些上传参数。
5. channels / platforms / architectures 搜索过滤在新版缺失。
6. 登录 redirect 参数被写入但登录页固定跳转 `/applications`。
7. team user allowed scope 新版使用名称，server 模型注释与旧 dashboard 均使用资源 ObjectID。

TUF 状态：用户明确仍不需要 TUF，多步 TUF 向导不纳入修复；保留当前禁用入口与占位说明。

## 方案

### R1 Token 契约修复

- `CreateTokenDialog` 保存 app ID 而不是 app name。
- 移除默认 All apps 空数组提交；server 要求至少一个 app，因此 UI 改为必须选择至少一个 allowed app，保留 "all apps" 文案仅用于展示已有空列表的历史 token。
- `settingsApi.revokeToken` 改为 DELETE JSON body。
- e2e mock 改为验证 request body，避免再次把契约问题隐藏。

### R2 私有下载修复

- 在 apps API 层增加 `resolveDownloadUrl(link)`，复用 shared `http` 带 token GET artifact link。
- Download dialog 的 Download / Copy 均先解析 `{ download_url }`，失败时再提示错误或 fallback 到原始公网 link。
- 覆盖单 artifact 和多 artifact 行为。

### R3 Platform updater 修复

- 在 shared `Platform` 类型中补 `Updaters` 与 `Updater` 类型。
- 新增/迁移 `UpdaterSelector` 到 dashboard-next，支持手动、squirrel_darwin、squirrel_windows、sparkle、electron-builder、tauri，确保至少一个 default。
- Platform form 创建/编辑均发送 updater 对象数组；编辑保留已有 updaters，缺失时补 manual default。

### R4 Upload / Add artifact 修复

- 上传表单读取选中 platform 的 updaters；多 updater 时展示 updater select。
- 选择 tauri 时展示 signature 字段。
- 上传和追加 artifact 都提交 `updater`、`signature`、`intermediate`。
- 保持 TUF UI 禁用，不恢复 TUF workflow。

### R5 UX parity 修复

- 为 Channels / Platforms / Architectures 页面加本地搜索输入。
- 登录成功后读取 `redirect` search 参数，优先跳回原路径。
- Team user permission matrix 以 ID 作为 allowed value，显示名称映射。

### R6 验证与再评估

- 更新 e2e mock handlers，使 token/platform/download 请求断言真实 body 形态。
- 增补 Playwright 用例覆盖 token create/revoke、platform updater、private download、taxonomy search、redirect path。
- 跑完整 quality gates 后重新评估 dashboard-next 是否达到生产替换标准。

## 风险

- Token server 当前不支持 "all apps" token；若业务确实需要全量 token，需要后端改契约。本计划选择前端对齐现有后端，不改后端。
- Updater UI 迁移会增加表单复杂度；需要保持默认 manual，避免普通平台创建路径变重。
- 私有下载解析依赖 artifact link 指向 FaynoSync `/download?key=...`；公网直链需要保留 fallback。
- Team user allowed ID 改动可能影响已由 dashboard-next 创建的 name-based scope；若线上已有这类数据，需要一次性修正或手工重存。

## 工作量

- 预计触及 `dashboard-next/apps/web/src/features/{apps,platforms,settings}`、`packages/shared`、locales、e2e fixtures/specs。
- 不改 server 主逻辑，必要时只补前端契约测试。
- 预计 1 个实现批次完成，之后集中跑 quality gates。

## 备选方案

- **改后端放宽契约**：支持 empty allowed_apps 表示 all apps、DELETE query revoke、platform update updaters optional。优点是前端改动少；缺点是扩大后端语义，且与现有 server tests / API.md 不一致。
- **保留 token/updater 为后续任务**：风险不可接受，因为 CI token 和 updater 上传都是生产替换核心能力。

## 执行结果

- Token create now submits non-empty app ObjectID scopes and token revoke uses a DELETE JSON body.
- Private artifact copy/download resolves `/download?key=...` through authenticated `http` and consumes `{ download_url }`.
- Platform create/edit manages updater objects with one default updater and keeps `/platform/update` contract-compliant.
- Upload, add-artifact, and version edit preserve `intermediate`; upload/add-artifact submit updater and Tauri signature when applicable.
- Channels, platforms, and architectures have restored local search; sign-in preserves safe same-origin redirects.
- Team user allowed values are saved as IDs while the UI displays names and coerces legacy name values on save.
- Contract-oriented e2e mocks now reject incorrect token, platform, upload/update, and private download request shapes.

## 生产替换再评估

dashboard-next now meets the production replacement bar for the blockers audited in REFACTOR-003. No unresolved production blocker remains in this scope. TUF remains intentionally disabled and is not part of this replacement decision.

## 批注

- 2026-04-28 16:46：draft created. Waiting for user approval before implementation per PMA.
- 2026-04-28 16:51：user approved with `proceed`; implementation started.
- 2026-04-28 17:16：implementation completed; quality gates passed.
