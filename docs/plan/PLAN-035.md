# PLAN-035 单租户焊死 + 清尸（single-owner lockdown）

- **status**: deployed（已合并 main via PR #27(merge `7f8a8e8`)；核心 gate + Opus 评审 + staging E2E 验证通过；集成套件重塑转 QUAL-004）
- **task**: REFACTOR-008
- **createdAt**: 2026-07-03
- **mode**: DELIBERATE（auth/RBAC/安全边界改动，高风险）
- **决策方式**: ralplan 共识（Planner → analyst → Architect → Critic，Critic 裁决 ITERATE 后按门禁清单收敛为本稿）
- **关联**: 承接 PLAN-032（single-owner mode 已部署）/ REFACTOR-006；闭合 PLAN-034 SECURITY-04；顺带闭合 PLAN-034 BEST-PRACTICE-01（server CI 无 go test）

## 背景与决策

PLAN-032 已把 owner 收敛为「部署单例」：配 `DEPLOYMENT_OWNER` 即 mode-on，prod + vm-node02 均已 `DEPLOYMENT_OWNER=ttpos` 部署验证。但当时为兼容上游、保守起见，**多租户 fallback（mode-off）被逐字保留**，`ownership` 包因此是双模式（`Enabled()` 开关 + 两套 owner 推导）。

用户已拍板：本部署在产品意义上**永远单 owner**，多租户能力不再需要。本计划把单租户从「默认模式」**焊死为唯一模式**，并删除已成死代码的多租户分支（清尸）。

**核心澄清（消除误解）**：本计划**不删 `owner` 字段、不改任何查询/索引/表结构、不迁数据**。每条 `$match{owner: <常量>}` 过滤逐字保留。删的只是「怎么算出 owner 这个值」里那条 prod 永不执行的多租户分支。prod 现在 `Enabled()` 恒为 true，早已只走「返回常量」这条路——故对 prod **行为零变化**，代码回退即可无损回滚。

### 已核实代码事实（三方独立复核一致）

