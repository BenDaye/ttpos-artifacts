# BEN-46: Fork FaynoSync 并重构为 Monorepo

- **状态**: completed
- **优先级**: P1
- **负责人**: b935-fork-faynosync
- **issue_id**: b4cba450-fc8d-43e8-bb91-acc6b7e6d67f
- **创建时间**: 2026-03-23

## 描述

Fork ku9nov/faynoSync 后端仓库，断连上游，与现有 ttpos-artifacts（Dashboard + CI/CD）合并为 monorepo 结构。同时修复版本唯一性 bug。

## 子任务

- [ ] Fork FaynoSync 后端代码到本地
- [ ] 设计并实施 monorepo 目录结构
- [ ] 修复版本唯一性 bug（MongoDB 索引 + 应用逻辑）
- [ ] 更新 Docker 构建流程（后端 + 前端）
- [ ] 更新 docker-compose 部署配置
- [ ] 更新 GitHub Actions 工作流
- [ ] 更新文档和引用
