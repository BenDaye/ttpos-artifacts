# PLAN-026 新增极简 latest 下载短链

- **status**: completed
- **createdAt**: 2026-05-09
- **approvedAt**: 2026-05-09
- **completedAt**: 2026-05-09
- **relatedTask**: ENH-007

## 现状

当前标准公开 latest URL 为：

- `/download/latest/<owner>/<app_identifier>/<platform>`

它已经满足单 owner、单 channel、平台默认 artifact 的投产语义，但公开传播仍偏长。用户无额外 DNS 处理权限，因此短链应在现有 server route 内实现。

## 方案

1. 在 auth middleware 前注册 `GET /d/:app/:platform`。
2. 在 handler 中固定 app alias：
   - `pos`: `ttpos`
   - `go`: `ttpos_go`
   - `menu`: `ttpos_menu`
   - `kitchen`: `ttpos_kitchen`
   - `shop`: `ttpos_shop`
3. 固定 platform alias：
   - `a`: `android`
   - `w`: `windows`
   - `m`: `macos`
4. 成功时返回 `302` 到 `/download/latest/ttpos/<app_identifier>/<platform>`。
5. alias 未命中返回 `400`，不隐式猜测。

## 风险

| 风险 | 缓解 |
|------|------|
| 短链逻辑复制 latest 查询 | 只做 alias 映射并 302 到标准 latest URL |
| alias 误拼导致不明确错误 | 未知 app/platform 返回 400 |
| 后续 owner 多租户变化 | 当前按单 owner 固化为 `ttpos`，需要多 owner 时再设计新路由 |

## 范围外

- 不改 `/download/latest/:owner/:app_identifier/:platform`。
- 不改 `/apps/latest` query API。
- 不改 `/download?key=`。
- 不增加 DNS 或反向代理配置。

## 验收

- 代码、测试、API 文档和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 新增 `GET /d/:app/:platform`，注册在 auth middleware 前，作为公开短链入口。
- 新增 `ShortLatestDownload`，成功时返回 `302` 到标准 latest URL。
- app alias：
  - `pos`: `ttpos`
  - `go`: `ttpos_go`
  - `menu`: `ttpos_menu`
  - `kitchen`: `ttpos_kitchen`
  - `shop`: `ttpos_shop`
- platform alias：
  - `a`: `android`
  - `w`: `windows`
  - `m`: `macos`
- 未知 app 或 platform alias 返回 400。
- `server/API.md` 与 `docs/changelog.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
