# PLAN-033 将 /dl 短链入口迁到 Caddy

- **status**: completed
- **task**: REFACTOR-007
- **createdAt**: 2026-07-02
- **owner**: Codex
- **source**: `.omx/plans/short-link-proxy-research-20260630T194935Z.md`

## Context

现状：

- 迁移前 `deploy/Caddyfile` 的 `update.ttpos.dev` 只处理 `/mcp*` 和普通 API fallback，没有 `/dl` 边缘逻辑。
- 迁移前 `server/server/server.go` 通过 `SHORT_LATEST_CONFIG` 加载 shortlink catalog，并在配置存在时注册 `GET /dl/:target`。
- 迁移前 `server/server/handler/handler.go` 的 `ShortLatestDownload` 解析 alias/extension，构造 latest query，再委派 `info.FetchLatestVersionOfApp`。
- `/apps/latest` 已支持 snake identifier fallback，可让 Caddy 使用 `ttpos_go` 等 identifier，避免展示名空格。

用户判断是正确的：`/dl` 是公开下载入口，不是 FaynoSync 核心 API 模型。迁移目标不是把 latest 真相复制到边缘，而是把公开入口和 alias 映射迁到 Caddy，继续由 `/apps/latest` 负责 artifact 事实查询。

## Proposal

### Phase 1

1. 在 `deploy/Caddyfile` 中新增 `/dl/*` 独立 route。
2. 用 Caddy `map` 将 `/dl/<alias>.<package>` 映射为 `/apps/latest` query。
3. 保持 route 顺序：`/mcp*`、`/dl/*`、catch-all API。
4. 只对 upstream 3xx 添加 `Cloudflare-CDN-Cache-Control: public, max-age=300` 和 `Cache-Control: no-cache`。
5. 对未匹配 alias/extension 直接返回 400；对 `/dl/*` 4xx/5xx 显式 `no-store`，避免 Cloudflare 按 `.apk` / `.exe` / `.dmg` 静态扩展缓存失败响应。
6. Phase 1 保留 Go `/dl` 作为回滚，不删除 `shortlink` 包和 compose env/volume；Phase 2 在 staging smoke 后删除。

### Phase 2

只有 Phase 1 smoke 通过后，才删除：

- `server/server/handler/shortlink`
- `ShortLatestDownload`
- `SHORT_LATEST_CONFIG` 加载
- `/dl/:target` route 注册
- `deploy/docker-compose.yml` 的 `short-latest.json` volume/env

## Risks

- Caddy route 顺序错误会导致 `/dl/*` 落入 API fallback。
- alias-to-query 映射错误可能导致下载错包、404 或 409。
- 失败响应如果被 Cloudflare 缓存，会放大短暂缺包或配置错误；Cloudflare 默认会按静态扩展缓存，且 404/410 在无 origin cache header 时存在默认 Edge TTL，因此失败响应需要显式 `no-store`。
- Caddy 精确 path 映射可能丢失当前 Go resolver 的大小写不敏感行为。

## Verification

- `git diff --check`
- 可用时运行 `caddy validate --config deploy/Caddyfile`
- 用 Caddy adapt/validate 或等价方式证明 route 语法有效。
- `cd server && go test ./server/...` 覆盖 Caddy `/dl` route 契约，防止 alias、route 顺序和缓存头漂移。
- prod 发布前用 `deploy/scripts/migrate-caddy-shortlinks.sh` 在目标机生成并 validate 候选 Caddyfile；确认后才 `--apply --reload`。
- smoke `/mcp*`、`/dl/cashier.apk`、`/dl/CASHIER.APK`、`unknown.apk`、`cashier.zip`、`cashier` 和普通 API fallback。
- Phase 2 删除 Go 代码后运行 `cd server && go test ./...`。

## Status Log

