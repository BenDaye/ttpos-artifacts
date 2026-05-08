# PLAN-025 收敛公开 latest 下载为单一路由

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: ENH-006

## 现状

`ENH-004` 将公开 latest 下载入口缩短为平台级 URL，但仍保留完整形式作为 escape hatch：

- `/download/latest/<owner>/<app_identifier>/<platform>`
- `/download/latest/<owner>/<app_identifier>/<platform>/<arch>/<package>`

用户进一步确认当前是单路发布，`arch/package` 已经固化，投产前不需要保留第二条公开路由。

## 方案

1. 删除 router 中的 `GET /download/latest/:owner/:app_identifier/:platform/:arch/:package`。
2. 简化 `PublicLatestDownload`：只读取 `platform`，从固定映射注入 `arch/package`，并固定 `channel=prod`。
3. 删除完整公开路由的正向测试，增加完整路径不再注册的断言。
4. 更新 API 文档与 changelog，公开 latest 只保留平台级 URL。
5. 保持 `/apps/latest` 和 `/download?key=` 不变；需要显式查询时继续走 query API，不扩散到公开 path。

## 风险

| 风险 | 缓解 |
|------|------|
| 后续需要临时指定 arch/package | 走 `/apps/latest` query API 或单独再设计明确的新路由，不在投产公开 URL 里预留第二套语义 |
| 测试仍假设完整公开路由存在 | 用 `rg` 清理 active code/API/test 引用，并断言完整路径不再注册 |
| 文档残留两种公开 URL | `server/API.md` 只保留平台级 public request |

## 范围外

- 不改 `/apps/latest` query API。
- 不改 `/download?key=` 最终文件下载器。
- 不新增配置表或动态平台映射。

## 验收

- 代码、测试、API 文档和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 删除 `GET /download/latest/:owner/:app_identifier/:platform/:arch/:package` route。
- `PublicLatestDownload` 只接受平台级 path，按固定映射注入：
  - `android`: `arch=arm64`, `package=apk`
  - `windows`: `arch=amd64`, `package=exe`
  - `macos`: `arch=arm64`, `package=dmg`
- root route 测试断言完整 artifact path 不再注册。
- `server/API.md` 只公开 `/download/latest/<owner>/<app_identifier>/<platform>`。
- `/apps/latest` query API 与 `/download?key=` 保持不变。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler ./server/handler/create ./mongod ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
