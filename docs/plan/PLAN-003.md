# PLAN-003 Dashboard 按 pma-web 规范重构

- **status**: completed
- **completedAt**: 2026-04-25
- **createdAt**: 2026-04-25
- **approvedAt**: 2026-04-25
- **relatedTask**: REFACTOR-001

## 现状

`dashboard/` 当前为 React 18 + Yarn 4 + Vite 6 + React Router v6 + Tailwind 3 + Formik + Axios，共 117 个 ts/tsx 文件 ~21,855 行。33 个顶层 modal、6 份手写 CSS、扁平 src 结构、无 Vitest，与 pma-web 规范多处偏离。详细对照见 docs/task/REFACTOR-001.md。

业务逻辑面：
- 17 条 API 前缀（/apps /app /user /users /whoami /channel /search /telemetry /platform /arch /admin /tuf /upload /artifact /token /login /signup）
- localStorage 键 `token`、`themeMode`
- TUF 脚本生成器（`components/settings/tuf/` 18 文件）
- 三视图（Card/List/Board）+ `useLayoutPreference`
- Theme auto 模式（20:00–6:00 + prefers-color-scheme，60s 轮询）

## 方案

并行新建 `dashboard-next/` 目录，按 pma-web 规范完整搭建后切换。**6 阶段一次性走完**，每阶段结束跑 `lint / typecheck / build`，最后阶段额外跑 `test` 与 e2e。

### 决策摘要（用户已确认 2026-04-25）

| # | 决策 | 选择 |
|---|------|------|
| 1 | 重构策略 | 新建 `dashboard-next/` 并行开发 |
| 2 | i18n | 接入 react-i18next，英文优先，支持中文切换 |
| 3 | 包管理器 | Bun workspaces |
| 4 | 表单库 | react-hook-form |
| 5 | 执行节奏 | 一次性走完 6 阶段 |
| 6 | 命名 | REFACTOR-001 + S0..S5 子任务 |

### 阶段切片

| 阶段 | 目标 | 主要产出 |
|------|------|---------|
| S0 基线骨架 | 搭建 Bun monorepo 与质量门 | `package.json`(workspace) `apps/web` `packages/{shared,config}` `eslint.config.js` `tsconfig` `vite.config.ts` `index.html` `main.tsx` 占位 `vitest` 配置 |
| S1 路由与外壳 | TanStack Router + Providers + 主题 + i18n | `app/routes/__root.tsx` `app/routes/_public/{signin,signup}.tsx` `app/routes/_private/...`（10 路由） `app/providers.tsx` `app/i18n.ts` `public/locales/{en,zh}` ThemeProvider |
| S2 数据层 | HTTP + Query + Auth + Zustand | `shared/lib/http.ts` `shared/lib/query-client.ts` `features/auth/api.ts` `features/auth/auth-store.ts` `shared/stores/ui-store.ts` |
| S3 核心页面 | auth + applications + channels + platforms + architectures | `features/auth/*` `features/apps/*` `features/channels/*` `features/platforms/*` `features/architectures/*`（含 hooks/api/components/views） |
| S4 复杂页面 | statistics + settings + tuf + 通用 modal | `features/telemetry/*` `features/settings/*` `features/tuf/*`（脚本生成器原样平移） `shared/components/{base-modal,stepper-modal}` 三视图组件迁移 |
| S5 出厂 | Dockerfile + workflow + e2e + changelog | `dashboard-next/Dockerfile` `docker-entrypoint.sh` `nginx.conf` `.github/workflows/build-dashboard.yaml`（新镜像 tag 路径） `e2e/*` 迁移 `docs/changelog.md` 追加条目 |

### 业务逻辑保留承诺

- 全部 API endpoint 行为不变；axios 401 重定向行为在 fetch wrapper 中等价实现
- localStorage 键名/值结构保持不变（用户登录态、布局偏好、主题偏好不丢）
- 路由路径保持不变：`/`、`/applications`、`/applications/:appName`、`/channels`、`/platforms`、`/architectures`、`/statistics`、`/settings`、`/settings/tuf`、`/settings/tokens`、`/signin`、`/signup`
- TUF 脚本生成器逐字平移（这部分是已验证的安全敏感代码）
- ProxyTarget 列表与 dev 行为保留

