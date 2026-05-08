# FEAT-001 新增 latest 路径式下载入口

- **status**: completed
- **priority**: P2
- **owner**: ben
- **createdAt**: 2026-04-20 18:25

## 描述

为客户端、官网下载按钮、二维码、邮件链接等场景提供"打开链接=下载最新平台安装包"的简洁 URL。当前 `/apps/latest` 需要拼装多个 query 参数，对外不友好。

新增路由：

```
GET /latest/:owner/:app_name/:channel/:platform/:arch
GET /latest/:owner/:app_name/:channel/:platform/:arch/:package
```

行为：
- 复用 `info.FetchLatestVersionOfApp`，将路径参数注入 query
- 命中单个 artifact → 302 跳转到下载链接（已实现行为）
- 命中多个（同平台多 package）且未传 `:package` → 返回 JSON
- 未命中 → 404

验收标准：
1. 路由注册位于公开端点段（与 `/apps/latest` 同段）
2. 命中单一 artifact 时返回 302 Location
3. 不破坏 `/apps/latest` 现有行为
4. `go build` 通过

## 进行时描述

正在新增 latest 路径式下载入口

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

涉及文件：
- `server/server/handler/handler.go` — 新增 `LatestDownload` 方法及接口
- `server/server/server.go` — 注册两条路由

实现验证：`go build ./...` 与 `go vet ./...` 通过。
- 2026-05-08：该未投产 `/latest/*` 路由已被 ENH-005 移除；当前公开 latest 下载入口统一为 `/download/latest/<owner>/<app_identifier>/<platform>`。
