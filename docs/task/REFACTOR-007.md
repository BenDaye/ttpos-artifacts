# REFACTOR-007 将 /dl 短链入口迁到 Caddy

- **status**: completed
- **priority**: P1
- **owner**: Codex
- **createdAt**: 2026-07-02
- **related**: PLAN-033, REFACTOR-005, REFACTOR-006, ENH-008

## 描述

`/dl/<alias>.<package>` 是官网、二维码和人工传播使用的公开下载入口。迁移前由 Go server 在启动时读取 `SHORT_LATEST_CONFIG`，注册 `GET /dl/:target`，并在 `ShortLatestDownload` 中解析 alias 后委派 `/apps/latest` 查询。

本任务按已批准的 Gate 1 方案迁移入口所有权：Caddy 承担公开 `/dl/*` route、alias 映射、路由顺序和成功 3xx 缓存头；FaynoSync API 继续通过 `/apps/latest` 作为 latest artifact 的事实源。Cloudflare Worker/KV final URL 物化不在本阶段引入。

## 硬性不变量

- 已发布 URL 契约不变：`/dl/cashier.apk` 等仍返回最终 `/download?key=...` 的 302。
- `latest` 真相仍在 FaynoSync DB / `/apps/latest`，不在 Caddy 或 Worker/KV 复制第二份 final URL 真相。
- Caddy route 顺序固定：`/mcp*` 在前，`/dl/*` 独立处理，普通 API fallback 最后。
- 仅成功 3xx 带 Cloudflare redirect cache header；本地 400 与 upstream 404/409 显式 `no-store`，不带 public/max-age 缓存头。
- Go `/dl` 只能在 Caddy smoke 通过后删除；通过后 server 不再注册 `/dl/:target`。

## 验收

- Caddy 配置新增 `/dl/*` alias-to-`/apps/latest` rewrite，保留 `/mcp*` 和普通 API 行为。
- `curl -I /dl/cashier.apk` 预期 302，`Location` 是最终下载 URL，不是 `/apps/latest`。
- `unknown.apk`、`cashier.zip`、`cashier` 预期 400 且不缓存。
- 大小写行为被验证或显式收窄：`/dl/CASHIER.APK` 要么继续可用，要么文档说明只承诺小写 URL。
- 删除 Go `/dl` 后，server 不再依赖 `SHORT_LATEST_CONFIG`、`short-latest.json` volume 或 `shortlink` 包。
- `go test ./server/...` 默认覆盖 Caddy `/dl` alias 矩阵、route 顺序、rewrite query 和 3xx/4xx/5xx cache header 契约。
- prod 部署前使用 `deploy/scripts/migrate-caddy-shortlinks.sh` 生成、校验并可选应用目标机 Caddyfile，避免手写 Caddy block。

## 批注

