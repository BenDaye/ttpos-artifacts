# REFACTOR-002: Dashboard 业务逻辑补完

- **状态**: in_progress
- **优先级**: P1
- **负责人**: ben
- **创建时间**: 2026-04-26
- **关联**: REFACTOR-001（基础骨架，已交付但业务覆盖不足）

## 描述

REFACTOR-001 完成了 dashboard-next 的骨架与基础 CRUD（apps/channels/platforms/architectures/auth/users/tokens/telemetry 基本可用），但用户实际验证后发现多处业务能力缺失或降级。本任务补完关键缺失项，使 dashboard-next 在前端可见行为上对齐旧 dashboard，可作为唯一线上入口取代旧版。

## 范围

按用户决策（2026-04-26）：
- ✅ 包含 R1（apps 三视图 + 版本过滤器）、R2（changelog 预览 + 下载弹窗 + 用户自改密码）、R3（statistics 多维度过滤器）、R5（e2e 用例迁移 + 旧 dashboard 退役）
- ❌ 不含 R4（TUF 多步向导）；TUF 模块在前端禁用（隐藏 settings 入口），但保留 features/tuf 代码以便后续重启

## 子任务

- [x] REFACTOR-002-S0：前端禁用 TUF tab（隐藏 settings 子路由，保留代码） — commit 6a8f17a
- [x] REFACTOR-002-S1：Apps 三视图（Card/List/Board）+ useLayoutPreference + 版本过滤器（channel/platform/arch/published/critical + 搜索）
- [ ] REFACTOR-002-S2：Changelog 预览组件 + 多 Artifact 下载弹窗 + 普通用户自改密码
- [ ] REFACTOR-002-S3：Statistics 过滤器（apps/channels/platforms/architectures 多选 + today 范围）
- [ ] REFACTOR-002-S5：e2e 用例迁移（auth/applications/channels/platforms/architectures/settings-tokens/navigation/app-detail 8 套）+ 旧 dashboard 标记 deprecated

## 验收标准

1. R1：applications 列表支持 Card/List/Board 三种视图切换，刷新页面后视图选择保留；详情页版本列表可按 channel/platform/arch/published/critical 多选过滤 + 文本搜索
2. R2：版本卡片有"查看 changelog"入口弹出结构化预览；多 artifact 版本可一键打开下载弹窗；普通团队用户在 Settings 看到"修改我的密码"入口
3. R3：Statistics 顶栏有 apps/channels/platforms/architectures 多选 + 时间范围（today/week/month）；过滤变化触发 telemetry 重新查询
4. R5：Playwright 8 套用例适配新选择器并通过；CI workflow `build-dashboard.yaml` 加 deprecated 标记；deploy/Caddyfile/docker-compose 不再引用旧镜像
5. TUF：settings sidebar 不显示 TUF；直接访问 `/settings/tuf` 显示"已停用"提示而不是空白

## 不包含（明确范围外）

- R4 TUF 完整多步向导（Bootstrap/RotateRootKeys/SignMetadata/GenerateSignatures/History）
- 数据导出（CSV/JSON）
- App 列表分页（当前单页 50 项已足够）
