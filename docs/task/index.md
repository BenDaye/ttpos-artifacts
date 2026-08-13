# 任务索引

| 标记 | ID | 标题 | 优先级 | 状态 |
|------|-----|------|--------|------|
| [x] | BEN-46 | Fork FaynoSync 并重构为 Monorepo | P1 | completed |
| [x] | SEC-001 | 凭证安全加固 | P0 | completed |
| [x] | SEC-002 | 修复运行时崩溃 bug | P0 | completed |
| [x] | SEC-003 | 认证安全增强 | P0 | completed |
| [x] | SEC-004 | 请求安全限制 | P1 | completed |
| [x] | SEC-005 | HTTP 与前端安全加固 | P1 | completed |
| [x] | SEC-006 | CI/CD 安全加固 | P1 | completed |
| [x] | QUAL-001 | Dashboard 代码质量改善 | P2 | completed |
| [x] | PERF-001 | Server 性能优化 | P2 | completed |
| [x] | PERF-002 | Dashboard 性能优化 | P2 | completed |
| [x] | FEAT-001 | 新增 latest 路径式下载入口 | P2 | completed |
| [x] | REFACTOR-001 | 按 pma-web 规范重构 Dashboard | P1 | completed |
| [x] | REFACTOR-002 | Dashboard 业务逻辑补完 | P1 | completed |
| [x] | ENH-001 | 版本卡片增加快速添加构建产物入口 | P2 | completed |
| [x] | REFACTOR-003 | 修复 Dashboard Next 生产替换阻断项 | P1 | completed |
| [x] | REFACTOR-004 | 收敛 Dashboard Next 设计令牌 | P1 | completed |
| [x] | BUG-001 | 修复 Dashboard Next 响应式布局溢出 | P1 | completed |
| [x] | BUG-002 | 优化 Dashboard Next 窄屏交互细节 | P1 | completed |
| [x] | BUG-003 | 修复 Dashboard Next 响应式视觉回归 | P1 | completed |
| [x] | BUG-004 | 收敛 Dashboard Next 版本卡片网格密度 | P1 | completed |
| [x] | BUG-005 | 重设 Dashboard Next 版本卡片视觉层级 | P1 | completed |
| [x] | BUG-006 | 修正 Dashboard Next 版本卡片与 Add artifact 细节 | P1 | completed |
| [x] | BUG-007 | 修正 Dashboard Next 版本状态与选择器视觉回归 | P1 | completed |
| [x] | QUAL-002 | 收敛 Permission Matrix 类型强转 | P2 | completed |
| [x] | BUG-008 | Upload version 对话框选择器与文件输入回归 | P1 | completed |
| [x] | BUG-009 | Select popup 与 trigger 视觉脱节、Flag 行溢出 dialog | P1 | completed |
| [x] | BUG-010 | Upload version 不应允许编辑 App name；移除孤悬的全局上传入口 | P1 | completed |
| [x] | QUAL-003 | Dashboard UI 文案 brand-neutral 收敛（去 ttpos-pos 占位） | P2 | completed |
| [x] | BUG-011 | 移除 New app 表单残留的 Enable TUF metadata 入口 | P1 | completed |
| [x] | BUG-012 | 完善 latest 路径式下载入口投产缺口 | P1 | completed |
| [x] | ENH-002 | latest 路径支持 snake app identifier | P1 | completed |
| [x] | ENH-003 | 新增默认 prod 的公开 latest 下载入口 | P1 | completed |
| [x] | ENH-004 | 公开 latest 下载入口按平台固化 artifact 默认值 | P1 | completed |
| [x] | ENH-005 | 移除未投产的 /latest 路由 | P1 | completed |
| [x] | ENH-006 | 收敛公开 latest 下载为单一路由 | P1 | completed |
| [x] | ENH-007 | 新增极简 latest 下载短链 | P1 | completed |
| [x] | ENH-008 | 将 latest 短链改为资源型直达 302 | P1 | completed |
| [x] | BUG-013 | 修复 Dashboard Next App board 双层纵向滚动 | P1 | completed |
| [x] | ENH-009 | Dashboard Next App board version 快速详情弹层 | P1 | completed |
| [x] | BUG-014 | 修复 Dashboard Next 移动端工具栏控件堆积 | P1 | completed |
| [ ] | SEC-007 | 收紧 App/meta 的 Owner 与 Private 字段 API 响应暴露 | P2 | pending |
| [x] | REFACTOR-005 | 将 /dl 短链硬编码目录提取为配置驱动的 shortlink 包 | P2 | completed |
| [x] | ENH-010 | 为元数据模型引入持久化 Sort 排序与 Dashboard 拖拽 | P2 | completed |
| [x] | ENH-011 | version 列表同版本号内按 channel 持久化 Sort 二级排序 | P2 | completed |
| [x] | ENH-015 | 把服务封装成只读 MCP server（外置 TS 包装器 @ttpos/mcp） | P2 | completed |
| [x] | ENH-016 | MCP server 增加 Streamable HTTP(SSE)双模并补部署交付物 | P2 | completed |
| [ ] | ENH-017 | CI 改用 turbo --affected 替代手写 paths 过滤 | P3 | pending |
| [ ] | ENH-018 | Docker 构建改用 turbo prune 剪枝上下文 | P3 | pending |
| [x] | ENH-019 | 给 Caddy splice 脚本补漂移门（--check） | P1 | completed |
| [x] | BUG-015 | 修复 FaynoSync CI 重传覆盖失败 | P1 | completed |
| [x] | BUG-016 | 删光构建物后版本显示 Unknown platform/architecture | P2 | completed |
| [x] | BUG-017 | /dl 短链在部分平台发版时对缺失平台 404 | P1 | deployed |
| [x] | REFACTOR-006 | owner 收敛为部署单例（single-owner mode） | P1 | deployed |
| [x] | REFACTOR-007 | 将 /dl 短链入口迁到 Caddy | P1 | completed |
| [x] | REFACTOR-008 | server 单租户焊死（single-owner lockdown） | P1 | completed |
| [x] | REFACTOR-009 | 仓库顶层 monorepo 化（top-level monorepo migration） | P1 | completed |
| [x] | REFACTOR-010 | Caddy 与 app 项目解耦（仓库归位） | P2 | completed |
| [x] | REFACTOR-011 | prod 主机 Caddy 独立化迁移 | P1 | completed |
| [x] | REFACTOR-012 | prod 镜像解冻（faynosync-* → ttpos-*） | P1 | completed |
| [ ] | QUAL-004 | 修复 rotted 集成套件并重塑单 owner 测试 | P2 | pending |
| [x] | BUG-018 | 修正测试构建应用端卡片与名称 | P1 | completed |
| [x] | BUG-019 | Fix Upload version form rhythm | P1 | completed |
| [x] | BUG-020 | 收敛版本详情弹层视觉层级 | P1 | completed |
| [x] | BUG-021 | 构建测试包入口迁移到 Applications | P1 | completed |
| [x] | BUG-022 | Keep build status across private routes | P1 | completed |
| [x] | ENH-020 | 短链数据化：新增 app 后短链自动可用 | P1 | implemented |
