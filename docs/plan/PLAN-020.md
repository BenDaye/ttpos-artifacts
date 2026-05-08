# PLAN-020 完善 latest 路径式下载入口投产缺口

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: BUG-012

## 现状

`FEAT-001` 已交付路径式 latest 下载入口，server 当前注册：

- `GET /latest/:owner/:app_name/:channel/:platform/:arch`
- `GET /latest/:owner/:app_name/:channel/:platform/:arch/:package`

该入口通过 `LatestDownload` 将 path params 注入 query 后复用 `FetchLatestVersionOfApp`。投产审计发现：

1. 路由本身没有直接测试，现有 `TestFetchkLatestVersionOfApp` 只覆盖 `/apps/latest`。
2. repository 对 app/channel not found 返回 error，handler 将其映射为 500，不符合 FEAT-001 的 404 验收。
3. `CreateCacheKey` 没有 owner 维度，`PERFORMANCE_MODE=true` 时存在同名 app 跨 owner 缓存污染风险。
4. CMS 下载页 workflow 仍调用 `/apps/latest` query API，未验证路径式入口在真实发布链路中的可用性。
5. `server/API.md` 未记录 `/latest/...` 路径式入口。

## 方案

1. 在 `mongod` repository 层为 latest not found 场景暴露可识别 sentinel error，handler 将其映射为 404。
2. 将 `CreateCacheKey` 改为包含 `owner`，并把 upload/update cache invalidation pattern 同步到新 key 形态。
3. 扩展 server 测试：
   - `/latest/admin/testapp/stable/universalPlatform/universalArch/dmg` 返回 302。
   - `/latest/admin/testapp/stable/universalPlatform/universalArch` 返回多 package JSON。
   - `/latest/admin/missing/stable/universalPlatform/universalArch/dmg` 返回 404。
   - `CreateCacheKey` 输出包含 owner。
4. 将 `.github/workflows/publish-cms-update.yaml` 的 FaynoSync 查询改为路径式 `/latest/...`，通过 `jq @uri` 编码 owner/app/channel/platform/arch/package。
5. 更新 `server/API.md` 和 `docs/changelog.md`。

## 风险

| 风险 | 缓解 |
|------|------|
| URL path segment 中 app name 包含空格 | workflow 使用 `jq @uri` 对每个 segment 编码 |
| cache key 形态改变导致旧 Redis key 残留 | 旧 key 不再命中，按 TTL 自然过期；新 invalidation pattern 覆盖 owner 前缀 |
| 本地环境无法运行 Go gate | 尝试本地 gate；若缺少 Go，记录无法运行原因，并保留 CI/Docker build 作为后续验证点 |

## 范围外

- 不恢复 TUF 前端入口。
- 不改 `/download` 鉴权策略；公网直接下载仍依赖 app 是否 public 或部署是否允许 private download public redirect。
- 不重构 FaynoSync repository 全局错误模型。

## 验收

- 代码、测试、workflow、API 文档和 PMA 记录同步完成。
- 聚焦 gate 尽可能运行并记录结果。

## 执行结果

- `mongod` latest repository 对 app/channel not found 暴露 sentinel error，handler 映射为 404。
- latest/checkVersion cache key 增加 owner 维度，upload invalidation pattern 同步新 key 形态。
- `/latest/...` 路径入口补充 302、JSON fallback、404 和 cache key 测试。
- CMS 发布 workflow 使用路径式 latest URL，并对 path segment 做 URL encode。
- `server/API.md`、`docs/changelog.md`、`docs/task/BUG-012.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`

完整 `go test ./...` 仍依赖 root `TestMain` 的 `.env`/Mongo 环境，本地未作为通过 gate。
