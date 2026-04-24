# PLAN-002 代码审查问题分阶段修复

- **status**: completed
- **createdAt**: 2026-04-17 10:00
- **approvedAt**: 2026-04-17 10:30
- **relatedTask**: SEC-001 ~ SEC-006, QUAL-001, PERF-001, PERF-002

## 现状

2026-04-17 对项目进行全面代码审查，发现 20+ 个安全漏洞、9 个代码异味、8 个性能问题。覆盖 Server（Go）、Dashboard（React）、CI/CD（GitHub Actions）、部署配置（Docker Compose / Nginx）四个维度。

关键发现摘要：
- **严重**：`.env.example` 泄露真实凭证、`context.WithTimeout` 返回值误用导致 goroutine 泄漏、不安全类型断言导致 panic
- **高危**：JWT_SECRET 无校验、登录无限流、文件上传无限制、Nginx 缺安全头
- **中等**：巨型组件（1000+ 行）、重复代码、缺索引、React Query 无缓存策略

## 方案

分 3 个阶段、9 个任务批次推进：

### 阶段一：紧急修复（P0，1 周内）

| 任务 | 范围 | 核心改动 |
|------|------|---------|
| SEC-001 凭证安全加固 | Server + Deploy | 清理 `.env.example` 真实凭证，移除 docker-compose 默认密码，Redis 加密码，`os.Setenv` 改 DI |
| SEC-002 修复运行时崩溃 bug | Server | 全局修复 `defer ctxErr()` → `defer cancel()`（12+ 处）；所有 `.(type)` 加 ok 检查 |
| SEC-003 认证安全增强 | Server | JWT_SECRET 启动校验、登录/注册限流中间件、密码强度校验 |

### 阶段二：高优先修复（P1，2 周内）

| 任务 | 范围 | 核心改动 |
|------|------|---------|
| SEC-004 请求安全限制 | Server | 文件上传 MaxMultipartMemory、分页 limit 上限、错误信息脱敏 |
| SEC-005 HTTP 与前端安全加固 | Dashboard + Nginx | Nginx 安全响应头、Markdown 渲染 sanitize、`innerHTML` → `textContent`、CORS 清理 |
| SEC-006 CI/CD 安全加固 | Workflows | 工作流输入转义校验、secrets mask、权限最小化 |

### 阶段三：质量与性能改善（P2，持续）

| 任务 | 范围 | 核心改动 |
|------|------|---------|
| QUAL-001 Dashboard 代码质量改善 | Dashboard | 拆分巨型组件、添加 Error Boundary、消除重复 Delete Modal、统一错误处理、消除 `any` |
| PERF-001 Server 性能优化 | Server + MongoDB | 添加数据库索引、优化聚合管道、合并 N+1 查询 |
| PERF-002 Dashboard 性能优化 | Dashboard | React.memo、staleTime 配置、搜索防抖、大 changelog 虚拟化 |

## 风险

1. **凭证轮换**（SEC-001）：需要在所有环境同步更新，否则服务中断
2. **context cancel 修复**（SEC-002）：改动面广（12+ 文件），需回归测试全部 handler
3. **限流中间件**（SEC-003）：需要 Redis 依赖，影响无 Redis 部署模式
4. **组件拆分**（QUAL-001）：工作量大（3 个 1000+ 行组件），需逐步推进避免回归

## 工作量

| 阶段 | 预估工时 | 任务数 |
|------|---------|--------|
| 阶段一（P0） | ~16h | 3 |
| 阶段二（P1） | ~16h | 3 |
| 阶段三（P2） | ~32h | 3 |
| **合计** | **~64h** | **9** |

## 备选方案

- **阶段一可选**：SEC-001 中 `os.Setenv` 改 DI 可推迟到阶段二，仅先清理 `.env.example`
- **阶段三可选**：QUAL-001 组件拆分可按单个组件逐步进行，不必一次性完成
- **前端 token 存储**：localStorage → httpOnly cookie 需后端配合，可作为独立后续任务

## 批注

（等待用户审批。）
