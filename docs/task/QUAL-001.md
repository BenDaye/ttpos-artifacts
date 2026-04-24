# QUAL-001 Dashboard 代码质量改善

- **status**: pending
- **priority**: P2
- **owner**: (未分配)
- **createdAt**: 2026-04-17 10:00

## 描述

改善 Dashboard 代码质量，解决关键的代码异味问题。

验收标准：
1. 拆分巨型组件：Dashboard.tsx（1131 行）、EditVersionModal.tsx（1285 行）、StatisticsPage.tsx（920 行）
2. 在路由层添加 React Error Boundary
3. 5 个 Delete*ConfirmationModal 合并为通用 DeleteConfirmationModal
4. 统一 API 错误处理模式（创建 `handleApiError` 工具函数）
5. 消除关键的 `any` 类型使用
6. 消除 Server 端 `check.go` 重复函数

## 进行时描述

正在改善 Dashboard 代码质量

## 依赖

- **blocked by**: (无)
- **blocks**: (无)

## 笔记

涉及文件：
- `dashboard/src/components/Dashboard.tsx` — 拆分
- `dashboard/src/components/EditVersionModal.tsx` — 拆分
- `dashboard/src/pages/StatisticsPage.tsx` — 拆分
- `dashboard/src/components/Delete*ConfirmationModal.tsx` — 合并
- `server/server/utils/check.go:22-139` — 泛型重构