- 2026-07-02：按 ultragoal 启动执行，当前进入 G001 Caddy Phase 1；仅改入口配置和文档，Go `/dl` 暂不删除。
- 2026-07-02：`deploy/Caddyfile` 已新增 Caddy-owned `/dl/*` route：case-insensitive alias map -> `/apps/latest` rewrite -> API，成功 3xx 由 Caddy 加 Cloudflare cache headers，未知 alias/extension 由 Caddy 400 拒绝且显式 `no-store`。
- 2026-07-02：G002 本地 hard-gate 通过：Caddy v2.11.4 `validate` 成功，adapt JSON 确认 15 条 alias 映射、3xx-only header、400 fallback；`go test ./server/handler ./server/handler/shortlink ./server/handler/info` 通过。
- 2026-07-02：G003 删除 Go `/dl` 被 hard gate 阻塞：当前没有 staging/host smoke 证明 `update.ttpos.dev` 已由 Caddy 接管 `/dl/*`、`/mcp*` 与 API fallback reload 后正常、Cloudflare 只缓存成功 3xx。Go 回滚路径继续保留。
- 2026-07-02：补充本地 runtime smoke 发现并修复 query 构造风险：不能把整段 `owner=...&app_name=...` 放进单个 Caddy placeholder，否则 `&` 会按 placeholder 值处理。已改为 `map` 输出 app/platform/arch/package 四个字段，并在 rewrite 中用字面量 `&` 拼 query。`tmp/caddy-shortlink-smoke/results.txt` 证明 `/dl/cashier.apk` 与 `/dl/CASHIER.APK` 均 302 到 `/download?key=ttpos/apk` 且带 3xx cache headers，`/dl/shop.apk` upstream 404 与本地 400 均显式 `no-store`。
- 2026-07-02：公网只读 smoke 发现 `update.ttpos.dev/dl/cashier.apk?codex_smoke=...` 当前仍由旧路径返回 404，且 Cloudflare 对 `.apk` 404 给出 `Cf-Cache-Status: MISS` 与 `Cache-Control: max-age=300`；`/apps/latest?...` 同条件 404 且无 cache header。结合 Cloudflare 官方默认缓存行为（静态扩展按扩展名缓存，404/410 在无 origin cache header 时默认有 Edge TTL），Caddy 配置已补强为 `/dl/*` 4xx/5xx 显式 `Cloudflare-CDN-Cache-Control: no-store` 与 `Cache-Control: no-store`。
- 2026-07-02：按“不修改生产”约束在 vm-node02 做只读验证：Caddy 容器版本 v2.11.2、运行 5 周，`/etc/caddy/Caddyfile` 仍只有 `/mcp*` 和 API fallback，grep 不到 `/dl` / `short_latest` / `no-store` 新配置；`caddy validate --config /etc/caddy/Caddyfile` 通过。通过 `--resolve update.ttpos.dev:443:127.0.0.1` 绕开 Cloudflare 打本机 Caddy：`/health` 200，`/mcp` 401，`/dl/cashier.apk` 404，未知 alias/extension 400，且没有新 Caddy `no-store` header。直连 `127.0.0.1:9000` 与 `/apps/latest?...` 结果一致。结论：vm-node02 当时尚未部署 Caddy `/dl` 接管，G003 仍不能删除 Go `/dl`。
- 2026-07-02：确认 vm-node02 是 staging 后，已在 vm-node02 执行受控变更：生成候选 Caddyfile、容器内 validate、备份 `/opt/caddy/Caddyfile` 到 `/opt/caddy/Caddyfile.bak-20260702T162026Z`、替换并 reload Caddy；未触碰另一台 prod VM。staging origin smoke 通过：`/health` 200，`/mcp` 401，`/dl/unknown.apk` / `cashier.zip` / `cashier` 由 Caddy 返回纯文本 400 且 `no-store`，`/dl/cashier.apk` 与大小写变体进入 `/apps/latest` 后 404 且 `no-store`。Cloudflare 路径 smoke 也显示失败响应 `cache-control: no-store` 与 `cf-cache-status: BYPASS/DYNAMIC`。当前仍缺成功 302 smoke，因为 staging Mongo 只有 NESTEA `.png` 测试数据，没有 `TTPOS` / `TTPOS Go` / `TTPOS Menu` / `TTPOS Kitchen` / `TTPOS Shop` 的 published `apk/exe/dmg` artifact；不直接造 DB 数据。
- 2026-07-02：在 vm-node02 staging 插入带 `codex_staging_fixture_shortlink_20260702T1630Z` 标记的可回滚 TTPOS apk fixture，验证后 trap 清理成功（`apps=1 apps_meta=1`，复查 fixture/app meta 计数为 0）。fixture smoke 证明：origin canonical `/dl/cashier.apk` 与 `/dl/CASHIER.APK` 均 302 到最终 `/download?key=...`，带 `Cloudflare-CDN-Cache-Control: public, max-age=300` 与 `Cache-Control: no-cache`；Cloudflare 随机 query 成功路径返回 302 且 `cf-cache-status: MISS`；未知 alias 继续 400 `no-store`。随后执行 Phase 2 删除：移除 Go `/dl` handler、`shortlink` 包、`SHORT_LATEST_CONFIG` 加载、`/dl/:target` route 注册、compose `short-latest.json` volume/env 与示例配置。
- 2026-07-02：补充 `server/server/caddy_config_test.go` 契约测试，默认在 `go test ./server/...` 覆盖 15 条 Caddy alias 映射、`/mcp*` -> `/dl/*` -> API fallback 顺序、`/apps/latest` rewrite query、成功 3xx public redirect cache header、失败 4xx/5xx `no-store` header 与未知 alias 400。
- 2026-07-02：补充 `deploy/scripts/migrate-caddy-shortlinks.sh` 迁移脚本：默认 dry-run，从仓库 canonical `deploy/Caddyfile` 抽取 `update.ttpos.dev` block，替换目标机 Caddyfile 中同名 block，支持容器/本机 Caddy validate；只有显式 `--apply --reload` 才备份、写入并 reload。
- 2026-07-02：只读检查 prod，当前 prod 仍是 nginx compose，工作目录 `/ttpos-releases`，`SHORT_LATEST_CONFIG=/app/short-latest.json` 来自 `/ttpos-releases/docker/api/short-latest.json`，服务名是 `api` / `dashboard` 而非 staging 的 `faynosync-api` / `faynosync-dashboard`。迁移脚本已补充 `--shortlink-json` 校验和 upstream override；用 prod JSON dry-run 证明 15 条 alias/package 映射匹配，生成的 prod candidate Caddyfile 使用 `api:9000` / `dashboard:3000` 且 validate 通过。未写入 prod、未 reload。

