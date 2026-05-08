# PLAN-021 latest 路径支持 snake app identifier

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: ENH-002

## 现状

`FEAT-001` / `BUG-012` 已让 `/latest/:owner/:app_name/:channel/:platform/:arch/:package` 可作为 latest 下载入口，并补齐 302、404、cache key 和 CMS workflow。但 path 里的 `app_name` 仍是展示名；例如 `TTPOS Kitchen` 在 URL 中必须写成 `TTPOS%20Kitchen`。

用户希望先做轻量改造：不加数据库字段，不迁移历史数据，通过约定把展示名转为 lowercase snake identifier，例如：

- `TTPOS Kitchen` -> `ttpos_kitchen`
- `TTPOS Go` -> `ttpos_go`
- `TTPOS` -> `ttpos`

## 方案

1. 在 `mongod` latest 查询中保留精确 `app_name` 匹配优先级。
2. 精确匹配失败时，列出同 owner 下所有 app meta，并对 `app_name` 做 normalize 后与传入 identifier 比较。
3. 如果匹配 0 个，返回现有 not found sentinel；如果匹配多个，返回 identifier 冲突 sentinel。
4. handler 将冲突 sentinel 映射为安全的 409 JSON。
5. CMS workflow 对每个 FaynoSync app 配置显式 `faynosync_identifier`，使用 snake 值构造 `/latest/...` URL。
6. 更新 tests、`server/API.md`、`docs/changelog.md` 与 PMA 记录。

## 风险

| 风险 | 缓解 |
|------|------|
| 不加数据库唯一索引，冲突只能运行时发现 | repository 检测到多个 normalized match 时返回 409，不随机选中 |
| normalize 规则不透明 | 文档写明规则：小写，连续非字母数字折叠为 `_`，去首尾 `_` |
| query API `/apps/latest` 也可能传入 identifier | 轻量实现放在 repository 层，因此 query 和 path 入口都会兼容 |

## 范围外

- 不增加 `slug` / `download_slug` 字段。
- 不新增迁移或唯一索引。
- 不调整 Dashboard 创建 app 流程。
- 不改 `/download` 的最终文件响应策略。

## 验收

- 代码、测试、workflow、API 文档和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- `mongod` latest repository 保留精确 app name 优先级，并在 miss 后按 normalized lower_snake identifier 匹配同 owner app。
- 同 owner 下 normalized identifier 冲突时返回 sentinel error，latest handler 映射为 409。
- latest 路由内部参数名改为 `app_identifier`，外部 URL 形态保持兼容。
- upload/update cache invalidation 同时清理真实 app name 与 normalized identifier 的 latest cache key。
- CMS 发布 workflow 使用显式 `faynosync_identifier` 构造 `/latest/...` URL。
- `server/API.md`、`docs/changelog.md`、`docs/task/ENH-002.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler/create ./mongod ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
