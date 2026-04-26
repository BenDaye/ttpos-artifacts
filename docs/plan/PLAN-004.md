# PLAN-004 Dashboard 业务逻辑补完

- **status**: in_progress
- **createdAt**: 2026-04-26
- **approvedAt**: 2026-04-26
- **relatedTask**: REFACTOR-002

## 现状

REFACTOR-001 已完成 dashboard-next 的 monorepo 骨架与基础 CRUD（Apps / Channels / Platforms / Architectures / Auth / Users / Tokens / Telemetry），但用户线上验证后发现以下业务能力缺失或降级（依据深度差距分析 2026-04-26）：

**HIGH（必补）**
- Apps 三视图切换（Card / List / Board kanban）+ 视图持久化
- 版本列表过滤器（channel/platform/arch/published/critical）+ 搜索
- Statistics 多维度过滤器（apps/channels/platforms/architectures + today 范围）

**MEDIUM（应补）**
- Changelog 预览（旧版有 ChangelogModal 渲染 Markdown / 数组）
- 多 Artifact 下载弹窗（旧版 DownloadArtifactsModal）
- 普通团队用户自改密码（旧版 ProfileModal）

**LOW（不做）**
- TUF 完整多步向导（用户决策不做，前端禁用入口）
- 数据导出
- App 列表分页

## 方案

按用户决策（2026-04-26），分 5 个阶段顺序推进，每阶段独立上线（commit → push → CI → vm-node02 滚动重启）后才进入下一阶段。每阶段对应一个 BKD issue 用于审计与状态跟踪；不开 worktree 并行，避免分支冲突 + 便于人审。

### 阶段切片

| 阶段 | 子任务 | 工作量 | 主要交付 |
|------|--------|--------|----------|
| **R0** | REFACTOR-002-S0 | XS | settings sidebar 隐藏 TUF；`/settings/tuf` 路由保留但显示"已停用"占位；features/tuf 代码不删 |
| **R1** | REFACTOR-002-S1 | M | LayoutSwitcher（Card/List/Board 三按钮）+ shared/stores ui-store layout 持久化 + AppListView（密集表格）+ AppBoardView（按 channel 分列 kanban）+ 版本过滤器组件（multi-select + 搜索）接入 search api filter |
| **R2** | REFACTOR-002-S2 | S | shared/components/common/changelog-modal.tsx（Markdown via react-markdown，数组按版本分组）+ download-artifacts-dialog.tsx（按 platform/arch 分组列出 artifact 含 size/copy/download）+ Settings users-panel 给非 admin 加"修改密码" 入口（调用新增的 `/users/update-password` 或现有 `/admin/update`，依 server 实现） |
| **R3** | REFACTOR-002-S3 | S | telemetry/components/filter-bar.tsx（4 个 multi-select drop-down 串接 telemetry api）+ TelemetryRange 增加 'today' + StatisticsPage 头部接入过滤器 |
| **R5** | REFACTOR-002-S5 | M | 把 `dashboard/e2e/*.spec.ts` 8 套用例 fork 到 `dashboard-next/e2e/`，按新 selector / 新 modal 结构改写；test:e2e 全部通过；`.github/workflows/build-dashboard.yaml` 加 `deprecated` 注释；deploy/docker-compose / Caddyfile 不引用旧镜像 |

### BKD 编排

- 父 issue：复用 `16g5b296`「遵循 pma-web 规范重构 dashboard」
- 5 个 stage 子 issue（R0/R1/R2/R3/R5）：
  - mode：simple（不 worktree）
  - status flow：`todo` → `working` → `review` → `done`（人审通过后）
  - 每个 issue 详情通过 follow-up 推送：含 docs/task 路径、验收清单、API 端点、风险点、上线 checklist
  - 完成 / 阻塞时 follow-up 回父 issue
- 我（coordinator）顺序执行，每阶段完成 + 上线 + 用户回归后才动下一阶段

