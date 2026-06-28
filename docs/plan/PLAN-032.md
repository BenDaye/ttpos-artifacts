# PLAN-032 owner 收敛为部署单例（single-owner mode）

- **status**: implemented（branch `refactor/single-owner-mode`，go build/vet/包测试通过 + 双 reviewer APPROVE；待合并与按时序部署）
- **createdAt**: 2026-06-28
- **relatedTask**: REFACTOR-006

## 触发问题

`/dl` 短链查询用短链 config 里写死的 `owner` 拼 latest query。一旦 artifact 由「非该 owner 的凭据」上传（如另一个 admin 账号或其拥有的 API token），数据落在另一个 owner 命名空间，短链 404。

但调查发现这只是症状：`owner=ttpos` 是**系统级假设**（短链 + CMS 同步 workflow `owner=ttpos` + dashboard 列表 + `/checkVersion` 自动更新都依赖它），且「谁是 owner」这件事散落在至少十余处、各算各的，语义还不一致。本计划不打补丁，从源头把 owner 收敛成单一抽象。

用户已确认：本部署在产品意义上是**单 owner**（canonical admin 之外的人都应是其 team 成员）。

## 现状：owner 来源散落且不一致

| 位置 | 当前如何决定 owner | 语义 |
|------|--------------------|------|
| `server/mongod/seed.go::resolveOwner` | 显式 `SEED_OWNER` 须存在 / 否则自动选唯一 admin / 否则中止 | 启动 |
| `server/server/handler/create/upload.go` UploadApp(~126) 与覆盖/check 路径(~376) | `username` → `team_users.Owner` | team-aware |
| `server/server/handler/create/create.go::CreateItem`(~25) | `owner = GetUsernameFromContext` | **不解析 team** |
| `server/server/handler/catalog/list.go`(×4) / `catalog/get.go`(×2) | `owner = GetUsernameFromContext` | **不解析 team**（team_user 看到自己空名下，潜在 bug） |
| `server/server/handler/info/telemetry.go`(~151) | `username` → `teamUser.Owner` | team-aware |
| `server/server/handler/info/latest.go`(~262) checkVersion/latest | `c.Query("owner")` | 信任客户端传入 |
| `server/server/handler/handler.go` ShortLatestDownload(~325) | `ch.shortLatest.Owner`（JSON 配置字符串） | 第三份事实 |
| `.github/workflows/publish-cms-update.yaml` | 硬编码 `owner=ttpos` | 第四份事实 |
| `server/server/utils/auth.go`(~101) | API token → `username = apiToken.Owner` | 鉴权侧 |

根因：FaynoSync 的 `owner` 同时承担「身份/权限」与「命名空间」两件事。多租户里说得通；本部署只有一个命名空间，于是"命名空间"本该是常量却被当成"逐请求从身份推导"的变量，到处推、推不一致——这才是短链 404、seed 污染（`8d72131` 的 `owner=manager` 事故）、以及上一版护栏会引入的"超管非 canonical 即永久 403"死锁的共同根因。

关键文件：

- `server/server/handler/create/upload.go`、`create.go`
- `server/server/handler/catalog/list.go`、`get.go`
- `server/server/handler/info/latest.go`、`telemetry.go`
- `server/server/handler/handler.go`、`server/server/handler/shortlink/config.go`
- `server/mongod/seed.go`、`server/server/server.go`
- `.github/workflows/publish-cms-update.yaml`

## 方案：owner 收敛为「部署单例」，身份只管权限

### 1. 唯一抽象：新增 `ownership` 包

全仓库关于 owner 只保留两个出口，其余各处推导一律删除/改写：

- **`ownership.ResolveOwner(c, db) (owner string, err error)`** —— 所有**带请求上下文**的 handler 唯一调用：
  - 单 owner 模式开 → 返回部署单例（调用者身份不再决定命名空间）。
  - 模式关 → 回退到**正确的 team-aware 解析**（`username → teamUser.Owner`）。该回退顺便把 create/catalog 那批「不解析 team」的不一致统一修正。
- **`ownership.DeploymentOwner() string` / `ownership.Enabled() bool`** —— 给**无请求上下文**处读取（seed、短链注入、公开读覆盖）。

### 2. 解析与配置（启动一次、可校验、构造上不可 brick）

- 新增 env `DEPLOYMENT_OWNER`，统一并取代 `SEED_OWNER`（只配旧的→兼容读取并打印弃用提示；两者都配且不等→`logrus.Fatalf`）。
- `StartServer` 启动时解析一次：
  - 显式设了 → **必须存在于 `admins` 集合**，否则 `logrus.Fatalf`（开机响亮失败，绝不静默 403 一辈子）。
  - 未设 → 模式**关**，回退现有多租户行为。
- **死锁在构造上不可能**：配错只让服务起不来并说明原因；且单 owner 模式下写入不再从身份取 owner，任何被授权的 admin 都能写进唯一命名空间，不存在按用户锁死。

