# PLAN-040:非技术人自助触发 Flutter 测试包构建

> 状态:**PENDING APPROVAL**（ralplan 3 轮共识 + brainstorm 可视化对齐 + v4 delta 复审,v5 定稿）
> v5 变更（据 v4 delta 复审的代码实证修订）:
> - **`correlation_id` 统一键**:server 每次触发生成一个 correlation_id,同时承担「版本唯一后缀 `+b<correlation_id>`」「完成检测谓词」「run 关联」三职,替代 v4 错误的 `+b<run_id>`（run_id 是 per-平台-run 粒度,同平台多 package 共享 → 会撞）。
> - **fan-out 拓扑更正**:auto-build 是**两级 dispatch**（5 个平台步各 `gh workflow run` → 每个 build-* 内部 `matrix.package + should_run` 过滤),非「吃列表一次展开」。
> - **矩阵降级**:Phase1 用 workflow **原生 all/单值**(一次 dispatch、一个 dispatcher run);**任意 端×平台 子集矩阵 = Track 2**(需改 auto-build + 5 个 build-* 共 6 文件两层),UI 能力门控,不静默丢格。
> - **concurrency 风险登记**:`auto-build` `cancel-in-progress` 按分支 → 同分支重复/多人触发互相取消(v4 遗漏,补回)。
> 本文件为**计划**,未改任何实现文件;批准后进入实现。

---

## 0. 一句话与范围

给**非技术人 QA/PM** 一个 Dashboard「构建测试包」入口:选 端 + 平台 + 分支 → 触发既有 `auto-build` workflow(**仅 test 环境**)→ 产物照旧上传 FaynoSync → 在 Dashboard 看每个 端×平台 的状态并下载。

**本仓** = `ttpos-artifacts`(FaynoSync server + Dashboard + workflow);Flutter 源码在 `ttpos-flutter`。

---

## 1. 核心边界:两轨(brainstorm 证据校准)

调研社区最佳实践后确立的职责划分。「薄 ≠ 什么都不做,薄 = 只做触发层该做的:安全门 + 参数契约 + 状态聚合,不碰 CI 的构建逻辑 / 版本策略 / 产物命名」。

### Track 1 — Server 薄触发代理（本功能主体,可独立交付,零 workflow 内部知识）

| 职责 | 依据 |
|---|---|
| 鉴权 / RBAC / app-scope | 标准安全实践 |
| branch 白名单(优先 commit SHA) | GitHub script-injection 文档;Ultralytics / GitLab CVE-2024-9164 |
| env=test 后端字面常量,**绝不透传** | 安全共识(可控 env=可控部署目标=提权面) |
| 限流 + 单次构建数上限 | 成本/滥用护栏 |
| 触发时带 `return_run_details` → 直接拿 run_url | GitHub 2026-02 官方 API |
| 轮询 run 状态 + 复用现有 FaynoSync 版本列表下载 | 触发层职责 |

### Track 2 — Workflow 增强（workflow owner 拥有,标准 CI 实践,非「server 逼它改」）