- 2026-07-02：计划进入 implementing。当前只执行 Phase 1；Phase 2 受 smoke gate 约束。
- 2026-07-02：Phase 1 Caddyfile 已实现并通过 Caddy v2.11.4 `adapt` / `validate`；由于本机没有线上 upstream 和 Cloudflare，不在本阶段删除 Go `/dl`。
- 2026-07-02：本地 verification 通过：`jq` 检查 adapt JSON 证明 alias map、rewrite、3xx response matcher、400 fallback 存在；Go handler/shortlink/latest 包测试通过。剩余验证缺口是 staging/host smoke 与 Cloudflare `CF-Cache-Status`。
- 2026-07-02：Phase 2 deletion 未执行。原因：缺少 staging/host smoke 与 Cloudflare route/cache evidence；按计划硬门槛，保留 Go `/dl` 作为回滚。
- 2026-07-02：补充本地 runtime smoke 后修正 Caddy rewrite query 构造：由单 placeholder query 改为多字段 placeholder + 字面量 query separator。runtime 证据覆盖 `/mcp`、API fallback、成功 302、大小写兼容、本地 400、upstream 404 `no-store`。
- 2026-07-02：G003 解锁条件已落到任务文档：必须在实际 host/staging reload 后验证 `/mcp*`、API fallback、成功 3xx redirect、未知 alias/extension 400、upstream 404/409 `no-store`，以及 Cloudflare `CF-Cache-Status`。当前环境缺少 `aissh` token，不能完成该线上 smoke。
- 2026-07-02：公网只读 smoke 证明当前线上状态仍不满足 G003：`/dl/cashier.apk?codex_smoke=...` 返回 404，且 `.apk` 404 出现 `Cache-Control: max-age=300` / `Cf-Cache-Status: MISS`；对应 `/apps/latest?...` 也是 404 但无 cache header。按 Cloudflare 默认缓存规则，Caddy Phase 1 已补强 `/dl/*` 4xx/5xx 为显式 `no-store`。
- 2026-07-02：vm-node02 只读验证完成，未执行任何 reload/restart/write：当时 Caddy v2.11.2 配置没有 `/dl` 接管片段，`/dl/*` 仍落到 FaynoSync API；origin smoke 证明 `/health` 与 `/mcp*` 当前正常路由，但 `/dl/cashier.apk` 仍 404、未知 alias 仍 400，且没有本计划新增的失败响应 `no-store`。因此 Phase 2 删除 Go `/dl` 继续被 hard gate 阻止。
- 2026-07-02：用户澄清 vm-node02 是 staging、另一台 VM 是 prod。已只操作 vm-node02：候选 Caddyfile validate 通过后备份、替换并 reload，备份为 `/opt/caddy/Caddyfile.bak-20260702T162026Z`。staging smoke 证明 Caddy 已接管 `/dl/*` 入口和失败响应 `no-store`；Cloudflare 对失败响应不再缓存。但 staging 当前没有 `/dl` 固定 alias 对应的 published `apk/exe/dmg` artifact，只能得到 `/apps/latest` 404，因此 Phase 2 删除 Go `/dl` 仍等待成功 302 smoke 或受控 staging fixture。
- 2026-07-02：使用可回滚 staging fixture 补齐成功 302 smoke：origin canonical `/dl/cashier.apk` 与大小写变体均 302 到最终 `/download?key=...`，成功 3xx 带 public/max-age cache header；Cloudflare 随机 query 成功路径 302 且 `cf-cache-status: MISS`；fixture 已清理并复查计数为 0。随后本地执行 Phase 2 删除：server 不再注册 `/dl/:target`，删除 `shortlink` 包、`SHORT_LATEST_CONFIG`、compose volume/env 与示例配置。
- 2026-07-02：补充 Caddy route 契约测试，`go test ./server/...` 会默认校验 15 条 `/dl` alias 矩阵、route 顺序、rewrite query、3xx cache header、4xx/5xx `no-store` 和未知 alias 400。
- 2026-07-02：补充 prod 迁移脚本 `deploy/scripts/migrate-caddy-shortlinks.sh`：默认 dry-run 生成候选配置，支持容器/本机 Caddy validate，显式 `--apply --reload` 才备份、写入并 reload，避免 prod 部署时手写 Caddy block。
- 2026-07-02：用 prod 现有 `/ttpos-releases/docker/api/short-latest.json` 做只读 dry-run 验证。结论：prod 仍是 nginx compose，Caddy 迁移必须使用 `api:9000` / `dashboard:3000` upstream override，并在没有 MCP 服务时传 `--mcp-upstream none`。脚本已补充 `--shortlink-json`，dry-run 输出 `shortlink-json: matched 15 alias/package mappings (owner=ttpos, channel=prod)`，生成的候选 Caddyfile validate 通过；prod 未写入、未 reload。
- 2026-07-02：Ralph 接管 prod B 方案前再次只读核查，发现 prod 没有现成 Caddy，只有 nginx 绑定 80，且真实域名为 `*.ttpos.com`。原先 `/opt/caddy/Caddyfile` 式 runbook 不足以安全切换真实 prod。已新增 `deploy/prod-caddy-base.Caddyfile` 与 `deploy/docker-compose.prod-caddy.yml`，并让迁移脚本支持 `--source-site`，以便从 staging canonical `update.ttpos.dev` 生成 `http://update.ttpos.com` 候选 block；prod runbook 改为先用 `CADDY_HTTP_PORT=18080` 做 Host-header 预检，再停 nginx 切 80，保留 nginx 可回滚。
- 2026-07-02：按 prod B 完成受控切换。prod 先以 `CADDY_HTTP_PORT=18080` 预检通过，再停 nginx、启动 `faynosync-prod-caddy` 占用 80；origin smoke 和公网 Cloudflare smoke 均通过，成功 `/dl/cashier.apk` 302 到 GCS APK 且可被 Cloudflare HIT，未知 alias 400 `no-store` 且 BYPASS。未更新 prod API 镜像，未删除 legacy `SHORT_LATEST_CONFIG` / `short-latest.json`。
