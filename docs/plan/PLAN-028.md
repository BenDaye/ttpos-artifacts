# PLAN-028 将 latest 短链改为资源型直达 302

- **status**: completed
- **createdAt**: 2026-05-09
- **approvedAt**: 2026-05-09
- **completedAt**: 2026-05-09
- **relatedTask**: ENH-008

## 现状

`ENH-007` 新增了 `/d/<app_alias>/<platform_alias>`，但该入口只是 302 到标准 latest URL：

- `/d/pos/m -> /download/latest/ttpos/ttpos/macos`

随后标准 latest URL 再 302 到最终 `/download?key=...`。这对 Cloudflare 缓存不够直接，也不像真实下载资源。

## 方案

1. 将短链 route 改为 `GET /dl/:target`。
2. 解析 `target`：
   - `cashier.apk`: `TTPOS + android/arm64/apk`
   - `assistant.exe`: `TTPOS Go + windows/amd64/exe`
   - `menu.dmg`: `TTPOS Menu + macos/arm64/dmg`
3. app alias 固定：
   - `cashier`: `TTPOS`
   - `assistant`: `TTPOS Go`
   - `menu`: `TTPOS Menu`
   - `kitchen`: `TTPOS Kitchen`
   - `shop`: `TTPOS Shop`
4. package target 固定：
   - `apk`: `android/arm64/apk`
   - `exe`: `windows/amd64/exe`
   - `dmg`: `macos/arm64/dmg`
5. 成功时内部调用 latest 查询并直接返回最终 artifact URL 的 302。
6. 只在成功 302 上加 Cloudflare 缓存 header；错误响应不加 edge cache header。
7. 移除未投产的 `/download/latest/:owner/:app_identifier/:platform` 公开 route，latest 下载公开入口只保留 `/dl/:target`。

## 风险

| 风险 | 缓解 |
|------|------|
| 短链复制 latest 查询逻辑 | 仍复用 `info.FetchLatestVersionOfApp`，只在 handler 内做 alias/extension -> query 注入 |
| 错误响应被 Cloudflare 缓存 | 缓存 header 在 `FetchLatestVersionOfApp` 成功 redirect 分支中按 context flag 添加 |
| app display name 与实际 FaynoSync app 不一致 | alias 按用户确认的真实 app name 固化；若后续改名再更新 alias 表 |

## 范围外

- 不改 `/apps/latest` query API。
- 不改 `/download?key=`。
- 不增加 Cloudflare 规则配置。

## 验收

- 代码、测试、API 文档和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 短链 route 已改为 `GET /dl/:target`。
- `target` 使用资源型文件名解析：
  - `cashier.apk`: `TTPOS + prod + android/arm64/apk`
  - `assistant.exe`: `TTPOS Go + prod + windows/amd64/exe`
  - `menu.dmg`: `TTPOS Menu + prod + macos/arm64/dmg`
- 成功时复用 latest 查询并直接返回最终 artifact URL 的 302。
- 成功 302 响应增加：
  - `Cloudflare-CDN-Cache-Control: public, max-age=300`
  - `Cache-Control: no-cache`
- `/download/latest/:owner/:app_identifier/:platform` 已从 server route、handler、测试和当前 API 文档中移除。
- 未知 app alias、未知 extension 或缺少 extension 返回 400。
- `server/API.md`、`docs/changelog.md`、`docs/task/ENH-007.md`、`docs/plan/PLAN-026.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