### 目录结构

```
dashboard-next/
├── package.json                   # workspace root, bun
├── bun.lock
├── tsconfig.json                  # solution-level
├── eslint.config.js               # @antfu/eslint-config flat
├── apps/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json (extends config/react)
│       ├── components.json        # shadcn base-nova
│       ├── index.html
│       ├── public/locales/{en,zh}/{common,auth,apps,settings}.json
│       └── src/
│           ├── main.tsx
│           ├── index.css          # tailwind v4 @theme + tokens
│           ├── app/
│           │   ├── providers.tsx
│           │   ├── i18n.ts
│           │   ├── routeTree.gen.ts (auto)
│           │   └── routes/__root.tsx, _public/*, _private/*
│           ├── features/
│           │   ├── auth/{api.ts, hooks.ts, components/, auth-store.ts}
│           │   ├── apps/{api.ts, hooks.ts, components/, views/}
│           │   ├── channels/{api.ts, hooks.ts, components/}
│           │   ├── platforms/{...}
│           │   ├── architectures/{...}
│           │   ├── telemetry/{api.ts, hooks.ts, components/}
│           │   ├── settings/{users,tokens,tuf}
│           │   └── tuf/scripts/  # 脚本生成器（原样迁移）
│           └── shared/
│               ├── components/ui/   # shadcn 输出
│               ├── components/common/{base-modal,stepper-modal,layout-switcher}
│               ├── hooks/use-debounce.ts, use-media-query.ts, use-toast.ts
│               ├── lib/http.ts, query-client.ts, utils.ts
│               └── stores/ui-store.ts
├── packages/
│   ├── shared/
│   │   ├── package.json (workspace:*)
│   │   └── src/index.ts            # 共享 enum/类型
│   └── config/
│       └── tsconfig/{base,react}.json
└── e2e/                            # 整体迁移 Playwright 用例
```

## 风险

1. **TanStack Router 学习与配置成本**：用 generated route tree 替代命令式 router；缓解：每条路由 1:1 对照旧路由表
2. **Tailwind v4 @theme 与现有 HSL 变量**：Tailwind 4 大版本变化大；缓解：oklch 转换并把所有 token 集中在 `index.css`
3. **shadcn `base-nova` 与现有视觉差异**：UI/UX 允许变化，但避免过度风格化；缓解：保留信息层级与交互模式
4. **TUF 脚本生成器迁移误差**：安全敏感；缓解：脚本字符串模板逐字复制，同步迁移单元测试
5. **Vite 8 + React 19 + 老依赖**：recharts、react-datepicker、react-toastify 等需验证 React 19 兼容；缓解：S0 锁定可工作版本，必要时替换（toastify → sonner）
6. **i18n 字符串覆盖度**：英文 → 中文双套；缓解：先抽 namespace 骨架，业务文本逐特性补齐
7. **Bun 与 yarn lockfile 共存**：风险低（不同目录）；缓解：`dashboard-next/` 完全独立 lock

## 工作量

| 阶段 | 预估 |
|------|------|
| S0 | 1 工作日 |
| S1 | 1 工作日 |
| S2 | 1 工作日 |
| S3 | 2 工作日 |
| S4 | 2 工作日 |
| S5 | 1 工作日 |
| 合计 | ~8 工作日 |

## 备选方案

- **不引入 Zustand**：UI 状态全部 Context；优点：依赖更少；缺点：偏离 pma-web。已选标准方案。
- **toastify 替换为 sonner**：若 react-toastify 不兼容 React 19；视 S0 验证结果决定
- **保留 dashboard/ 永久共存**：不切换；本计划默认验收完成后由 dashboard-next 取代

## 批注

- 2026-04-25 用户批准 6 项关键决策，进入实施。
- 2026-04-25 6 阶段一次性走完。lint / typecheck / build / test / e2e 烟测全绿。
  - 阶段裁剪：list/board 视图、TUF 多步向导、完整 e2e 用例迁移列入 README 后续增强（不阻塞合入）。
  - 包结构：`dashboard-next/{apps/web, packages/{shared,config}}`。
  - 镜像：`ghcr.io/<owner>/ttpos-artifacts/faynosync-dashboard-next`，旧 `dashboard/` 镜像继续维护作为回滚锚点。
