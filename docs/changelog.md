# 变更日志

## 2026-04-25 [REFACTOR-001] 按 pma-web 规范重构 Dashboard

新增 `dashboard-next/`，作为现有 `dashboard/` 的并行重写版本，验收完成后将取代旧版。业务逻辑（API 契约、auth 流程、TUF 脚本生成器、localStorage key）完全保留。

技术栈变更：
- React 18 → 19；Vite 6 → 8；TypeScript 5 → 6；Tailwind 3 → 4（@theme + oklch）
- Yarn 4 → Bun workspaces；ESLint 8 + Prettier → ESLint 9 flat + `@antfu/eslint-config`
- React Router v6 → TanStack Router 文件路由；Formik → react-hook-form + Zod
- Axios → 自研 fetch wrapper（`shared/lib/http.ts`）；新增 Zustand UI 状态
- shadcn/ui (`base-nova`) + `@base-ui-components/react` 替代 Radix-UI 自定义封装
- 引入 react-i18next（英文优先，中文可切换）
- 新增 Vitest 4 单元测试 + Playwright 烟测

目录结构（新）：
```
dashboard-next/
├── apps/web/                      React 19 SPA
├── packages/shared/               共享类型与常量
├── packages/config/tsconfig/      共享 TS 基础配置
├── e2e/                           Playwright 烟测
├── Dockerfile                     多阶段构建（bun → nginx）
└── eslint.config.js
```

CI/CD：
- 新增 `.github/workflows/build-dashboard-next.yaml`，独立的 quality-gates（lint/typecheck/test/build/e2e）+ Docker 镜像构建
- 新镜像名：`ghcr.io/<owner>/ttpos-artifacts/faynosync-dashboard-next`
- 旧 `build-dashboard.yaml` 与 `dashboard/` 暂时保留，作为回滚锚点

业务保留承诺：
- 17 条 API 端点请求/响应契约不变
- 路由路径完全一致（`/`、`/applications`、`/applications/:appName`、`/channels`、`/platforms`、`/architectures`、`/statistics`、`/settings`、`/settings/tuf`、`/settings/tokens`、`/signin`、`/signup`）
- localStorage key 不变（`token`、`themeMode`、`layoutPreference`、`tuf-history`）
- TUF 脚本生成器（7 份纯函数文件）原样平移
- 401 重定向行为通过 fetch wrapper 等价实现

后续增强（不阻塞此次合入）：
- `applications` 列表的 list / board 视图（当前仅 card）
- TUF Bootstrap / RotateRootKeys 多步向导（当前仅 Bootstrap 单脚本生成器；旧 dashboard 多步向导仍可用）
- 完整 e2e 用例迁移（当前仅基础烟测；旧 e2e 套件依赖 Formik/Radix 选择器需重写）

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
