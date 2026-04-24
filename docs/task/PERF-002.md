# PERF-002 Dashboard 性能优化

- **status**: pending
- **priority**: P2
- **owner**: (未分配)
- **createdAt**: 2026-04-17 10:00

## 描述

优化 Dashboard 前端渲染性能和网络请求效率。

验收标准：
1. 为纯展示子组件添加 `React.memo`（VersionCard 等列表项）
2. QueryClient 配置 `staleTime: 5min`、`gcTime: 10min`
3. 搜索输入添加 300ms debounce
4. 大 Changelog 渲染添加分页或折叠展示

## 进行时描述

正在优化 Dashboard 性能

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

涉及文件：
- `dashboard/src/main.tsx` — QueryClient 配置
- `dashboard/src/components/Dashboard.tsx` — 搜索防抖 + memo
- `dashboard/src/components/EditVersionModal.tsx` — Changelog 渲染
- `dashboard/src/components/layouts/` — 列表组件 memo