### 3. 消费方改写（十余处塌成一次调用）

| 现状 | 改为 |
|------|------|
| upload×2 / create / catalog list×4 / catalog get×2 / telemetry | 一律 `ownership.ResolveOwner(c, db)` |
| info 公开 `latest`/`checkVersion`（`c.Query("owner")`）、squirrel 的 path owner | 模式开时用 `DeploymentOwner()` 覆盖入参（在 cache key 计算前覆盖）；模式关保留原入参 |
| ShortLatestDownload（`catalog.Owner`） | 读 `DeploymentOwner()` 注入 |
| `seed.go::resolveOwner` | 删除自有逻辑，改读 `ownership` 解析 |

### 4. 短链与 CMS 简化（保留回退、不硬删）

- **实现取舍**：`shortlink/config.go` 的 `owner` 字段**保持必填、不动**（避免破坏既有 `short-latest.json` 契约和 shortlink 包测试）；mode-on 时在 info 读层（`FetchLatestVersionOfApp`）用单例覆盖，catalog.Owner 自然被忽略；并在启动加一致性自检：`shortLatestCatalog.Owner != DEPLOYMENT_OWNER` → `logrus.Fatalf`，杜绝两者悄悄分叉。比"把字段改可选"更兼容。
- CMS workflow `owner=ttpos`：服务端读侧改单例后该参数失效，顺手清理（可选，不阻塞）。

### 5. 权限层不动，护栏概念消失

- `CheckPermission` 保持纯鉴权（admin / team_user / api_token + allowed_apps）。
- 第二个 admin 不再是"污染源"而是"同一命名空间的协管"——没有第二个命名空间可污染。上一版要加的"owner != canonical → 403"护栏整体不存在。

### 6. 历史数据（降级为可选清理）

- 模式开后新写入一律落单例 owner；读侧只看单例 → 落在别 owner 下的旧数据自动隐身。
- re-own 从"正确性必需"降为"清理死重"：一次性把 orphaned 其它 owner 的 `apps`/`apps_meta` 折叠进单例 owner 或删除，先 dry-run、vm-node02 先行，不阻塞主改动。冲突（撞 `unique_app_version_channel_owner` / `apps_meta` 唯一索引）按"单例为准、删孤儿"处理。

## 兼容旧版（核心保证）

总开关 = `DEPLOYMENT_OWNER`：**不设 = 100% 旧行为**；所谓"删除"全部改写为"可选 + 单例优先 + 旧值回退"，无任何硬删。

| 兼容面 | 模式关（不设） | 模式开 | 破坏? |
|--------|----------------|--------|-------|
| 上游多租户 / ~150 既有测试 | 逐字不变（`ResolveOwner` 回退原解析） | owner=单例 | 否 |
| 短链 `catalog.owner` 字段 | 字段保留可读（回退） | 字段保持必填、info 层用单例覆盖、启动校验须与单例一致 | 否 |
| `SEED_OWNER` | 照旧读取 | 与 `DEPLOYMENT_OWNER` 统一 | 否（保留 + 弃用提示） |
| 公开读 `/checkVersion`、`/apps/latest`、squirrel owner 入参 | 照旧用 query/path | 单例覆盖入参 | 否 |
| 在野客户端 / 网站直链 / CMS（皆传 `owner=ttpos`） | 不变 | 覆盖成单例=ttpos → 结果比特级相同 | 否 |
| CI 上传 token | owner=token 的 owner | 落单例；ttpos token 结果相同，非 ttpos token 自动归并到 ttpos（修了旧 bug，无 403） | 否 |
| 已有数据 | 不变 | 单例下数据照常；别 owner 旧数据隐身，可选折叠 | 否 |

**模式关下零行为变化（实现已做到）**：原设计设想把 create/catalog 统一到 team-aware（会构成 legacy 路径一处行为变化）。实际实现改用 `ownership.OwnerOrUsername`——mode-off 时**逐字返回 username**，与各处原 `utils.GetUsernameFromContext(c)` 完全等价，因此模式关下 catalog/create/update/delete/reorder **零变化**；upload/telemetry 用 `ResolveOwner`，其 mode-off 又恰好等于它们原本就是的 team-aware 块。故 mode-off 全链路 byte-for-byte 不变。team_user 列表看不到 app 的潜在 bug 只在 **mode-on** 下随单例修复，不触碰 legacy 语义。（code-review dimension-1 已逐点核对为等价。）

**翻开关安全可回滚**：`DEPLOYMENT_OWNER=<实际超管>` 部署后，ttpos→ttpos 一切相同、写入归并、读取一致；回滚只需清空 env 重启即回 legacy，翻开关本身不需要先做数据迁移。

## Bootstrap 与部署时序

