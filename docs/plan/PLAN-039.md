# PLAN-039 /dl 短链 per-platform latest 回退（/apps/latest opt-in artifact fallback）

- **status**: verified（实现合并 PR #33 / a01f4db；server-v1.0.1 部署 vm-node02，staging 三态 + 回归验证通过；prod rollout 待授权。验收明细见 docs/task/BUG-017.md）
- **task**: BUG-017
- **createdAt**: 2026-07-06
- **关联**: PLAN-033 / REFACTOR-007（/dl 迁 Caddy）、ENH-008（/dl 资源型 302）、PLAN-036（monorepo）、PLAN-037（Caddy 边界）

## 触发问题

生产发 2.25.6 时只发 macOS/Windows，Android 短链 `/dl/shop.apk` 404。当前语义是「取 app+channel 最新 published 版本，再在该版本内过滤 platform/arch/package 制品」，缺失平台的短链直接 404 而非回退。

已批准的修复语义：短链解析「**包含匹配制品的最新 published 版本**」（per-platform latest 回退），对齐 update.electronjs.org 社区实践；找不到任何含该制品的 published 版本时仍 404。

## 架构重定位（本计划与最初共识稿的差异）

最初共识稿基于旧架构（Go server 注册 `GET /dl/:target`）。REFACTOR-007 已将 /dl 入口迁到 Caddy：`deploy/Caddyfile` 的 map 把 `/dl/<alias>.<pkg>` rewrite 成 `/apps/latest?owner=ttpos&app_name=...&channel=prod&platform=...&arch=...&package=...` 反代 faynosync-api；Go 侧 shortlink 包已删除。因此：

- 修复落点从「新 /dl 专用入口」变为 **`/apps/latest` 的显式 opt-in 参数**：`resolve=artifact-latest`。
- 仅当 `resolve=artifact-latest` 且 platform/arch/package 三参齐全时启用回退语义；默认行为（无该参数）逐字不变，保护既有调用方（apps/mcp 参数透传、任何外部消费者）。
- Caddy rewrite 追加 `&resolve=artifact-latest`，由 /dl 独占开启；`apps/server/server/caddy_config_test.go` 契约同步。
- 仓储层方案 A 主体不变（评审共识全部保留）：初始 `$match` 内 `artifacts.$elemMatch`（ObjectID + 归一 package + link 非空四条件），复用 `sortVersionPipeline`（$limit 1）+ `getBasePipeline`。

## 阶段 0 查证结论（已完成，生产库只读实测 2026-07-06）

- **package 库内形态：带前导点、小写**。全库聚合仅 `.apk`(267)/`.exe`(179)/`.dmg`(226)/`.txt`(168) 四种，无裸串/大写 → `normalizePackage` = 小写 + 补前导点。
- artifacts 子文档：platform/arch 为指向 apps_meta 的 ObjectID，package 字符串，link 同子文档，与计划假设一致。
- **现网天然回退样本已消失**：TTPOS Shop prod 2.25.6 的 `.apk` 已于 2026-07-06T03:21 补传（三平台齐全），线上 404 已自愈；其余 app 最新 published 为 2.25.5（三平台齐）。T5 需构造样本（vm-node02，fixture + 事后清理，沿用 REFACTOR-007 的做法）。
- 「无样本 ≠ 修复无效」：本修复防的是未来任意部分发版的整类问题。

## 详细 TODO

### T1 — mongod 仓储：FetchLatestVersionOfAppForTarget + normalizePackage

`apps/server/mongod/check.go`：
- 新增 `normalizePackage(string) string`：小写、TrimSpace、确保 `.` 前缀（空串除外）。**归一目标是库内原始形态（带点），与下游 latest.go 的 `TrimPrefix` 口径互补而非相同**。
- 新增 `FetchLatestVersionOfAppForTarget(appName, channel, platform, arch, pkg string, ctx, owner)`：复用 `resolveLatestAppMeta` + channel 解析；platform/arch 名 → apps_meta ObjectID（沿用 `CheckLatestVersion` 的解析先例）；matchFilter 追加 `artifacts.$elemMatch{platform: ObjID, arch: ObjID, package: normalizePackage(pkg), link: {$exists:true, $ne:""}}`；管线 = `$match` → `sortVersionPipeline()` → `getBasePipeline()` → `processApps`。共享 helper 零修改。
- match filter 构造抽成可单测的纯函数，便于无 Mongo 断言。
- 单测（必须为断言，不得降格为注释——Critic 附带条件）：$elemMatch 用 ObjectID 而非名字；package 值 == normalizePackage 结果（含"apk"→".apk"、"APK"→".apk"）；四条件负样本（无 link / package 不符）不命中。

### T2 — info handler：opt-in 分支

`apps/server/server/handler/info/latest.go`：
- 新窄接口 `latestTargetRepository`（仅新方法），`FetchLatestVersionOfApp` 内当 `c.Query("resolve") == "artifact-latest"` 且 platform/arch/package 全非空时，经类型断言改调新仓储方法；断言失败或参数不齐 → 走原路径。`latestAppRepository` 与 `latestRepoStub` 零修改。
- `CreateCacheKey` 支持 `resolve` 维度（同 `updater`/`package` 的追加方式），防两种语义共用缓存键。
- 下游 artifact 过滤、CountUrls/302/200 分支、缓存头逻辑共享复用（无需复制骨架——opt-in 分支只换数据源）。
- 单测三态：回退 302（Location 指向旧版）/ 不回退 302 / 404；package 口径错位样本（query `apk`、库内 `.apk`）端到端 302；无 `resolve` 参数时行为与旧完全一致（回归断言）。

