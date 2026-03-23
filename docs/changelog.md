# 变更日志

## 2026-03-23 [决策]

Fork FaynoSync 后端（ku9nov/faynoSync），断连上游，重构为 monorepo 结构。

主要变更：
- 新增 `server/`：FaynoSync Go 后端（已 fork 至 BenDaye/faynosync-server）
- `src/` → `dashboard/`：Dashboard React SPA 移入子目录
- `faynosync/` → `deploy/`：部署配置重命名
- 修复版本唯一性 bug：`Upload()` 查询加入 `channel_id`，新增 MongoDB 唯一复合索引
- 新增 `build-server.yaml` 工作流：后端 Docker 镜像自动构建
- 更新 `build-dashboard.yaml`：构建上下文路径适配 monorepo
- 更新 `deploy/docker-compose.yml`：后端镜像从 `ku9nov/faynosync` 切换为自建镜像
