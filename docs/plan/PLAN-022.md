# PLAN-022 新增默认 prod 的公开 latest 下载入口

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: ENH-003

## 现状

`BUG-012` 和 `ENH-002` 已完成路径式 latest 下载入口与 snake app identifier 支持。当前显式入口为：

- `/latest/<owner>/<app_identifier>/<channel>/<platform>/<arch>`
- `/latest/<owner>/<app_identifier>/<channel>/<platform>/<arch>/<package>`

它的 channel 由 URL path 明确决定。用户确认希望开发不暴露 channel 的公开入口，默认指向 `prod`。

## 方案

1. 新增 `GET /download/latest/:owner/:app_identifier/:platform/:arch/:package`，默认写入 query `channel=prod` 后复用 `info.FetchLatestVersionOfApp`。
2. 保留现有 `/latest/.../<channel>/...` 显式入口不变，避免破坏 JSON fallback 和 channel-specific 用法。
3. CMS workflow 从 `/latest/<owner>/<app>/<channel>/<platform>/<arch>/<package>` 切到 `/download/latest/<owner>/<app>/<platform>/<arch>/<package>`。
4. 更新 API 文档、changelog 和 PMA 记录。
5. 补充 route-level test，确认公开入口默认 `prod`。

## 风险

| 风险 | 缓解 |
|------|------|
| `/latest` 同长度路由冲突 | 使用 `/download/latest` 前缀承载公开入口 |
| 默认 channel 被误解为动态 latest | API 文档明确公开入口固定默认 `prod` |
| 后续需要 test/beta 公开入口 | 保留显式 channel `/latest/.../<channel>/...` |

## 范围外

- 不调整 `/download?key=` 的预签名文件响应策略。
- 不增加 channel alias 配置。
- 不删除或重命名现有 `/latest/...` 路由。

## 验收

- 代码、workflow、API 文档、测试和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 新增 `GET /download/latest/:owner/:app_identifier/:platform/:arch/:package`。
- `PublicLatestDownload` 固定注入 `channel=prod`，复用 `info.FetchLatestVersionOfApp` 的查询、302、404、409 和 cache 行为。
- 保留显式 channel `/latest/...` 入口不变。
- CMS workflow 改用 `/download/latest/...`，公开查询 URL 不再包含 channel path segment。
- `server/API.md`、`docs/changelog.md`、`docs/task/ENH-003.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler ./server/handler/create ./mongod ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