### T3 — Caddy 契约

- `deploy/Caddyfile` rewrite 追加 `&resolve=artifact-latest`。
- `apps/server/server/caddy_config_test.go` 契约断言同步。

### T4 — 本机质量门 + 文档

- `cd apps/server && go build ./... && go vet ./... && go test ./server/... ./mongod/...`（每门独立跑、看真实退出码；需要外部服务的测试按 QUAL-004 口径说明缺口）。
- `docs/task/BUGFIX-*.md`（补号）+ `docs/plan/index.md` / `docs/task/index.md` 登记。
- 不碰 TUF、不碰 apps/web。

### T5 — PR → CI 绿 → squash 合并 → staging 验证

1. 分支 push、开 PR（中文标题/描述，不含内部工具细节），checks 全绿后 squash 合并。
2. 打 `server-v*` tag 触发 `build-server.yaml` 推 ghcr `ttpos-server:latest`（PLAN-036 后 push main 不再发镜像）。
3. vm-node02：`migrate-caddy-shortlinks.sh` 生成候选 Caddyfile（含新参数）→ validate → 备份 → apply → reload；`docker compose pull api && up -d api`。
4. 构造带标记的可回滚 fixture（新版缺 apk、旧版含 apk），curl 三态断言：回退 302 指旧版 / dmg 302 指新版 / 真 404 no-store；`/apps/latest`（无 resolve 参数）回归抽查；事后清理 fixture。
5. 生产 rollout（prod Caddy 片段 re-splice + server 镜像更新）**不自动执行**，验证完成后向用户汇报并等待授权。

## 成功标准

1. staging `/dl/<alias>.apk`：最新版缺 apk、前序版本含 apk → 302 到前序版本 apk。
2. `/dl/<alias>.dmg`：最新版含 dmg → 302 到最新版（有制品的平台不回退）。
3. 无任何含 apk 的 published 版本 → 404、`no-store`。
4. `/apps/latest` 无 `resolve` 参数时行为逐字不变（单测回归断言 + staging 抽查）。
5. 契约测试覆盖新 rewrite 参数；`go vet`/`go build`/单元测试全绿。

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| $elemMatch 误用名字 → 全 404 | 单测断言 ObjectID；staging 302 断言 |
| package 归一与库内形态不符 | 阶段 0 已实测（带点小写）；normalizePackage 单测锁死 |
| 缓存键混串两种语义 | CreateCacheKey 增加 resolve 维度 + 单测 |
| Caddy 参数未上、镜像先上 | opt-in 设计天然安全：参数未上=旧行为；参数上了旧镜像=未知参数被忽略=旧行为，双向兼容 |
| /apps/latest 契约回归 | 默认路径零改动 + 回归断言 + MCP 参数透传不受影响 |

**回滚**：单 commit revert；Caddy 侧去掉参数即回旧语义；两侧任意单独回滚都安全（见上）。

## ADR（共识决议记录，含架构重定位修订）

- **Decision**：`/apps/latest` 增加显式 opt-in `resolve=artifact-latest`；启用时经窄接口调用新仓储方法（初始 $match `$elemMatch` ObjectID + normalizePackage + link 非空，复用排序/limit/lookup 管线）；Caddy /dl rewrite 独占开启该参数。
- **Drivers**：① /apps/latest 兼容契约零回归（含 MCP 透传）；② 版本选择正确性；③ 部署解耦可回滚（参数与镜像双向兼容）。
- **Alternatives considered**：隐式改「三参齐全」时的共享语义——否决：波及 MCP 等透传调用方，契约不显式；handler 遍历全量版本——否决：数据放大；上传时指针缓存——否决：写路径耦合。旧共识稿的「新 Go /dl 入口」——已被 REFACTOR-007 的 Caddy 所有权决策取代，不再成立。
- **Consequences**：Caddy 片段与契约测试进入本次范围；staging/prod 的 Caddyfile 需 re-splice（prod 另行授权）；无回退窗口（对齐 update.electronjs.org 语义）；回退命中的旧版本视为可分发（published 即可分发，不可分发应 unpublish）。
- **Follow-ups**：发布流程"平台缺失警告"门禁另行立项；prod rollout 单独授权执行。

## 共识记录（ralplan → 实现期修订）

- Planner 初稿 + Architect（ARCHITECTURALLY SOUND，4 修订项）+ Critic（APPROVE，2 Major 落地条件）基于旧架构达成，语义与仓储层方案全部保留。
- 实现期发现本地 main 落后 55 commits：REFACTOR-007 已把 /dl 迁至 Caddy 并删除 Go shortlink 包，PLAN-036 完成 monorepo 迁移（server → apps/server）。入口设计据实修订为 opt-in 参数方案（本文件），语义结论与 Guardrails 不变；原编号 PLAN-033 被远端占用，改号 PLAN-039。
