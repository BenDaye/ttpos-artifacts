# REFACTOR-001: 按 pma-web 规范重构 Dashboard

- **状态**: completed
- **优先级**: P1
- **负责人**: ben
- **创建时间**: 2026-04-25

## 描述

将 `dashboard/` 按 pma-web 规范在 `dashboard-next/` 目录中并行重写，业务逻辑（API 契约、auth 流程、TUF 模块、视图模式、token/themeMode 持久化键）完全保留，UI/UX 可改造。完成验收后由 `dashboard-next/` 取代 `dashboard/`。

技术栈目标：
- React 19 + Vite 8 + TypeScript 5.9 strict
- Bun workspaces（`apps/web` + `packages/shared` + `packages/config`）
- TanStack Router 文件路由 + TanStack Query v5
- Tailwind CSS v4（@theme + oklch）+ shadcn/ui (`base-nova`)
- ESLint 9 + `@antfu/eslint-config`
- react-hook-form 替代 Formik
- react-i18next（英文优先 + 中文切换）
- Vitest 4 + Playwright e2e

## 子任务

- [x] REFACTOR-001-S0：基线骨架（Bun monorepo + React 19 + Vite 8 + TS + Tailwind 4 + ESLint flat + Vitest）
- [x] REFACTOR-001-S1：Providers + 路由 + 主题 + i18n
- [x] REFACTOR-001-S2：HTTP 层 + Query Client + Auth + Zustand
- [x] REFACTOR-001-S3：核心页面（auth/applications/channels/platforms/architectures）
- [x] REFACTOR-001-S4：剩余页面（statistics/settings/tuf）+ Modal 通用化（applications card 视图为主，list/board 与 TUF 多步向导留作后续增强）
- [x] REFACTOR-001-S5：Dockerfile + workflow + e2e 烟测 + changelog

## 验收标准

1. ✅ `bun run lint`、`bun run typecheck`、`bun run build`、`bun run test` 在 `dashboard-next/` 内全部通过（19 个 warning，0 个 error）
2. 部分完成：Playwright e2e 烟测通过（路由保护、未登录跳转、公开路由可达 3 项）；旧 dashboard 完整 8 套用例迁移留作后续任务
3. ✅ 路由路径表完全一致（`/`、`/applications`、`/applications/:appName`、`/channels`、`/platforms`、`/architectures`、`/statistics`、`/settings`、`/settings/tuf`、`/settings/tokens`、`/signin`、`/signup`）
4. ✅ 全部 API 端点请求/响应契约不变（17 条前缀全部覆盖）
5. ✅ localStorage key 不变（`token`、`themeMode`、`layoutPreference`、`tuf-history`）
6. ✅ TUF 脚本生成器（7 个 .ts 文件）原样平移，输出一致
7. ✅ 中英文 i18n 资源齐全，默认英文，可切换中文
8. ✅ Dockerfile 多阶段构建（bun → nginx），`VITE_API_URL` 运行时注入沿用 `__VITE_API_URL_PLACEHOLDER__` 替换机制

## 后续增强（不阻塞合入）

- applications 列表的 list / board 视图（当前仅 card）
- TUF Bootstrap / RotateRootKeys 多步向导（当前仅 Bootstrap 单脚本生成器）
- 完整 e2e 用例迁移（当前仅 3 项基础烟测）
- Settings Profile 编辑、ChangelogModal、AppLogo 上传等次要功能
