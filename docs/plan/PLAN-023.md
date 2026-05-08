# PLAN-023 公开 latest 下载入口按平台固化 artifact 默认值

- **status**: completed
- **createdAt**: 2026-05-08
- **approvedAt**: 2026-05-08
- **completedAt**: 2026-05-08
- **relatedTask**: ENH-004

## 现状

`ENH-003` 已新增默认 `prod` 的公开 latest 下载入口：

- `/download/latest/<owner>/<app_identifier>/<platform>/<arch>/<package>`

用户确认当前仍是单路发布，希望继续把 `arch` 和 `package` 按平台固化，公开 URL 收敛为：

- `/download/latest/ttpos/ttpos_kitchen/android`
- `/download/latest/ttpos/ttpos_kitchen/windows`
- `/download/latest/ttpos/ttpos_kitchen/macos`

## 方案

1. 在 server route 新增 `GET /download/latest/:owner/:app_identifier/:platform`。
2. 在 handler 中为平台级入口注入固定默认值：
   - `android`: `arch=arm64`, `package=apk`
   - `windows`: `arch=amd64`, `package=exe`
   - `macos`: `arch=arm64`, `package=dmg`
3. 保留完整入口 `/download/latest/:owner/:app_identifier/:platform/:arch/:package`，用于未来 escape hatch。
4. CMS workflow 使用平台级公开 URL。
5. 更新 API 文档、changelog 和 tests。

## 风险

| 风险 | 缓解 |
|------|------|
| 未来多架构或多包格式 | 保留完整入口作为兜底，后续可改成配置化 |
| 未知平台短 URL 误调用 | 返回 400，不隐式猜测 |
| 硬编码分散 | 默认映射集中在 handler 常量 map |

## 范围外

- 不新增数据库字段或平台配置表。
- 不删除完整公开入口。
- 不调整 `/download?key=` 的最终文件响应策略。

## 验收

- 代码、workflow、API 文档、测试和 PMA 记录同步完成。
- 聚焦 gate 运行并记录结果。

## 执行结果

- 新增 `GET /download/latest/:owner/:app_identifier/:platform`。
- 平台级入口固定默认值：
  - `android`: `arch=arm64`, `package=apk`
  - `windows`: `arch=amd64`, `package=exe`
  - `macos`: `arch=arm64`, `package=dmg`
- 未知平台短入口返回 400，不隐式猜测。
- 当时保留完整公开入口 `/download/latest/:owner/:app_identifier/:platform/:arch/:package`；后续 ENH-006 已移除，当前公开 latest 下载只保留平台级路由。
- CMS workflow 改用平台级 URL；`server/API.md`、`docs/changelog.md`、`docs/task/ENH-004.md` 已同步。

## 验证记录

- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/handler ./server/handler/create ./mongod ./server/handler/info`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go build ./...`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test -c -o /tmp/faynoSync_tests`
- `docker run --rm -v /Users/ben/projects/ttpos-artifacts/server:/src -w /src golang:1.25.5 go test ./server/... ./mongod ./redisdb`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish-cms-update.yaml"); puts "yaml ok"'`
- `git diff --check`