| 职责 | 依据 | Phase1 是否需要 |
|---|---|---|
| **T2-a** 版本加 build-metadata `+b<correlation_id>` 后缀（correlation_id 由 server 传入 workflow input,线程 auto-build → 5 个 build-* 的 FS_VERSION 步）| server 触发前不知 pubspec version;semver.org(`+build` 不参与优先级排序,不盖过 release);用 correlation_id 而非 run_id 因 run_id 是 per-平台-run、同平台多 package 共享会撞 | **推荐**(否则重复同源构建撞 409,server 降级为 `/upload/check` 查重给下载) |
| **T2-b** 让 auto-build 5 个平台步 + 5 个 build-* 的 `matrix.package/should_run` 接受**列表**(支持任意 端×平台 子集）| fan-out 是 CI 自有职责;**改 6 文件两层**(auto-build 平台步 `if` + child matrix 过滤门) | **Phase1 不做**(Phase1 只 all/单值);UI 能力门控,选子集提示「即将支持」 |
| **T2-c** `run-name` 渲染 correlation_id(可观测) | GitHub run-name 官方支持引用 `inputs.*` | 可选(`return_run_details` 可用时 server 关联不依赖它) |
| build / 产物命名 / 上传 FaynoSync | CI 实现细节,触发层不碰 | — |

**契约点(合规,非侵入)**:server 传 `correlation_id` 作为 workflow input(线程 auto-build → 各 build-*);workflow 用它拼版本后缀 + 渲染 run-name —— 依赖接口不依赖实现。

**correlation_id 一键三用**:①版本唯一后缀 `+b<correlation_id>`(免 409);②完成检测谓词(server 认得自己生成的 id,`version LIKE '%+b<correlation_id>%'` 精确命中版本列表某格);③人读关联(run-name)。三者同源,消除 v4 的双 id 复杂度。

**真实 fan-out 拓扑(更正 v4)**:`auto-build.yaml` **不是**吃列表一次展开,而是 5 个独立步 `gh workflow run build-<platform>.yaml -f package=<all|单值>`(两级 workflow_dispatch);package 的展开在每个 `build-*.yaml` 内部 `strategy.matrix.package` + `should_run` 门。故 Track 2-b 的任意子集支持要跨 6 文件两层改。

**优雅降级**:T2-a 未落地 → 完成检测退化为「新产物 (app,platform,channel=test) 在触发后出现」(较松,低并发够用),版本碰撞退化为触发前 `/upload/check` 查重给下载;T2-b 未落地 → Phase1 只 all/单值,UI 门控不渲染任意子集矩阵。

**证据来源**:[GitHub Changelog 2026-02 return_run_details](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/) · [semver.org](https://semver.org/) · [GitHub run-name syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) · [GitHub script-injections](https://docs.github.com/en/actions/concepts/security/script-injections) · [Backstage/IDP meta-orchestrator (Roadie)](https://roadie.io/blog/the-backstage-scaffolder-a-powerful-new-orchestration-tool/)

---

## 2. RALPLAN-DR 摘要

### Principles（与实现自洽,无「零」伪承诺）

1. **薄触发代理**:server 只做安全门 + 参数契约 + 状态聚合,不碰构建逻辑 / 版本策略 / 产物命名。
2. **顺数据流,不逆流塞字段**:关联走官方 `return_run_details`;版本唯一性走 workflow 的 build-metadata;都不改上传强类型契约。
3. **fail-closed 且不误伤合法路径**:触发鉴权复用 CI 已在白名单的 `PermissionUpload/ResourceApps`;team_user app-scope 显式补校验。
4. **prod 防护在可信后端**:env=test 服务端字面常量,绝不透传;既有 release-push 旁路作为既有债转 Follow-up。
5. **成本对非技术人可见可控**:矩阵实时构建数 + 单次上限 + 限流。
6. **新增状态/失败域显式承认**:内存 limiter(单副本前提)、轮询 GitHub run 状态、版本列表观测 —— 均标注前提/降级。

### Decision Drivers（Top 3）

1. 安全边界正确性(env 不透传、branch 白名单、app-scope、不成为 prod 旁路)。
2. 边界清晰(触发层与 workflow 职责不混,可独立演进)。
3. 非技术人可用 + 成本可控。

### Options（关键选型）

- **范围**:Phase1 薄代理(选) vs 全量有状态系统(降 Phase2)。
- **关联**:`return_run_details`(选,官方) vs UUID+run-name+轮询(老 GHES 保底) vs 深链列表(最薄降级)。
- **版本唯一**:workflow `+b<correlation_id>` build-metadata(选,correlation_id 由 server 传入、天然每次唯一) vs `+b<run_id>`(否决,run_id per-平台-run 粒度、同平台多 package 撞) vs 覆盖 force(否决,API-token 403 + 丢历史)。
- **多端多平台**:Phase1 用 workflow **原生 all/单值**(选,一次 dispatch 一个 dispatcher run,不改 workflow) vs 任意子集(Track 2-b,改 6 文件,延后) vs server 循环多次 dispatch(否决:`auto-build` `cancel-in-progress` 按分支会互相取消,且 batch 难跟踪)。
- **状态失败态**:Phase1 超时降级(选) vs Track 2 workflow 回调精确实时(gated 后续)。

---

## 3. 分阶段实施

### Phase 1（本次交付）

#### 步骤 1 — Server:`POST /build/trigger`（鉴权 + 三重服务端校验 + env 常量 + 成本护栏）

1. **触发权限**:复用 `CheckPermission(PermissionUpload, ResourceApps)`(`permissions.go:109-110`)。零新 RBAC、零矩阵改、零迁移。
2. **team_user app-scope 显式校验**:upload 路径对非 API-token 不校验 `allowed_apps`(`upload.go:426-435` 返回 nil;`permissions.go:150-159` 仅 Allowed 非空才写 context)。handler **不得继承此 no-op** —— 显式检查每个目标 app ∈ `Permissions.Apps.Allowed`;**空 Allowed = 拒绝(fail-safe 403)**。
3. **branch 服务端白名单**:正则 `^[\w./-]+$` + 允许集(new-test / release / feature/*);**优先接受 commit SHA**(不可变,最安全);拒绝任意 ref → 400。
4. **env 硬钉 = 服务端字面常量 `test`**:**绝不透传**请求体的 env。**唯一 prod 防线**——因 `dispatch.yaml:15` 的 `client_payload.env` 首选优先级、`auto-build.yaml:113-114` prod 守卫豁免非 workflow_dispatch,workflow 层不夹紧 env,信任边界只在 server 代码。marshaled payload 不得含调用方可控 env(**T-5 承重断言**)。
5. **成本护栏**:handler 计算**计费单位 = matrix leg 数 = |端| × |平台|**(注意:实际起的 GitHub run 数 = |平台| 个 platform child run,每个含 |端| 个 matrix leg;上限按 leg 数拦截是保守正确的)。超**单次上限**(默认 12,可配)→ 400;**新建内存 `(user)` limiter**(参考 `ratelimit.go` 但非复用——现有按 IP,`ratelimit.go:89`;矩阵跨多 app 故按 user 非 per-app),每 user 冷却 + 全局每小时上限 → 429。**单副本前提**;多副本迁 Redis(`server.go:100-113`)。

**触发调用(Phase1 原生 all/单值)**:用 GitHub App token,带 `return_run_details: true` 触发 `auto-build`,传 `package=<all|单值>` / `platform=<all|单值>` + `env=test` 常量 + `correlation_id`。响应 200 → 解析 dispatcher run_url 返回(供深链)。**任意子集矩阵需 Track 2-b,Phase1 不发列表**。

> **验收**:合法请求 → 200 + run_url + 一个 dispatcher run;空 Allowed / app 越权 → 403;`env=prod` 或非法 branch → 400;超上限 → 400;超限流 → 429;marshaled payload 恒 `env=test`(T-5)。

#### 步骤 2 — Server:run 关联与状态（`return_run_details` + 版本列表为完成源）

- 触发响应直接含 dispatcher run URL → 返前端供**深链**。**无需 UUID+run-name+轮询匹配**。
- **降级**(老 GHES 不支持 `return_run_details`):回退 correlation_id + `run-name`(T2-c)+ 轮询 `display_title` 匹配;再不行深链 auto-build 运行列表。
- **状态数据源(关键,更正 v4 的语义割裂)**:
  - **dispatcher run 几乎瞬间完成**(它只跑 5 次 `gh workflow run`),其状态**无观测价值**、且深链进去只看到 5 条 dispatch 命令、看不到 build 日志 → 深链价值有限(实现期评估是否改深 child)。
  - **「排队/构建中」**:如需,轮询 5 个 **platform child run** 的聚合(dispatcher fan-out 出的 build-* run);Phase1 可简化为「已触发」+「完成」两态,不做精细进行中。
  - **「完成」= 唯一可靠源 = 版本列表观测**:见步骤 4。
- **实现期确认**:`return_run_details` 返回的是 dispatcher run 还是别的;各平台构建真实时长(定超时)。

> **验收**:触发后前端拿到可点的 run_url;`return_run_details` 不可用时走降级且有日志。

#### 步骤 3 — Dashboard UI（shadcn base-nova）

- **入口**:App 详情页 PageHeader 新增「构建测试包」按钮(镜像现有「上传版本」);全局入口可选。
- **触发弹窗(Dialog)**:端选择 + 平台选择(**多选带全选/反选,项目硬规则**);分支(可搜索白名单 Select);**env 只读 Badge「test」锁死**;底部**实时构建数 + 单次上限**,超限按钮禁用并提示。
  - **能力门控(M-3,防残交付)**:Phase1 后端只支持 **all 或单值**。UI 多选映射:全选 → `all`;选单个 → 单值;**选了严格子集**(非全非单)→ 按钮禁用 + 提示「子集构建即将支持(Track 2-b),当前请选单个或全部」。**绝不静默丢格**。后端能力用 capabilities 标志暴露给前端。
- **状态面板(Sheet,右侧滑出可关)**:逐行显示 端×平台 —— **完成→下载**(绿 Badge,复用现有版本列表下载入口)、**构建中**(灰)、**失败→查看**(红,深链 Actions);顶部总进度 + 「查看 Actions run」深链。
- 组件:`@ttpos/ui`(Base UI / shadcn base-nova)Dialog / Select / Checkbox / Badge / Button / Sheet;**禁 radix**。多选场景全带全选/反选。
- i18n:新增文案同步 Dashboard 的 **en/zh** 两 locale(`apps/web/public/locales/{en,zh}/apps.json`),每处 `t()` 带 `defaultValue`;禁硬编码中文。不碰 `routeTree.gen.ts`,用弹窗不新增路由。

> **验收**:多选带全选/反选;env 不可改;超上限按钮禁用;完成行可下载;`typecheck/lint/test --filter @ttpos/web` 过;i18n key en/zh 一致。

#### 步骤 4 — 状态「完成」信号 + 失败超时降级（Track 1 薄层）

- **完成检测谓词(更正 v4:server 触发前不知最终 version,不能精确 version 相等)**:
  - **T2-a 落地时(推荐)**:版本列表中出现 `version LIKE '%+b<correlation_id>%'` 且 `(faynosync_name(app 映射), platform, channel=test)` 命中 → 该格完成。correlation_id 是 server 自己生成,匹配确定、无竞态。
  - **T2-a 未落地(降级)**:`(faynosync_name, platform, channel=test)` 的产物 `updated_at > 触发时刻` → 该格完成(较松,并发下可能误配,低并发够用)。
  - 注:FaynoSync 版本查询按 `{app_id, version, channel, owner}`(`create.go:561-568`),platform/arch 在 artifact 子结构 → 完成判定按 `app + platform + version(前缀/含 correlation_id)`,不是精确整串相等。
- **失败 = 超时降级**:某格超阈值(建议 30min,**实现前复核各平台真实时长**)未出现产物 → 派生「失败/超时」+ 深链 Actions。
- **精确实时失败** = Track 2 workflow 回调(gated,Phase2),Phase1 不做。

> **验收**:构建成功 → 对应格按谓词转「完成」可下载;人为失败/超时 → 转「失败」带深链;轮询无 in-flight 时停轮询。

#### 步骤 5 — prod 防护 = test-only 单层 + 既有债登记

- 本功能对 prod 唯一防线 = 步骤 1.4 的 env=test 服务端常量。
- **既有风险项(不进本功能范围)**:持 `actions:write` 的凭据经 `dispatch.yaml` 的 `repository_dispatch: release-push` 可直达 prod(`auto-build.yaml:113-114` 守卫豁免;`dispatch.yaml:14-20` 透传 env)。**本功能不扩这个凭据的权力,只新增 test-only 调用方**。治理转 Follow-up。

### Track 2 增强项（workflow owner 拥有;改动面已按真实拓扑核算）

- **T2-a `+b<correlation_id>` 版本后缀**:server 生成 correlation_id → 作为 input 线程 **auto-build → 5 个 build-***,各 `FS_VERSION` 步条件化 append(仅 correlation_id 非空即经自助路径时,防污染常规构建)。用 correlation_id 而非 run_id(run_id per-平台-run、同平台多 package 共享会撞)。**未落地时** server 降级:触发前 `/upload/check` 查重,已存在给下载不触发。**改动面**:auto-build 加 input + 转发 5 处 + 5 个 build-* 加 input + FS_VERSION 条件 append ≈ 6 文件。
- **T2-b 任意子集 fan-out(Phase1 不做)**:让 auto-build 的 5 个平台步 `if` 吃平台列表 + 5 个 build-* 的 `matrix.package`/`should_run` 吃 package 列表。**改 6 文件两层**。未落地 → Phase1 只 all/单值,UI 门控。
- **T2-c run-name 渲染 correlation_id**:可观测性;`return_run_details` 可用时非必需。

> **被否决的替代(记录取舍,回应 delta 复审 Skeptic)**:「server 循环 N 次 dispatch + 版本列表聚合 → Track 2 清零」看似能免所有 workflow 改动,但撞 `auto-build.yaml:104` 的 `concurrency: cancel-in-progress` 按分支 → 同分支多次 dispatch 会**互相取消**;绕开需改 concurrency(仍是 workflow 改动)或 server 直接调 child 并自管 batch(不薄 + 状态难跟踪)。故不采纳,Phase1 走原生单 dispatch。

### Phase 2（gated,不在本次范围）

触发条件 = Phase1 用量证明需要更强能力。含:精确实时失败/进度 **workflow 回调**(callback 作终态唯一权威 + `/build/callback` HMAC/OIDC 认证 + 幂等 + 多平台聚合语义)、放开 dev、GitHub Environments 治理 prod、多副本迁 Redis limiter、web 端自助(现 `build-web.yaml` 无 FS_VERSION,`auto-build.yaml:200-210` 不传 faynosync → **Phase1 排除 web**)、Phase2 gate 埋点。

---

## 4. Deliberate:Pre-mortem + 测试

### Pre-mortem（缓解建立在真实机制上）

| # | 场景 | 缓解 | 残留 |
|---|---|---|---|
| PM-1 | prod 误触发 | env=test 服务端常量,绝不透传(唯一信任边界在 server) | release-push 既有旁路(既有债,不扩权) |
| PM-2 | 非技术人一键矩阵烧爆 CI | 单次构建数上限 + 每 user 限流 + 实时构建数可见 | 全局上限饥饿(Phase1 已知限制,per-user 为主闸) |
| PM-3 | team_user 空 Allowed 触达任意 App | 显式 app-scope 校验,空 Allowed = 拒绝 | 首日回归 → Rec:上线前审计补 Allowed |
| PM-4 | 任意 ref 注入构建 | branch 白名单/正则 + 优先 commit SHA | — |
| PM-5 | 版本碰撞致上传 409 | Track 2-a `+b<correlation_id>` 后缀(correlation_id 每次触发唯一,同平台多 package 也不撞);未落地则触发前 `/upload/check` 查重给下载 | — |
| PM-6 | dispatcher run「完成」被误当构建成功 | 「完成」以版本列表按 correlation_id 谓词命中为准,非 dispatcher run 状态 | 失败精确性 → Track 2 回调 |
| PM-7 | 失败回调没发/runner 崩 → 一直转圈 | 版本列表超时派生「失败/超时」+ 深链 Actions,不依赖回调 | 实时性 → Track 2 |
| PM-8 | `return_run_details` 老 GHES 不支持 | 降级 correlation_id+run-name 轮询 / 深链列表 | 实现前确认目标 GitHub 版本 |
| PM-9 | 同分支重复/多人触发被 concurrency 腰斩 | `auto-build.yaml:104` `cancel-in-progress` 按分支 → 后触发取消前者。缓解:per-user 限流降低连点;文档告知「同分支后触发会取消进行中构建」;彻底解需改 concurrency group(Track 2 workflow 改动) | Phase1 接受 + 告知;根治转 Track 2 |
| PM-10 | UI 画矩阵但后端只 all/单值 → 静默丢格 | UI 能力门控:严格子集禁用并提示「Track 2-b 即将支持」,只放行 all/单值 | 任意子集 → Track 2-b |

### 测试计划（每条带 pass/fail 断言）

| ID | 目标 | pass / fail |
|---|---|---|
| **T-5（承重）** | env 不透传 + branch 白名单 | pass:marshaled payload **无调用方可控 env**,恒 `test`;非法 branch/任意 ref → 400。fail:出现非 test env 或放行任意 ref |
| T-6 | 成本护栏 | pass:超单次上限 → 400;同 user 超限流 → 429。fail:放行超额 |
| T-7 | team_user 空 Allowed | pass:空 Allowed / 越权 app → 403。fail:放行 |
| T-8 | 关联 | pass:`return_run_details` 拿到 run_url 返前端;不可用时走降级且日志。fail:拿不到且无降级 |
| T-9 | 完成信号 | pass:产物按 correlation_id 谓词命中(或降级 updated_at)→ 对应格转完成可下载。fail:已上传却不转完成 |
| T-10 | 失败超时派生 | pass:超阈值未出现 → 该格失败/超时 + 深链。fail:一直转圈 |
| T-11 | 版本唯一(Track 2-a 落地时) | pass:同端同平台同源码重复触发 → 两个 `+b<correlation_id>` 版本(correlation_id 不同),无 403/409;常规构建(无 correlation_id)版本号纯净无后缀;**同平台多 package(pos+kds/android)不因共享 run_id 撞后缀**。fail:撞 409 或污染常规构建 |
| T-12 | UI 多选 + 能力门控 | pass:端/平台多选带全选/反选;env 只读;超上限按钮禁用;**选严格子集时按钮禁用并提示 Track 2-b**,只放行 all/单值。fail:缺全选/反选、env 可改、或严格子集被静默提交丢格 |

---

## 5. ADR

**Decision**
1. 两轨:**Server 薄触发代理**(auth+校验+护栏+触发+观测) + **Workflow 增强**(版本后缀 + run-name;任意子集 fan-out 延后)。
2. 关联用 **`return_run_details`**(官方),砍轮询 hack;老 GHES 降级。
3. **`correlation_id` 一键三用**:server 生成 → 版本后缀 `+b<correlation_id>`(免 409)+ 完成检测谓词 + run 关联。取代 v4 错误的 `+b<run_id>`(run_id per-平台-run 粒度、同平台多 package 撞)。
4. 多端多平台:**Phase1 用 workflow 原生 all/单值**(一次 dispatch);**任意 端×平台 子集 = Track 2-b**(改 6 文件两层,延后),UI 能力门控;成本靠 leg 数上限 + per-user 限流。
5. 触发鉴权复用 `PermissionUpload/ResourceApps`;**team_user app-scope 显式校验,空 Allowed 拒绝**。
6. **env=test 服务端常量硬钉,绝不透传**;release-push 既有 prod 旁路转 Follow-up。
7. 状态:完成靠版本列表按 correlation_id 谓词观测,失败靠超时降级;精确实时失败 = gated Phase2。
8. limiter 内存 + 单副本前提(用户确认单副本)。

**Drivers**:安全边界正确性 / 边界清晰可独立演进 / 非技术人可用且成本可控。

**Alternatives considered**:UUID+轮询关联(→老 GHES 保底)、`+b<run_id>`(粒度错否决)、server 传版本后缀(越界否决)、force 覆盖(API-token 403 否决)、**server 循环 dispatch 清零 Track 2**(撞 concurrency cancel-in-progress,否决)、任意子集矩阵(Track 2-b,延后)、Phase2 全量有状态回调(gated)。

**Consequences**
- 正向:server 极薄可独立上、关联无 hack、版本 CI 自持、边界清晰;prod fail-closed(仅 test)。
- 代价(诚实):新增内存 limiter(单副本)、新增 GitHub run 状态轮询(限流/超时,新失败域)、版本列表观测有超时窗;失败非实时(Phase1);Track 2 未落地时多端多平台受限/需降级;空 Allowed team_user 首日需补白名单;release-push 既有债未消除(转 Follow-up)。

**Follow-ups**
1. GitHub Environments + required reviewers 治理 prod + 围栏 release-push env 透传。
2. 多副本迁 Redis limiter(`server.go:100-113`)。
3. 上线前审计 `Apps.Upload=true && len(Allowed)==0` 的 team_user 补 Allowed。
4. Phase2 gate 埋点(触发量/关联成功率/超时率/限流命中率/矩阵规模分布)。
5. 评估放开 dev;评估 web 端自助;macOS 加权限额。
6. 实现前确认目标 GitHub 版本支持 `return_run_details` 及各平台构建时长(定超时阈值)。

---

## 6. 边界声明

- Phase1 **仅 env=test**、**仅 Flutter app 端**(排除 web);触发鉴权复用 Upload/Apps(无新 RBAC/迁移),**team_user app-scope 新写校验**。
- env **绝不透传**,恒服务端常量 test。branch **白名单/优先 SHA**。
- **版本后缀 / 列表 fan-out / run-name 属 Workflow 轨**,workflow 拥有;server 有则用、无则降级。**server 绝不计算版本号、不管构建/产物命名**。
- 不改 `UpRequest` / `extractParamsFromPost` / upload 契约 / 现有认证 / `routeTree.gen.ts`;不碰 TUF;不引入 radix。
- release-push prod 旁路属既有债,本功能不扩权,转 Follow-up。

---

## 7. 关键代码锚点（规划期已复核）

| 锚点 | 事实 |
|---|---|
| `apps/server/server/utils/permissions.go:109-110` | `PermissionUpload → Apps.Upload` 既有字段(复用,零新 RBAC) |
| `apps/server/server/utils/permissions.go:150-159` | `allowed_apps` 仅 Allowed 非空才写 context(空=全放的源头) |
| `apps/server/server/handler/create/upload.go:426-435` | 非 API-token 不校验 app-scope(team_user 缺口) |
| `apps/server/server/handler/create/upload.go:394-399` | API-token overwrite 硬 403(故用新版本号而非 force) |
| `apps/server/mongod/create.go:561-589` | version 查询含 version 维度,新 `+b<correlation_id>` → 无 409 |
| `apps/server/server/utils/ratelimit.go:89` | 既有 limiter 按 IP 单进程(故 N1 新建 per-user) |
| `apps/server/server/server.go:100-113` | Redis client 已就绪(多副本 Follow-up) |
| `.github/workflows/dispatch.yaml:14-20` | `client_payload.env` 透传且首选优先级(Rec1 承重) |
| `.github/workflows/auto-build.yaml:104` | `concurrency: auto-build-${branch}` + `cancel-in-progress` → 同分支后触发取消前者(PM-9) |
| `.github/workflows/auto-build.yaml:113-114` | prod 守卫仅 workflow_dispatch,repository_dispatch 豁免 |
| `.github/workflows/auto-build.yaml:148-210` | **两级 fan-out**:5 个平台步各 `gh workflow run build-<p>.yaml -f package=<all\|单值>`(非列表);Track 2-b 要改这 5 步 + 5 个 child |
| `.github/workflows/build-android.yaml:78-115` | `strategy.matrix.package: [pos,kds,…]` + `should_run` 门;一次 run 覆盖多 package → `github.run_id` per-平台-run 非 per-格(故版本键用 correlation_id) |
| `.github/workflows/build-*.yaml`(FS_VERSION 步,如 build-android:225-236) | Track 2-a 条件化 append `+b<correlation_id>` 的位置 |

---

## 8. 落地前必带条件（实现阶段执行项）

1. **T-5 含 env 不透传断言**(marshaled payload 无调用方 env) —— prod 唯一闸的兜底。
2. ✅ **`return_run_details` 已实测确认**(2026-07-08 对 BenDaye/ttpos-artifacts 实发 dispatch,HTTP 200 返 `{workflow_run_id, run_url, html_url}`;server 解析 `html_url`)。降级路径(correlation_id + run-name + 轮询)保留给老 GHES。
3. **Phase1 只 all/单值**;任意 端×平台 子集 → Track 2-b(改 auto-build 5 步 + 5 个 build-* 共 6 文件两层),UI 严格子集能力门控。
4. **版本唯一** → Track 2-a(`+b<correlation_id>`,线程 auto-build → 5 个 build-*);否则 server 触发前 `/upload/check` 查重降级 + 完成检测退化为 updated_at。
5. **验证 concurrency 影响**:`auto-build` `cancel-in-progress` 按分支,确认同分支重复/多人触发的取消行为可接受(或纳入 Track 2 改 concurrency group)(PM-9)。
6. **完成谓词实现**:按 `(faynosync_name 映射, platform, channel=test) + version 含 correlation_id` 匹配,非精确整串相等(M-1)。
7. **上线前审计空 Allowed team_user** 补白名单(Follow-up 3)。
8. **超时阈值**按各平台真实构建时长定(Follow-up 6)。

---

*本计划经 ralplan 3 轮共识(Planner/Architect/Critic)+ brainstorm 可视化对齐(流程/边界/UI)+ v4 delta 复审(代码实证,修订为 v5)。状态 PENDING APPROVAL,等待批准后进入实现。v5 关键修订:correlation_id 统一键、fan-out 两级拓扑更正、任意子集矩阵降级为 Track 2-b、concurrency 风险(PM-9)补回。第 8 节列实现期必带复核项。*