### 业务保留承诺

- 17 条 server endpoint 契约不变
- localStorage key 保留：`token` / `themeMode` / `layoutPreference` / `tuf-history`（即使 TUF 禁用，旧 key 不清理）
- 旧 dashboard 镜像继续保留作为回滚锚点，直到 R5 验收完毕
- TUF 代码不删除，便于后续 R4 重启

### 估算

| 阶段 | 工时 | 累计 |
|------|------|------|
| R0 | 0.5h | 0.5h |
| R1 | 4–6h | 6.5h |
| R2 | 2–3h | 9.5h |
| R3 | 2h | 11.5h |
| R5 | 4–6h | 17.5h |
| **合计** | **12.5–17.5h** | — |

## 风险

| 风险 | 缓解 |
|------|------|
| 三视图实现复杂（Board kanban 按 channel 分列，需要 channel groupBy 逻辑 + drag-and-drop？） | 先做读视图，drag-and-drop 暂不做（旧版也无） |
| 版本过滤器与 server search api 多参数兼容（之前已对齐契约） | 用真实账号调用验证一次，必要时 fallback 到客户端过滤 |
| 普通用户自改密码端点：旧版用的是哪个 endpoint？ | R2 实施时确认 server 是否有 `/user/update-password` 或仅 `/admin/update`；若仅 admin 接口，前端给非 admin 显示"请联系管理员" |
| e2e 用例迁移工作量被低估 | R5 单独阶段，不阻塞 R1-R3 主线上线 |
| TUF 禁用后 i18n 字段未删除 → 控制台 warning | i18n key 保留无害；后续 R4 重启可直接复用 |

## 备选方案

- 把 R5（e2e）降级为"覆盖核心业务路径的 4 套（auth + applications + channels + tokens）"而非 8 套全套 — 减半工时
- TUF 禁用方案：A）隐藏 tab + 路由占位（已选）；B）删除 features/tuf/ + 移除路由（更彻底，但失去快速重启能力）

## 批注

2026-04-26 用户批准 R0/R1/R2/R3/R5（不含 R4）。TUF 前端禁用，代码保留。进入实施。

2026-04-26 R1 实施完成：
- AppBoardView 重写为「按 channel 分列」模式：每列一个渠道，列内展示在该渠道下有版本的应用卡片；无版本应用归入「无渠道」列；通过 useQueries 并行预取每个 app 的 versions（limit=100, staleTime=30s）来构建渠道→应用映射
- VersionFilterBar 新增文本搜索框（client-side 匹配 Version / Channel / Changelog 文本），TotalActive 计入 search
- AppDetailPage：filter 多选 length===1 时透传到 /search 单值参数，length>1 时 fallback 到 client-side 多值过滤；published/critical 始终透传
- i18n（en/zh）补 layout.\* / apps.filter.search_placeholder / apps.board.\*
- typecheck/lint（0 errors）/build/test 全绿

2026-04-26 R3 实施完成（commit 91198f3）：
- features/telemetry/api.ts：TelemetryRange 增加 `today`，TelemetryParams 已支持 apps/channels/platforms/architectures string[]
- 新增 features/telemetry/components/filter-bar.tsx：TelemetryFilterBar 含 4 个 multi-select Popover（apps/channels/platforms/architectures，复用 useAppsListQuery / useChannelsQuery / usePlatformsQuery / useArchitecturesQuery）+ ToggleGroup 范围（today/week/month）+ totalActive 计数与 Clear（保留当前 range）
- StatisticsPage：useState 改为完整 TelemetryFilters；useTelemetryQuery 接入完整过滤；空数组转 undefined 避免无效查询参数；EmptyChart 占位逻辑保留；移除 PageHeader actions 内的旧 ToggleGroup
- en/zh telemetry.json 新增 `range.today` + `filter.{apps,channels,platforms,architectures,clear}`
- typecheck/lint（0 errors，warning 不增）/build/test 全绿