## Prod 迁移脚本

prod 当前仍是 nginx compose；切 Caddy 前，应先准备目标 Caddyfile，再用 prod 的 legacy shortlink JSON dry-run：

```bash
./deploy/scripts/migrate-caddy-shortlinks.sh \
  --target /opt/caddy/Caddyfile \
  --shortlink-json /ttpos-releases/docker/api/short-latest.json \
  --api-upstream api:9000 \
  --dashboard-upstream dashboard:3000 \
  --mcp-upstream none
```

确认 candidate、`shortlink-json: matched 15 alias/package mappings`、Caddy validate 结果和 smoke 计划后，再应用：

```bash
./deploy/scripts/migrate-caddy-shortlinks.sh \
  --target /opt/caddy/Caddyfile \
  --shortlink-json /ttpos-releases/docker/api/short-latest.json \
  --api-upstream api:9000 \
  --dashboard-upstream dashboard:3000 \
  --mcp-upstream none \
  --apply \
  --reload
```

脚本会先生成 candidate，再 validate；应用时会备份为 `/opt/caddy/Caddyfile.bak-<UTC timestamp>`。若 Caddy 容器名不是 `caddy`，传 `--caddy-container <name>`；若容器内配置路径不是 `/etc/caddy/Caddyfile`，传 `--container-config <path>`。

## Host smoke 证据

Phase 2 删除 Go `/dl` 前，需要在实际 host/staging reload 后留下以下证据；vm-node02 staging 已完成，其中成功 302 通过可回滚 fixture 验证：

```bash
caddy validate --config /etc/caddy/Caddyfile
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/mcp
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/health
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/dl/cashier.apk
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/dl/CASHIER.APK
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/dl/unknown.apk
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/dl/cashier.zip
curl -sS --max-time 10 -o /dev/null -D - https://update.ttpos.dev/dl/cashier
```

必须证明：`/mcp*` 未回归；普通 API fallback 未回归；成功 `/dl` 返回最终 `/download?key=...` 且仅 3xx 带 Cloudflare public cache header；本地 400 与 upstream 404/409 显式 `no-store` 且不带 public/max-age 缓存头。若域名经过 Cloudflare，还要记录 `CF-Cache-Status`，确认只缓存成功 redirect。
