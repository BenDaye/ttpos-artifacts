# PERF-001 Server 性能优化

- **status**: pending
- **priority**: P2
- **owner**: (未分配)
- **createdAt**: 2026-04-17 10:00

## 描述

优化 Server 端数据库查询和缓存性能。

验收标准：
1. 为 `username`、`owner`、`app_name` 等高频查询字段创建 MongoDB 索引
2. 优化 `getBasePipeline()` 的 12 阶段聚合管道，减少 `$unwind` 笛卡尔积
3. 合并 `login.go` 的双集合查询为聚合或 `$unionWith`
4. 优化 `list.go` 的 N+1 查询模式

## 进行时描述

正在优化 Server 性能

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

涉及文件：
- `server/mongod/structs.go:81-162` — 聚合管道优化
- `server/mongod/list.go:13-103` — N+1 查询
- `server/server/handler/sign/login.go:34-66` — 双查询
- MongoDB migration 文件 — 新增索引