1. 全新库：先**不设** `DEPLOYMENT_OWNER`（模式关）启动 → `/signup` 注册超管（任意名）。
2. 设 `DEPLOYMENT_OWNER=<该名>` 重启（校验 ∈ admins）→ 模式开。
3. 已有部署：确认实际超管名（直连 vm-node02 / 生产 mongo 查 `admins`；CMS 硬编码 `owner=ttpos` 强烈暗示生产超管即 `ttpos`）→ 设为它 → 可选跑数据折叠。

## 测试与验证

- 模式关 = 当前行为逐字保留，`go test ./...`（本机 go1.25.5，非 TUF/非根集成）应全绿。
- 新增：`ResolveOwner` 两模式单测；`DEPLOYMENT_OWNER` 非 admin → fatal、与 `SEED_OWNER`/短链 owner 冲突 → fatal；短链 owner 字段缺省下模式开的解析测试；公开读 owner 覆盖测试。
- vm-node02 端到端：设单例后 `/dl` 命中；用非单例身份上传后数据落单例、dashboard/CMS/自动更新一致。

## 风险

- 改动面广（owner 散落十余处），机械替换易漏点；以 `ownership` 两出口为唯一入口，逐文件核对调用点。
- 公开读"覆盖"语义改变了"服务端是否信任客户端 owner"，须确认在野客户端实际都传 ttpos（与单例相等则无感）。
- 模式关下 create/catalog 的 team-aware 行为变化须在 release note 注明。
- 数据折叠涉及唯一索引冲突，必须 dry-run 先行、人工确认、vm-node02 先验。
- 不动 TUF；不碰短链已发布 URL 字节契约（`/dl/cashier.apk` 等）；新代码不硬编码 `ttpos`，全配置驱动（亦符合 brand-neutral）。

## 工作量

中等偏上。新增 `ownership` 包 + 启动解析/校验；改写 server 约 8-10 个文件的 owner 取值点；短链 config 字段可选化；seed 接入；新增聚焦测试。数据折叠与 CMS workflow 清理为可选后续。

## 备选方案

1. **只让 `/dl` owner-agnostic fallback**：最小改动，仅治短链 404 症状；CMS/dashboard/自动更新对错 owner 的 app 仍失效。已否决。
2. **上传端 fail-closed 护栏 + canonical 校验**（本计划前身）：能保证单 owner，但在 owner 逻辑上再堆一层判断、且"超管非 canonical 即永久 403"有死锁风险。已被本方案取代——单例模式下护栏概念自然消失。
3. **单一 `ResolveOwner` 解析模块但保留"owner=你的命名空间"模型**：消除重复但不解耦身份与命名空间，仍需护栏。作为分阶段的第一步可行，但用户选择一步到位的单例。

## 批注

- 2026-06-28：经 superpowers brainstorming 三轮收敛——单 owner 语义确认 → 修复范围确认（保证整个部署单 owner）→ 用户指出"owner 逻辑散落、不应各维护一份"，遂从"上传端护栏"升级为"owner 收敛为部署单例"。兼容策略以 `DEPLOYMENT_OWNER` 总开关 + 旧值回退保证模式关零行为变化。
- 2026-06-28：prod 实测（只读直查 mongo）：admin **仅 1 个 = `ttpos`**；team_user 3 个（tester/developer/manager）owner 全是 `ttpos`；`apps` 261 条、`apps_meta` 16 条 `distinct(owner)` 均为 `["ttpos"]`，**零 orphan**。结论：原短链 bug 在 prod 仅"潜伏"（要建第二个 admin 才触发）；数据折叠 prod 不需要；风险 1/2/5 因"只有一个 owner、零 orphan"基本落空。
- 2026-06-28：实现完成（autopilot Phase 2-4）。新增 `server/server/ownership` 包（`Configure`/`Enabled`/`DeploymentOwner` + `OwnerOrUsername`/`ResolveOwner` 两出口）；收敛 catalog/create/upload×2/delete/update/reorder/telemetry + info 两个公开读共 11 处站点；server.go 启动解析+校验 `DEPLOYMENT_OWNER`（须 ∈ admins，与 SEED_OWNER/短链 owner 一致，否则 Fatalf）。`go build ./...`、`go vet ./...` exit 0；除根 E2E 包（缺 .env/mongo 的环境性 panic，非本改动）外所有包测试通过；ownership 包单测通过。
- 2026-06-28：两独立 reviewer（security + code）均 **APPROVE**，0 Critical/0 High。已采纳修复：`DEPLOYMENT_OWNER` 校验区分 `mongo.ErrNoDocuments`（指引 bootstrap 顺序）与连接错误；telemetry 的 owner debug 日志补回。bootstrap footgun（首启前误设 → Fatalf）保持 fail-loud（不静默退 mode-off），符合项目纪律。
- 2026-06-28：遗留 follow-up（非本次范围，见 REFACTOR-006）：`token/*` 的 owner-scope 仍按 caller username 取（既有问题、不回归本次审计路径；prod 下 admin 即 `ttpos`=`DEPLOYMENT_OWNER` 故 token 创建/列举/删除工作正常）；上游依赖 CVE backlog 独立处理。
