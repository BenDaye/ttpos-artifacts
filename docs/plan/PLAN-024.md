# PLAN-024 移除未投产的 /latest 路由

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: ENH-005

## 现状

当前 latest 下载相关入口有三类：

- `/download/latest/*`：面向官网/CMS/二维码的公开 latest 下载入口。
- `/apps/latest`：既有 query API，提供 latest 查询能力。
- `/download?key=`：既有底层文件下载器，用 storage key 生成下载地址。

先前还保留了 `/latest/*` 显式 channel 路由，但该路由尚未投产，且与 `/download/latest/*` 形成语义重复。

## 方案

1. 从 router 中删除 `/latest/:owner/:app_identifier/:channel/:platform/:arch[:package]`。
2. 删除 `AppHandler.LatestDownload` 与 `appHandler.LatestDownload`。
3. 删除 root test 中 `/latest/*` 注册和专属 subtest；保留 `/apps/latest` 和 `/download/latest/*` 覆盖。
4. 更新 `server/API.md`，只公开 `/download/latest/*`；`/apps/latest` 仍作为 query API 留在原章节。
5. 更新 changelog 与 PMA 记录。

## 风险

| 风险 | 缓解 |
|------|------|
| 误删底层 latest 查询能力 | 只删 path route，保留 `info.FetchLatestVersionOfApp` 和 `/apps/latest` |
| 测试仍引用 `/latest/*` | `rg` 清理 route/test/API 引用，并跑 Go gate |
| 后续需要指定非 prod channel | 暂不暴露 path route；如需要再以明确 `/download/channel/...` 形式设计 |

## 范围外

- 不删除 `/apps/latest` query API。
- 不删除 `/download?key=`。
- 不改 storage 或预签名下载行为。

## 验收

- 代码、测试、API 文档和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 删除 server 中未投产的 `/latest/:owner/:app_identifier/:channel/:platform/:arch` 与 `/latest/:owner/:app_identifier/:channel/:platform/:arch/:package` route。
- 删除 `AppHandler.LatestDownload` 与 `appHandler.LatestDownload`。
- root route 测试改为覆盖 `/download/latest/*`，不再注册或断言 `/latest/*`。
- `server/API.md` 只公开 `/download/latest/<owner>/<app_identifier>/<platform>`；完整公开入口已在 ENH-006 继续移除。
- `/apps/latest` query API 与 `/download?key=` 底层文件下载器保持不变。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler ./server/handler/create ./mongod ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
