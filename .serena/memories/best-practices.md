# Serena Best Practices

> Compiled from official docs: https://oraios.github.io/serena/

## 1. Token-Efficient Code Reading (核心原则)

**永远不要先读整个文件。** 应该逐步获取信息：

```
get_symbols_overview → 了解文件结构
find_symbol (include_body=False, depth=1) → 了解类/模块的成员
find_symbol (include_body=True) → 仅读需要的符号体
find_referencing_symbols → 理解符号间的引用关系
```

### 什么时候可以读整个文件
- 非代码文件（配置、文档）
- 不知道符号名称时
- 文件很小（<50 行）

### 什么时候不应该读整个文件
- 已经通过符号工具获取了信息
- 只需要修改一个方法/函数
- 大文件（>200 行）中只需要局部信息

## 2. 符号编辑 vs 文件编辑

| 场景 | 方法 |
|------|------|
| 替换整个方法/函数/类 | `replace_symbol_body` |
| 在文件末尾添加代码 | `insert_after_symbol`（最后一个顶层符号） |
| 在文件开头添加代码 | `insert_before_symbol`（第一个顶层符号） |
| 只修改几行代码 | Claude Code 的 Edit 工具更合适 |
| 重命名变量/函数 | `rename_symbol`（跨文件重构） |

## 3. 搜索策略

```
已知符号名 → find_symbol（支持子串匹配）
不确定名称 → search_for_pattern（正则搜索）
查找文件 → find_file
目录浏览 → list_dir
引用关系 → find_referencing_symbols
```

## 4. Memory 管理

### 组织原则
- 用 `/` 分层命名（如 `auth/login/logic`）
- 项目记忆存于 `.serena/memories/`
- 全局记忆用 `global/` 前缀
- 可通过 `read_only_memory_patterns` 保护全局记忆

### 内容原则
- **存**：项目特有的经验、发现的陷阱、调试技巧
- **不存**：CLAUDE.md 已有的信息、显而易见的事实
- 建议用 git 管理全局记忆的变更历史

### 上下文耗尽时
- 让 agent 将进展保存为 memory
- 开新会话，从 memory 恢复上下文
- 避免自动压缩导致的上下文退化

## 5. Claude Code 集成要点

### context 设置
- 使用 `--context claude-code` 避免工具重复
- 此 context 会禁用与 Claude Code 原生功能重复的工具
- `--project-from-cwd` 自动从当前目录检测项目

### 工具优先级
1. 符号操作 → Serena 工具（更精准、省 token）
2. 简单行编辑 → Claude Code Edit 工具
3. 文件创建/完整重写 → Claude Code Write 工具
4. 搜索 → 先试 Serena `find_symbol`，再用 Claude Code Grep

## 6. 项目配置

### project.yml 关键设置
- `languages`: 语言顺序决定优先级，第一个语言是默认
- `read_only: true`: 只分析不修改时使用
- `ignored_paths`: 排除不需要索引的目录
- `symbol_info_budget`: LSP 响应慢时降低此值

### project.local.yml
- 本地覆盖配置，不提交到版本控制
- 与 project.yml 同目录

## 7. Cache 和索引

- `serena project index` 预缓存符号信息
- Cache 存储在 `.serena/cache/<language>/`
- 使用 git worktree 时，复制 `.serena/cache/` 避免重复索引
- Cache 由 LSP 语言服务器生成，纯 YAML 等简单语言可能不产生缓存

## 8. 模式（Modes）

| 模式 | 用途 |
|------|------|
| `interactive` | 交互式，会询问用户（默认） |
| `editing` | 代码修改（默认） |
| `planning` | 分析和规划，不立即修改 |
| `one-shot` | 单次响应完成任务 |
| `no-onboarding` | 跳过首次引导 |
| `query-projects` | 允许读取其他项目 |

## 9. 调试和监控

- Dashboard: `http://localhost:24282/dashboard/`
- 日志: `~/.serena/logs/`
- LSP 通信追踪: `trace_lsp_communication: true`
- 工具超时: `tool_timeout` 默认 240 秒