- 启动 `server/server/server.go:46` 先 `ConnectToDatabase`（内含 migration，`mongod/adapter.go:33-34`，**不 early-return**）→ `:58-72` 读 `DEPLOYMENT_OWNER`：非空则校验 ∈ admins（`ErrNoDocuments`→Fatalf）+ SEED_OWNER 一致 → `ownership.Configure(...)`。**空 = 现状 legacy 多租户**。
- `server/server/ownership/ownership.go`：`state.enabled` 门控；`OwnerOrUsername`（**13** 个调用点：catalog/create/update/delete/reorder）与 `ResolveOwner(c, database)`（**3** 个：`telemetry.go:137`、`upload.go:124`、`upload.go:374`）。坍缩（enabled 恒 true）后二者**逐字相同**：都 `return state.owner`，都不碰 `c`/`database`。`Enabled()`/`DeploymentOwner()` 仅被 `latest.go:144`、`:267` 消费（共 4 处引用）。
- `latest.go:144-146` 与 `:266-269`：两处 `if ownership.Enabled(){ owner = DeploymentOwner() }`——mode-off 分支正是 **SECURITY-04**（客户端传入 `?owner=` 被信任、无授权）。
- 数据层 `mongod/*` 保留 `$match{owner}`；内部另有一次 `team_users` 二级查找按 owner 键（`check.go:60`、`list.go:23`、`delete.go:171`）。单 owner 下传入的是部署 admin（非 team_user）→ miss → 走默认分支，**benign，保留勿删**。
- token 消费链决定性证据 `utils/auth.go:101`：API token 被使用时 `c.Set("username", apiToken.Owner)`，该 username 进入 ownership 后**在单模式被覆盖成部署常量**。故 token owner 只是登录身份标签、**不主宰数据命名空间**——token/* 出范围可接受（详见「非目标」与 Open Question）。
- 测试 harness `faynoSync_test.go:110 setup()` **从不调用** `ownership.Configure()`，也不走 `StartServer`（`ownership.Configure` 的唯一调用点 `server.go:72`）→ **整套 155 测试当前跑 mode-off**（`Enabled()==false`）。第二 admin `administrator`（`:298`）是真 admin、非 team_user。
- `.github/workflows/build-server.yaml` 只 `docker build+push`，**无 go test/vet/golangci**。`server/.env.example`、`deploy/.env.example`、`deploy/docker-compose.yml`、`deploy/docker-compose.prod-caddy.yml` **均无 `DEPLOYMENT_OWNER`**。

## Principles（5）

1. **单 owner 是唯一真相**：owner 命名空间是部署级常量；调用者身份只管权限（RBAC），永不管命名空间；一条路径而非两条。
2. **启动时 fail-closed 而非逐请求**：配置错误的部署拒绝启动（Fatal），而非静默把数据 scope 到错/缺失 owner。爆炸半径 = 一个死 pod（可见可恢复），而非跨 owner 泄露（不可见不可逆）。
3. **保留查询过滤，退休分支**：每个 `$match{owner:const}` 逐字保留；只坍缩常量的推导。数据形状/索引/RBAC/owner 字段不动。
4. **删死路径而非注释**：删 mode-off 分支是安全收益（闭合 SECURITY-04）；留永真 `Enabled()` 是地雷不是安全网。
5. **测试断言新不变量**：靠「从没测过单模式」而变绿的测试不是证据；套件须真正在单模式下跑，且回退到 per-user 命名空间会响亮失败。

## Decision Drivers（top 3）

1. **安全正确性**：SECURITY-04 必须在代码层闭合，非仅靠 prod 配置。删 mode-off 是结构性修复。
2. **不可逆错误规避**：不可容忍的失败是数据落到/读自错误 owner。启动 fail-closed + 单一坍缩路径消除该类。
3. **既有 RBAC + 集成面回归安全**：~155 集成测试，其中 14 个 `WithSecondUser` 编码「双 admin 数据隔离」语义（本改动故意使其失效）；计划成败在于**逐例语义分类**正确，而非几行 handler 编辑。

## Viable Options

- **Option 1 仅守卫（保留 mode-off 代码）**：`DEPLOYMENT_OWNER` 必填，但留 `Enabled()`/双分支。最小 diff、零测试风险；但**不结构性闭合 SECURITY-04**（不可信 owner 代码仍在，一次配置/回归即复活，违反 Principle 4），留永久死分支与误导性双模式。裁定：作为 pre-mortem fallback，非终点。
- **Option 2 守卫 + 清尸（采纳）**：env 强制 + fail-closed；坍缩 owner 解析为单函数常量、删 `Enabled()` 与 mode-off 分支、`latest.go` 无条件化；重塑测试断言单 owner 不变量。结构性闭合 SECURITY-04；owner 字段/查询/索引/RBAC/token 不动，无迁移无数据风险。代价：使 14 个 `WithSecondUser` 隔离测试失效（须显式逐例处理）；回滚从「清 env 秒级」变「镜像/代码回退」。裁定：**采纳**，唯一满足全部 driver。
- **Option 3 彻底拔掉 owner 字段**：需 prod schema/index 迁移（违反 no-migration）、摧毁 `unique_app_version_channel_owner` 唯一性与 team_users owner-scoping、不可逆、零安全增益。裁定：**否决**。

**单存活理由**：Option 1 失安全 driver；Option 3 违 no-migration/keep-owner 约束且被 Option 2 支配。仅 Option 2 满足全部 driver 且尊重全部非目标。

## Pre-mortem（针对修订后范围重写）

**A — 全新库 / DR 重建撞上 bootstrap 死结**（最靠前）
`DEPLOYMENT_OWNER` 强制 + 必须 ∈ admins，但全新库 admins 空、`/signup` 又要服务先起。旧 Fatal 文案还写着「先不设它启动→signup→再设」，与强制矛盾。DR/重新 provision（admins 空）会永久无法启动。
- **缓解（已定：引导期豁免）**：`admins` 为空时**允许**空 `DEPLOYMENT_OWNER` 启动（bootstrap 模式，打 warn 日志），走 `/signup` 建首个 admin；**一旦 admins 非空，空 `DEPLOYMENT_OWNER` 即 Fatal**。此守卫在 `server.go`，不影响 ownership 包的干净坍缩（bootstrap 窗口 `ownership.Configure("")` → `Owner()` 返回 ""，此时无 owner-scoped 数据，无害）。同步重写 `server.go` Fatal 文案与 PLAN-032 bootstrap 文档。

**B — 某环境漏配 DEPLOYMENT_OWNER 启动即死**
非 prod/staging/dev/ephemeral 环境此前靠 mode-off 合法启动；焊死后（且 admins 非空）Fatal 崩溃重启。两个 `.env.example` + 两个 compose 均无该键，grep 不可见。
- **缓解**：两个 `.env.example` + 两个 compose 显式补 `DEPLOYMENT_OWNER=`（带 bootstrap 注释）；Fatal 文案对 unset 也可操作（命名变量 + 引导顺序）；合并前**人工核对每个部署环境 `.env` 均带该值**（CI/grep 无法证明，列为交付前 checklist）。

**C — 回滚不再是回滚**
prod 事故后 ops 按旧文档「清 env 重启」→ 焊死后清 env 反而 Fatal（若 admins 非空）。
- **缓解**：§回滚 重写 runbook（改镜像/代码回退），标注 PLAN-032「秒级 env」已被本计划取代；因零 schema/index/query/migration，代码回退安全无损；保持 `DEPLOYMENT_OWNER` 始终设置。

**次级 watch（记录不列 top3）**：token owner 与数据 owner 分叉（REFACTOR-006:30，焊死后永久固化不可回退，见非目标）；mongod 二级 team_users 查找单 owner 下 benign；team RBAC 读写一致性由未改动的 RBAC 套件 + prod e2e 覆盖。

## 扩展测试计划（unit / integration / e2e / observability）

### Unit — `server/server/ownership/ownership_test.go`（重写为单函数）
- 合并后单函数 `Owner()` 无论 context username 恒返回配置常量，**无 username 查找、无 db 访问**。
- **删除/改写**将无法编译的 legacy-mode 测试：`TestConfigureTogglesMode`、`TestResolveOwnerLegacyMissingUsername`、`TestOwnerOrUsername` 的 mode-off 分支、`TestResolveOwnerSingleOwnerSkipsDatabase`（`database` 参已去）。
- **验收**：`go test ./server/server/ownership/...` 绿；非测试代码 grep 无 `Enabled(`。

### Integration — `server/faynoSync_test.go`
- **`setup()` 显式 `ownership.Configure("admin")`**（仅设 env 无效——ownership 状态只由 Configure 写入）。
- **新增自证**：一个代表性 handler 测试断言 `ownership.Enabled()`/`Owner()==="admin"` 生效，证明 harness 真的在单模式跑（否则重塑可能 no-op 而假绿）。
- **14 个 `WithSecondUser` 逐例分类**（见下表，Step 0 逐个读 body 确认，默认改写不删）。
- **新增正向不变量**：`latest`/`FetchLatestVersionOfApp` 传 `?owner=GARBAGE` 被忽略、解析为部署 owner（handler 层锁死 SECURITY-04，回归即红）。
- **新增 token 锁定测试**：`token.Owner != DEPLOYMENT_OWNER` 的 token 仍读写部署命名空间（锁定 auth.go:101 覆盖链，防未来 refactor 让 token owner 泄回数据 scope）。
- **保留不动**：所有 `Test…TeamUser*` RBAC、不跨 owner 的 token 流（`TestTokenFlow0*`、`TestTokenMiddlewareFlowForBothTokens`）、`TestBUG015OverwriteUploadRequiresAppsEditPermission`（真 team_user 的 apps.edit）。

#### `WithSecondUser` 分类表（14 个，默认改写；Step 0 逐个读 body 定稿）

| 测试（行） | 现断言 | 语义 | 建议处置 |
|---|---|---|---|
| `TestListAppsWithSecondUser`(5766) | `{"apps":null}` | 双 admin 数据隔离 | **改写**：第二身份坍缩为部署 owner，应看到部署命名空间 |
| `TestListChannelsWithSecondUser`(5795) | `{"channels":null}` | 同上 | **改写** |
| `TestListPlatformsWithSecondUser`(5825) | `{"platforms":null}` | 同上 | **改写** |
| `TestListArchsWithSecondUser`(5855) | `{"archs":null}` | 同上 | **改写** |
| `TestUpdateSpecificAppWithSecondUser`(3385) | 500 无权限 | 双 admin 隔离（非 RBAC；第二方是 admin 非 team_user） | **改写/删**：确认非 RBAC 后，单 owner 下第二 admin 可操作共享命名空间 |
| `TestUpdateAppWithSecondUser`(5885) | 500 无权限 | 同上 | **改写/删** |
| `TestUpdateChannelWithSecondUser`(5947) | 500 无权限 | 同上 | **改写/删** |
| `TestUpdatePlatformWithSecondUser`(5994) | 500 无权限 | 同上 | **改写/删** |
| `TestUpdateArchWithSecondUser`(6044) | 500 无权限 | 同上 | **改写/删** |
| `TestMultipleDelete…WithSecondUser`(6091) | 500 无权限 | 同上 | **改写/删** |
| `TestDeleteNightlyChannelWithSecondUser`(6124) | 500 无权限 | 同上 | **改写/删** |
| `TestDeletePlatformWithSecondUser`(6154) | 500 无权限 | 同上 | **改写/删** |
| `TestDeleteArchWithSecondUser`(6184) | 500 无权限 | 同上 | **改写/删** |
| `TestDeleteAppMetaWithSecondUser`(6214) | 500 无权限 | 同上 + 删对象可能污染后续用例 | **改写/删**：注意连锁数据依赖 |

> **红线（Critic）**：不得整批「删红」。逐例读 body 确认「500 无权限」是 owner-隔离（失效、可改写/删）还是真 RBAC（team_user 权限、必须保绿）。误分类会把真实鉴权断言当「预期翻车」悄悄删掉。

### E2E（staging → vm-node02 → prod，仿 REFACTOR-006）
- **不配 DEPLOYMENT_OWNER 且 admins 非空** → 容器 `Restarting` + `level=fatal`（fail-closed 验证）。
- **全新库不配** → 允许启动（bootstrap 模式，warn 日志），`/signup` 可建首个 admin。
- **配 `DEPLOYMENT_OWNER=<admin>`** → `?owner=GARBAGE`/空 → 302/200 解析真 owner。
- **team_user 上传** → 落部署 owner；`/dl` 短链解析（原 bug 保持修复）。

### Observability
- unset-Fatal 输出可 grep 的 `level=fatal` 行、命名缺失变量 + bootstrap 顺序。
- telemetry `logStatsToRedis` 坍缩后仍按常量 owner 记数（键 `validatedParams["owner"]`）。

## 实现步骤（有序，验收 + 验证命令）

> 顺序：先 Step 0 摸清爆炸半径，再让套件保持不红地推进，安全关键编辑（`latest.go` 无条件化、`server.go` 守卫）落在坍缩包与守卫之后。

**Step 0 — 基线 + 枚举爆炸半径（不改生产码）**
`cd server && go build ./... && go vet ./... && go test ./...` 取绿基线。临时 patch 在 `setup()` 加 `ownership.Configure("admin")` 跑一次，捕获确切红名单，核对上表 14 个；还原临时 patch。
- **验收**：书面红名单 + 每个 `WithSecondUser` 的 body 语义判定（改写/保绿/删）。

**Step 1 — ownership 包坍缩 + 合并单函数**（`ownership.go` + 调用点）
合并 `OwnerOrUsername`/`ResolveOwner` 为**单个无参函数**（如 `Owner()`）恒返回 `state.owner`；删 `Enabled()`、mode-off 推导分支、`database` 参及随之无用的 `bson/mongo/model` import；更新包注释为单模式。改 16 个调用点（13+3）到新函数；`ResolveOwner` 的 3 处去 `database` 实参（`telemetry.go:137`、`upload.go:124/374`）。
- **验收**：grep 非测试代码无 `Enabled(`、无旧函数名；`go build ./... && go vet ./...` 绿。

**Step 2 — handler 无条件覆盖**（`latest.go:144-146`、`:266-269`）
两处 `if ownership.Enabled(){...}` 改无条件 `owner = ownership.Owner()`，结构性闭合 SECURITY-04。
- **验收**：客户端 `?owner=` 不再进查询；由 Step 4 的 `owner=GARBAGE` 用例判定。

**Step 3 — 启动守卫（引导期豁免）+ migration 早退**（`server.go:46-72`、`faynoSync.go` flag 接线）
1. migration/rollback 处理后 `os.Exit(0)` **早退**，在 owner 校验/端口绑定之前——全新库只跑 migration 不再「迁一半再崩」。
2. owner 守卫改为：`DEPLOYMENT_OWNER` 空且 `admins` 非空 → **Fatal**（文案含变量名 + bootstrap 顺序）；空且 `admins` 空 → **允许启动**（warn，bootstrap 模式）；非空 → 保留现有 ∈admins + SEED_OWNER 一致校验。**这是全计划最高风险的一行**（今日空值静默走 legacy，改错即从后门重开 mode-off）——须 reviewed。
- **验收**：`DEPLOYMENT_OWNER=`（空）+ 非空 admins 启动即非零退出并打 fatal；空库空值可启动并能 `/signup`；`-migration` 对全新库仅迁移后退出 0。
- **验证**：`cd server && go build -o /tmp/faynoSync . && DEPLOYMENT_OWNER= /tmp/faynoSync`（非空库预期 fatal）。

**Step 4 — 测试重塑**（`ownership_test.go` + `faynoSync_test.go`）
按 Step 0 判定逐例改写/删（reviewed 注释 diff）；`setup()` 加 `ownership.Configure("admin")` + 单模式自证断言；加 `owner=GARBAGE` 正向用例与 token 锁定用例；team RBAC 与不跨 owner token 测试不动。
- **验收**：`go test ./...` 全绿；每个删/改断言有一行理由；新负向用例在 SECURITY-04 回归时会红。

**Step 5 — 文档 + env + 部署面 + CI**
1. 本文件（决策记录），入 `docs/plan/index.md`；PLAN-034 一并补入索引。
2. `server/.env.example` + `deploy/.env.example` + `deploy/docker-compose.yml` + `deploy/docker-compose.prod-caddy.yml` 补 `DEPLOYMENT_OWNER=`（带 bootstrap 注释）。
3. `SEED_OWNER` 处置：**保留 + 弃用提示**（server.go:68-69 一致性 Fatal 保留；tandem 打 deprecation warn，指向 DEPLOYMENT_OWNER），兑现 PLAN-032:53/91 半截承诺。
4. **CI（本次一并加）**：`.github/workflows/build-server.yaml` 加 `go test ./... && go vet ./...`（+ 可选 golangci-lint）作为 build job 的 `needs` 前置，闭合 PLAN-034 BEST-PRACTICE-01。
5. AGENTS.md「关键边界」按需补一句「server 为单 owner，多租户已移除」。
6. 更新 PLAN-032/REFACTOR-006 交叉引用：标注「秒级 env 回滚」已被本计划取代。
- **验收**：`git diff --check` 干净；照 `.env.example` 起的新环境不崩；CI 出现 test job。

**全量门（交付前）**：`cd server && go build ./... && go vet ./... && go test ./...` 全绿 + staging fail-closed 启动检查 + 逐环境 `.env` 带 `DEPLOYMENT_OWNER` 的人工 checklist。

## 回滚

- **代码回滚 = revert 本计划 commit / 重部署旧镜像**。焊死后**清 `DEPLOYMENT_OWNER` 不再是回滚**（admins 非空时会 Fatal）；PLAN-032「秒级 env」退休，须在文档标注。
- **数据安全**：零 schema/index/query/migration，`owner` 字段/值/唯一键不动；代码回退即恢复旧二进制行为，无需数据对账。prod/vm-node02 已 mode-on 零 orphan，revert 落在已知良态数据集。
- **runbook**：(1) 重部署上一个镜像或 `git revert` 重建；(2) 全程保持 `DEPLOYMENT_OWNER` 已设；(3) 验 `/dl` + `latest` 解析；(4) 无数据步骤。

## 非目标

不删 `owner` 字段、不改 `mongod/*` 的 `$match{owner}` 与其内部 team_users 二级查找、不动索引；不动团队 RBAC（`login.go`、`team/*`、`upload.go:422`）；**不碰 `token/*` 路径**——token owner 按登录名取，正确性依赖 `admin username == DEPLOYMENT_OWNER`（REFACTOR-006:30 记录的既有分叉，焊死后固化不可回退，本计划仅**记录**不修，见 Open Question）；不改客户端契约；无数据迁移。

## Open Questions（须用户在执行前确认或接受）

- [x] **Bootstrap 策略** → 已定：**引导期豁免**（admins 空允许空 owner 启动，非空则必填 Fatal）。
- [x] **CI go test 范围** → 已定：**本次一并加** `go test ./...` 到 build-server.yaml。
- [ ] **token owner 分叉是否本次一并收敛？** 默认**否**（仅记录为已知边界，依赖 admin==DEPLOYMENT_OWNER）。若你要求本次收敛，范围与风险另评（可另立任务）。
- [ ] **`WithSecondUser` 的 Update/Delete 类 9 个用例最终是改写还是删？** 计划默认逐例改写；Step 0 读 body 后如判定为纯多-admin 隔离（产品模型已不支持"第二 admin"，应是 team member），可删。定稿在 Step 0 的 reviewed diff。
- [ ] **逐部署环境 `.env` 带 `DEPLOYMENT_OWNER` 的人工核对**：CI/grep 无法证明，须交付前人工 checklist 确认（尤其 prod admin 用户名确为 `ttpos`）。

## ADR

- **Decision**：采纳 Option 2。`DEPLOYMENT_OWNER` 强制（引导期豁免 fail-closed）、合并 owner 解析为单个无参常量函数并删 mode-off 分支与 `Enabled()`、`latest.go` 无条件权威、按语义逐例重塑测试、补部署 env 与 CI go-test 门。保留 `owner` 字段、全部 `$match{owner}`、索引、team RBAC、token/* 路径；无数据迁移。
- **Drivers**：安全正确性（代码层闭合 SECURITY-04）；规避不可逆的错误-owner 数据类；保护 RBAC + 集成正确性。
- **Alternatives considered**：Option 1 仅守卫——关掉运维暴露但留不可信 owner 代码，失安全 driver，仅作 fallback；Option 3 拔 owner 字段——需违规迁移、破坏唯一性/RBAC、不可逆、被支配。
- **Why chosen**：仅 Option 2 满足全部 driver 且尊重全部非目标。「为何现在焊死而非留惰性 fallback」：一个 prod-不可达但仍被编译、仍是守卫被绕过时的默认、且仍是唯一被测试套件背书的分支，是带绿灯背书的潜伏漏洞——一次 `Enabled()` refactor / 测试配置泄漏 / `getenv` 笔误即重新武装 SECURITY-04。正确重塑的测试可挽回多租户可-再泛化的大部分覆盖损失，而这是用户已决定支付的产品-范围成本。
- **Consequences**：(+) 单路径、SECURITY-04 代码层闭合、无数据风险、CI 有回归兜底。(−) 使 14 个隔离测试失效须逐例重塑（本次重心）；回滚改为镜像/代码回退；每个非 prod 环境合并前须带 env；token owner 分叉固化（已记录）。
- **Follow-ups**：token owner 收敛（可选，另立）；逐环境 env checklist；`WithSecondUser` Update/Delete 定稿于 Step 0。

## 实现记录（2026-07-03，分支 refactor/plan-035-single-owner-lockdown）

**环境约束**：实现沙箱无 go/mongo/docker（临时下载 Go 1.25.5 做验证）。可验证：`go build ./...`、`go vet ./...`（含全部测试文件编译）、`ownership` + `utils` 单测——**均全绿**。**不可验证（交 mongo 环境跑）**：集成套件 `faynoSync_test.go`（需 Mongo/Redis/S3）。

**已实现并本地验证**：
- Step 1：`ownership` 包坍缩为单函数 `Owner() string`（无参、无 error、无 db），删 `Enabled()`/`DeploymentOwner()`/`OwnerOrUsername`/`ResolveOwner` 与全部多租户分支及 `gin`/`utils`/`bson`/`mongo`/`model` import；16 个调用点改 `ownership.Owner()`（删掉随之而来的死 error 分支）。`grep` 确认非测试代码零残留旧 API。
- Step 2：`latest.go` 两处 `if ownership.Enabled()` 改无条件 `ownership.Owner()`，客户端 `?owner=` 不再进查询——SECURITY-04 代码层闭合。
- Step 3：`server.go` 引导期豁免守卫（空 owner + admins 非空→Fatal；空 owner + admins 空→warn 放行；非空→∈admins + SEED_OWNER 校验）；SEED_OWNER 加弃用提示。
- Step 4a：`ownership_test.go` 重写为单模式，**通过**。
- Step 4b（部分）：`setup()` 加 `ownership.Configure("admin")` 使套件跑 shipped 路径（编译通过）。
- Step 5：`server/.env.example` + `deploy/.env.example` 补 `DEPLOYMENT_OWNER`；`build-server.yaml` 加 test job（`go build`/`vet`/无依赖单测，`build` 依赖它）；AGENTS.md 关键边界补单 owner 说明。

**重大偏差（推翻计划一项，避免炸 prod）**：
- 计划 Step 3 原含「migration/rollback 后 `os.Exit(0)` 早退」。**已撤销**——`server/Dockerfile:19` 是 `CMD ["faynoSync", "--migration"]`，即 prod 靠 `--migration` 启动、迁移后**继续 serve**（migrate-then-serve）。加早退会让 prod 迁移完即退出、服务永不启动。analyst「migration 是独立预备步骤」的假设对本部署不成立。且引导期豁免已解决全新库 migration 被拦问题（admins 空即放行），故早退**既不必要又有害**，删除。

**待 mongo 环境完成（Step 4b 剩余）**：
- 跑 `go test ./...` 捕获 14 个 `Test*WithSecondUser` 红名单；逐个读 body 定「删/改写」（它们断言的是跨-admin owner 隔离，单 owner 下已不成立，且第二方是 admin 非 team_user，非 RBAC；默认可删，但须逐个确认非真实 RBAC 断言）。
- 新增正向用例：`latest`/`FetchLatestVersionOfApp` 传 `?owner=GARBAGE` 被忽略、解析为部署 owner（锁死 SECURITY-04）。
- 新增 token 锁定用例：`token.Owner != DEPLOYMENT_OWNER` 仍读写部署命名空间。
- 全量 `go build/vet/test` 全绿 + staging fail-closed 启动检查 + 逐环境 `.env` 带 `DEPLOYMENT_OWNER` 人工核对。

**CI 缺口**：`build-server.yaml` 新增的 test job 仅覆盖 build/vet/无依赖单测；全量 `go test ./...`（集成套件）需 Mongo/Redis/S3 服务容器编排，作为后续任务补齐。

## staging E2E 验证记录（2026-07-04，vm-node02，exec-only 全隔离）

CI 构建镜像 `:10a45a1` → vm-node02 丢弃式容器验证，全程不碰运行中的 faynosync-api/db/cache、不碰真 GCS：

- **T1 bootstrap**：空库 + 不设 `DEPLOYMENT_OWNER` → `level=warning "booting in bootstrap mode"`、serving。✅
- **T2 fail-closed（核心）**：有 admin + 不设 owner → `level=fatal "DEPLOYMENT_OWNER is required..."` + **exit=1 拒绝启动**。✅
- **T3 normal**：`DEPLOYMENT_OWNER=ttpos` → 过守卫、`Listening and serving`、无 fatal。✅
- **US-6 SECURITY-04**：client `?owner=GARBAGE` → cache key 解析为 `ttpos`、GARBAGE 计数=0、404 不 500。✅

结论：单 owner 三态守卫 + SECURITY-04 覆盖在真实 CI 镜像 + 真实 mongo 上按设计工作。**单 owner 验证到此充分**（build/vet/单测 + Opus 评审 + staging E2E）。

## 集成套件重塑：另立任务（发现 pre-existing rot）

尝试用丢弃式 mongo+MinIO 跑镜像自带 `faynoSync_tests` 时发现：**套件先前就是红的，与 PLAN-035 无关**——admin 注册测试用密码 `"password"`（纯字母），但 `utils/password.go:25` 的强度校验要求"字母+数字"，signup 返回 400 → 建不出 admin → 后续级联 panic，卡在第一个 signup。`password.go` 与测试密码均不在本次 diff。CI 从不跑集成套件故一直未被发现。

**决策（用户）**：单 owner 已充分验证，集成套件的 pre-existing rot **单独立项修**，14 个 `WithSecondUser` 重塑 + `owner=GARBAGE`/token 回归用例随该任务一并做，不塞进 PLAN-035。

**测试 rig 已清理**：验证末尾一度因 aissh token 瞬时失效未能确认清理（`aissh` 须在项目 cwd 下执行，否则报 config_error）；恢复后已确认删除 `plan035-mongo`/`plan035-minio`/`plan035-net`，staging faynosync-* 服务全程零改动。
