# PLAN-038 prod 主机 Caddy 独立化迁移（PLAN-037 北极星落地）

- **status**: deployed（2026-07-05 已在 prod 执行完成，REFACTOR-011；两条红线全程守住，公网 5 路冒烟全绿，旧 caddy/网络/mongodump 保留至 2026-07-12 作回滚锚）
- **task**: REFACTOR-011
- **createdAt**: 2026-07-05
- **mode**: DELIBERATE（生产、Cloudflare 前置、单 host:80、触及无关 aitrans 项目、网络所有权反转）
- **决策方式**: ralplan 共识（Planner → Architect → Critic，两轮迭代后 Critic APPROVE；Architect + Critic 均实测 prod ground truth 只读核验）
- **承接**: PLAN-037（`docs/plan/PLAN-037.md`）北极星；REFACTOR-010 已完成仓库归位
- **参考实现**: staging(vm-node02) `/opt/caddy/` 独立栈 + 裸名 `caddy-net`（带外创建、caddy 与 app 均 external 引用）+ 按 container_name 反代。已只读核对 staging `/opt/caddy/docker-compose.yml` 为 `caddy-net: {external:true}`、`docker network ls` 实名精确裸名无前缀——**prod 逐字对齐此形态**。
- **prod 主机**: ttpos-releases / 34.92.53.164 / 部署目录 `/ttpos-releases/`

> ## 🔴 硬约束（红线，不可违反）：Caddy 全程不得签发/重签任何 TLS 证书
> prod 是 Cloudflare 终止 TLS、Caddy 只做 http 源站。迁移中新 Caddy **绝不能**触发 ACME 证书签发（会重签证书、且可能撞 Let's Encrypt 限流把域名打黑）。三层保险必须逐字延续、迁移后逐条断言：
> 1. 新 `/opt/caddy/Caddyfile` **必须保留全局块 `{ auto_https off }`**（migrate 脚本只改站点块、不管全局块，靠人工搬——最易漏，列为首要 gate）。
> 2. 三个站点地址 **必须保留 `http://` 前缀**（`http://releases.ttpos.com` / `http://update.ttpos.com` / `http://aitrans.ttpos.com`），不得写成裸域名。
> 3. 新 caddy 容器 **只发布 `:80`，绝不发布 `:443`**；**绝不照搬 staging 的 `caddy-cf` 镜像/DNS-01/TLS 配置**（staging 真签证书，prod 不签）——prod 沿用 `caddy:2.11.4-alpine` http-only 形态。
>
> **验证闸**：`diff 最终Caddyfile vs 原始主机副本` 必须只有两处上游主机名不同（含 `{auto_https off}` 与三个 `http://` 零漂移）；`caddy validate` 后 + cutover 后立即查 caddy 日志**零 ACME/certificate 活动**、无到 `acme-v02.api.letsencrypt.org` 的出站；`ss -ltnp` 确认新 caddy 无 :443 监听。任一不满足即**中止/回滚**，绝不放行。

> ## 🔴 硬约束（红线，不可违反）：prod server 数据（mongo）必须确保安全
> 本迁移是网络/代理层，理论上不碰数据；但 **Step4 recreate api 会重启进程 → api 是 migrate-then-serve（`CMD faynoSync --migration`，PLAN-035 证实）→ 对 prod mongo 再跑一次 migration**。「通常安全」（镜像冻结不跳版 → 同一已应用 migration → no-op；PLAN-035 该版本不改表结构/不迁数据）不等于「确保安全」。硬措施：
> 1. **任何 recreate 之前先 `mongodump` 备份 prod mongo**（落 `backups/caddy-migration-<UTC>/`），作为即使 no-op 也留的还原点——这是 Step0 的**前置闸**，没备份不许进 Step4。
> 2. **db/cache 容器与数据卷全程不重建、不触碰**（`docker/mongo/data`、`docker/redis/data`）；**全程禁 `--remove-orphans`** 防误删 db/cache 容器。
> 3. **防漂移闸保证 recreate 不跳版**（同文首镜像纪律）——不跳版 = 不引入新 migration = 不动数据。
> 4. **api↔mongo 连接全程不中断**：`network connect/disconnect` 只加/减 caddy-net，api 始终保留 `faynosync-prod` 网；recreate 后断言 api 的 networks 含 `faynosync-prod`（mongo 可达）。
>
> **验证闸**：Step0 mongodump 成功且可读（`mongorestore --dryRun` 或校验 dump 大小/集合数）；recreate 后 api `/health` 200 且能读写 mongo（业务冒烟：一次只读查询命中数据）；db/cache 容器 id 与迁移前一致（未被重建）。任一不满足即**中止/回滚**（必要时用 dump 还原）。

## 一、目标与不做

### 目标
1. 把 Caddy 从 app 项目目录 `/ttpos-releases/` 挪到独立 infra 目录 `/opt/caddy/`（与 staging 对称）。
2. **反转网络所有权**：Caddy 拥有 `caddy-net`，app compose 以 external 接入（现状相反：app 建 `ttpos-releases_faynosync-prod`、Caddy 借用）。
3. 主机整份 Caddyfile 收归 infra（`/opt/caddy/Caddyfile`：全局块 + 本项目站点片段 + aitrans vhost）；仓库只贡献 `deploy/Caddyfile` 站点片段，由 `migrate-caddy-shortlinks.sh` 派生 prod 形态。
4. Caddy 上游从服务别名（`api:9000`/`dashboard:3000`）改为 **container_name**（`faynosync-prod-api:9000`/`faynosync-prod-dashboard:3000`）。

### 明确不做（零触碰边界）
- **不动 mongo/redis 数据卷**（`docker/mongo/data`、`docker/redis/data`），db/cache 容器不重建（🔴 数据安全红线，并 Step0 先 mongodump 兜底）。
- **不改 aitrans 项目**：`aitrans-ai-translator-1`（发布 `0.0.0.0:8005`，独立 docker0 网络）容器/compose/端口零触碰；Caddyfile 里 `http://aitrans.ttpos.com → 172.17.0.1:8005` vhost **逐字保留**。
- **不动 staging**（已是参考实现）。
- **不改 /dl 短链契约、/mcp 行为、公开 API 路径**（prod 当前无 /mcp、无 mcp 服务，派生 `--mcp-upstream none`）。
- **不重写历史文档**。
- **本次不切镜像**（`faynosync-*:latest` → `ttpos-*:latest` 见开放决策 1，默认延后）。

### 已核实 prod ground truth（Architect + Critic 双实测）
- app compose `/ttpos-releases/docker-compose.yml`：nginx(已 Exited，rollback 锚)/api/dashboard/db(mongo7)/cache(redis7)，**均带 container_name** `faynosync-prod-*`；api/dashboard 仅 expose；网络 `faynosync-prod`(bridge)，实名 `ttpos-releases_faynosync-prod`(172.18.0.0/16)。api 挂 `docker/api/short-latest.json` + `SHORT_LATEST_CONFIG`。
- caddy compose `/ttpos-releases/docker-compose.caddy.yml`：`faynosync-prod-caddy`(caddy:2.11.4-alpine)，发布 host:80，挂 `./docker/caddy/Caddyfile:ro`，external 借用 `ttpos-releases_faynosync-prod`。
- 主机 Caddyfile `/ttpos-releases/docker/caddy/Caddyfile`（全局 `{auto_https off}`）：`releases.ttpos.com→dashboard:3000`；`update.ttpos.com`（1GB body + /dl map 15 条 + `api:9000`）；`aitrans.ttpos.com→172.17.0.1:8005`。无 /mcp。
- host:80 由 `faynosync-prod-caddy` docker-proxy 持有；nginx 已 Exited(0)。
- **PLAN-035 fail-closed 无冲突（已实测）**：`DEPLOYMENT_OWNER=ttpos` 写在 `.env`（api 服务 `env_file: -.env`），任何 recreate 都重新注入，启动检查通过；running image sha == 本地 `:latest`（当前一致，可漂移 → 防漂移闸）。
- 现成运维备注 `/ttpos-releases/PROD-CADDY-API-NOTE.md`：含 rollback 路径、冒烟脚本、rollback API 镜像 tag，明令「禁 `--remove-orphans`、勿删 nginx、勿删 short-latest.json」——已吸收。

## 二、网络反转切法（crux）—— Option A

新建独立**裸名** `caddy-net` + app 以 external 接入 + Caddy 上游改 container_name。（Option B 原地搬网络定义因 docker 不支持改 owner/name → 须销毁重建网络 → 全栈含 db/cache 停机重连、违背数据面零触碰，落选。）

### caddy-net 命名前缀陷阱（务必定死）
compose 自建网络会加**项目名前缀**：若让 `/opt/caddy` compose 自己定义 `networks: caddy-net:`，实名会成 `caddy_caddy-net`，而 app 的 `external: caddy-net` 按字面找不到 → 全站 502。staging 靠「裸名 + 两侧 external」规避。prod 定死：
1. **带外裸名创建**：`docker network create caddy-net`（或 compose 显式 `networks: {caddy-net: {name: caddy-net}}` 钉死实名）。
2. app compose 引用 `caddy-net: {external: true, name: caddy-net}`（`name` 显式）。
3. **Step1→Step2 之间硬断言**：`docker network ls --format '{{.Name}}' | grep -xw caddy-net` 精确命中裸名才往下（`-x` 全行匹配，排除 `caddy_caddy-net`），否则中止修正。

### 上游为何必须改名
现状 Caddy 借用 app 建的网、靠 compose 服务别名 `api`/`dashboard` 解析。反转后 Caddy 在新 `caddy-net` 上无这些别名，改用 container_name（app 容器接入 caddy-net 后，container_name 在其接入的每个网络上均可 DNS 解析）——与 staging 对称、不依赖 compose 项目别名行为。

### 容器重建矩阵
| 容器 | 是否重建 | 说明 |
|---|---|---|
| faynosync-prod-db / cache | 否 | 数据面不触碰 |
| faynosync-prod-api / dashboard | **本次重建一次固化**（用户拍板：一次性做完，接受短暂空窗） | 先 Step2 在线 connect 保 runtime → 改 compose 声明 caddy-net → 低峰逐容器 recreate 固化；过防漂移闸（镜像**不跳版**、仍 faynosync-*） |
| faynosync-prod-caddy（旧） | 停止+移除 | 让出 host:80 |
| /opt/caddy 新 caddy | 新建 | 接裸名 caddy-net、挂主机整份 Caddyfile、绑 host:80 |
| faynosync-prod-nginx | 否 | 保留为 rollback 锚 |

### 固化裁断（用户拍板：一次性做完，不走延后）
用户接受短暂空窗、要求本次一次性把迁移做干净、不留「文件改了没生效」的过渡尾巴。**故本次即完成完整固化**：Step2 在线 connect 保 runtime → Step4 改对 app compose（`caddy-net: {external:true, name:caddy-net}` + api/dashboard 双网）→ **本次低峰逐容器 recreate api/dashboard**，让声明态==运行态当场对齐。这是 Critic 已评估过的「codify now」分支（架构等价、SOUND），非新方案；换来的是无过渡态、无防漂移闸长期悬挂、无跨任务交接。
- 空窗代价：api/dashboard 各一次 recreate 秒级空窗（与 host:80 交接同一低峰窗口内完成，见 downtime 预算）。
- **镜像不跳版**：recreate 仍用当前冻结的 `faynosync-*`（不切 ttpos-*，见开放决策①），防漂移闸（三-Step4）确保 recreate 不偷换版本。
- 与 PLAN-036 解耦：本次自足完成，不依赖也不等待 PLAN-036；镜像解冻是独立任务。

### host:80 交接与 downtime 预算（本次一次性完成，两类空窗都在同一低峰窗口）
| 空窗 | 何时 | 大小 | 处置 |
|---|---|---|---|
| host:80 交接 | Step3 | 目标 < 15s | 低峰执行 |
| api/dashboard recreate | Step4（本次逐容器固化） | 每容器秒级 | 逐个 recreate、过防漂移闸；与 Step3 同一低峰窗口 |

整体低峰窗口预留 ~5-10 分钟含验证+回滚待命；db/cache 全程在线不触碰；Step0/1/2/5 零停机。降停机 tactic：`docker network connect` 是在线操作不重启容器，先零停机预接入验证解析，再翻 host:80，最后 recreate 固化。

### Caddyfile 派生 + 逐字保留
由 `deploy/Caddyfile` 经脚本对「scp 下来的真实主机 Caddyfile 副本」派生。**脚本每次只重写一个 `--site`**，releases 需第二遍链式调用（第二遍 `--target` 必须链到第一遍 `--output`，否则覆盖丢 update 结果）：

```bash
# 第一遍：update 块
migrate-caddy-shortlinks.sh --source-site update.ttpos.dev --site http://update.ttpos.com \
  --target tmp/prod-host.Caddyfile --output tmp/prod-host.step1.Caddyfile \
  --api-upstream faynosync-prod-api:9000 --dashboard-upstream faynosync-prod-dashboard:3000 \
  --mcp-upstream none --validate none
# 第二遍：releases 块，--target 链到第一遍 --output
migrate-caddy-shortlinks.sh --source-site releases.ttpos.dev --site http://releases.ttpos.com \
  --target tmp/prod-host.step1.Caddyfile --output tmp/prod-host.final.Caddyfile \
  --dashboard-upstream faynosync-prod-dashboard:3000 --validate none
```

- **逐字保留**：`{auto_https off}` 全局块（🔴 红线，见硬约束）、三个站点的 `http://` 前缀（🔴 红线）、`/dl` map 15 条、`request_body max_size 1GB`、`aitrans.ttpos.com→172.17.0.1:8005`（aitrans 纯手工搬、grep 复核）。
- **diff gate（含证书红线断言）**：`diff tmp/prod-host.final.Caddyfile <(原始主机副本)` 逐行核，与线上仅两处上游主机名（api/dashboard container_name）不同，其余零漂移；额外硬断言 `grep -qx '\tauto_https off' 最终文件`（全局块在）、`grep -c '^http://' 最终文件` == 3（三站 http:// 前缀在）；releases 上游 `dashboard:3000→faynosync-prod-dashboard:3000` 单独 diff 核。任一断言失败即中止（防证书重签）。

### 死 nginx
**保留不动**（PROD-CADDY-API-NOTE 明列的 rollback 锚）。清理属正交动作、留 follow-up；**全程禁 `--remove-orphans`** 防误删。

## 三、分步骤（每步独立验证 + 回滚）

> 备份产物统一放 `/ttpos-releases/backups/caddy-migration-<UTC>/`。

**Step 0 — 备份与预检（无变更；🔴 mongodump 是进 Step4 的前置闸）**
- **🔴 `mongodump` 备份 prod mongo**（落 `backups/caddy-migration-<UTC>/mongo/`），校验 dump 非空/集合数合理；**没有这份可用备份，不许进 Step4 recreate**。redis 是缓存、可重建，不强制备份。
- 备份 compose×2、主机 Caddyfile、`docker network inspect ttpos-releases_faynosync-prod`、`docker ps`（记录 db/cache 容器 id 作「未被重建」比对基线）、`.env` 中 CADDY/端口项。
- **从 prod compose 读 api/dashboard 实际 image ref**（喂给防漂移闸；prod 大概率是本地 `faynosync-server:latest` / `faynosync-dashboard-next:latest`，非 ghcr——不要写死 ghcr）：`API_REF=$(docker inspect -f '{{.Config.Image}}' faynosync-prod-api)`、`DASH_REF=$(docker inspect -f '{{.Config.Image}}' faynosync-prod-dashboard)`，存档。
- 记录基线：host:80 归属、5 容器网络成员/IP、公网 5 路当前返回码。回滚：无（只读）。

**Step 1 — 建 infra 目录 + 裸名 caddy-net（不碰 host:80）**
- 建 `/opt/caddy/`：独立 compose（`caddy-net: {external:true, name:caddy-net}`，与 staging 逐字对齐）+ 主机整份 Caddyfile（全局 + 派生 releases/update + 逐字 aitrans）。
- `docker network create caddy-net`；不启动绑 80 的容器，先 `caddy validate`。
- **命名硬断言**：`docker network ls --format '{{.Name}}' | grep -xw caddy-net` 精确命中裸名才往下。
- 验证：`caddy validate` 通过 + 网络实名精确 `caddy-net`。回滚：`docker network rm caddy-net` + 删目录，线上无影响。

**Step 2 — app 容器在线接入 caddy-net（零停机预接入）**
- `docker network connect caddy-net faynosync-prod-api`；`... faynosync-prod-dashboard`（在线不重启）。
- 验证：从挂在 caddy-net 的临时容器 `getent hosts faynosync-prod-api` / `curl faynosync-prod-api:9000/health` 解析连通；`curl 172.17.0.1:8005`（aitrans 网关可达预检，Architect 已预验今天 404 存活）。
- 回滚：`docker network disconnect caddy-net faynosync-prod-{api,dashboard}`。

**Step 3 — host:80 交接（本次唯一即时空窗，低峰）**
- 预拉 caddy 镜像 + `caddy validate` 目标 Caddyfile。
- `cd /ttpos-releases && docker compose -f docker-compose.caddy.yml down` → `ss -ltnp | grep ':80 '` 确认 80 已释放 → `cd /opt/caddy && docker compose up -d`（新 caddy 绑 80、接 caddy-net、按 container_name 反代）。
- 验证：host:80 归新容器 + 公网 5 路冒烟（第四节）全绿。
- 回滚：`cd /opt/caddy && docker compose down` → `cd /ttpos-releases && docker compose -f docker-compose.caddy.yml up -d`（旧 caddy 复位，app 容器仍在旧网 `faynosync-prod` 上、服务别名仍解析，旧 Caddyfile 立即可用）。

**Step 4 — 改对 compose + 本次 recreate 固化（低峰，与 Step3 同窗口）**
- 改 `/ttpos-releases/docker-compose.yml`：api/dashboard 增 `networks: [faynosync-prod, caddy-net]`，文件尾增 `caddy-net: {external:true, name:caddy-net}`。
- **config 校验闸前置（顺序硬化，必须在 recreate 之前）**：`cd /ttpos-releases && docker compose config` 断言 api/dashboard 均含 `caddy-net`、顶层 `caddy-net` external 声明存在、无告警——通过才允许 recreate。
- **防漂移闸（recreate 前必过，镜像不跳版）**：
  ```bash
  # ref 从 Step0 存档取（name-agnostic，勿写死 ghcr）
  RUN_API=$(docker inspect -f '{{.Image}}' faynosync-prod-api)
  IMG_API=$(docker image inspect -f '{{.Id}}' "$API_REF")   # API_REF 来自 Step0
  [ "$RUN_API" = "$IMG_API" ] || { echo "ABORT: api image drift"; exit 1; }
  docker tag "$RUN_API" "${API_REF%:*}:migration-$(date -u +%Y%m%dT%H%M%SZ)"   # 不可变本地锚
  # dashboard 同理（faynosync-prod-dashboard / $DASH_REF）
  ```
- **逐容器 recreate 固化**（禁 `--pull`、禁 `--remove-orphans`；一次一个、间隔观察，避免 api/dashboard 同时空窗）：
  ```bash
  docker compose up -d --no-deps --pull never api        # 观察健康 + update 冒烟绿
  docker compose up -d --no-deps --pull never dashboard   # 观察健康 + releases 冒烟绿
  ```
  recreate 后断言：①两容器在 `caddy-net` 上（`docker inspect -f '{{json .NetworkSettings.Networks}}' faynosync-prod-{api,dashboard}` 含 `caddy-net`）**且仍在 `faynosync-prod` 上**（🔴 mongo 可达）；②Caddy 按 container_name 反代仍绿；③api `/health` 200 且业务只读查询命中数据（🔴 数据完好）；④db/cache 容器 id 与 Step0 基线一致（🔴 未被重建）。**注意**：api recreate 会重启进程 → migrate-then-serve 对 mongo 再跑 migration（前置已 mongodump 兜底，且镜像不跳版 = 同一已应用 migration = no-op）+ 触发 PLAN-035 fail-closed（已实测 `DEPLOYMENT_OWNER=ttpos` 在 .env、安全）。
- 验证：config 通过 + 防漂移闸过 + 两容器在 caddy-net + 5 路冒烟绿。回滚：`docker compose up -d --no-deps` 用备份的旧 compose 还原（旧网 + 旧 caddy overlay 仍在）。

**Step 5 — 收尾与文档**
- 更新 `PROD-CADDY-API-NOTE.md`：新拓扑、新 rollback 路径（/opt/caddy ↔ 旧 caddy overlay）、host:80 新归属；把防漂移闸（sha 断言 + 禁 `--pull` + 禁 `--remove-orphans`）写成**任何未来 `compose up` 的常备前置**。
- 旧 `docker-compose.caddy.yml` + `docker/caddy/Caddyfile`：**保留 7 天** rollback 锚，标「已废弃、勿 up」不删；7 天平稳后清理（独立 follow-up）。
- 验证：文档与实际拓扑一致 + aitrans/releases/update//dl 全绿观察一段时间。

## 四、扩展测试计划（四层，DELIBERATE）

- **config**：脚本派生候选比对线上仅上游名不同；目标主机 `docker exec <caddy> caddy validate`；`caddy_config_test.go::TestCaddyShortLatestRouteContract`（`cd apps/server/server && go test`）绿。
- **集成（彩排）**：临时隔离网演练「`docker network create` + `connect` 运行中容器 + container_name 解析 + 跨 bridge 到 172.17.0.1:8005」（Architect 已只读实测等价覆盖，10min dry-run 作廉价保险即可，不需真流量）。
- **e2e（cutover 后经 Cloudflare 公网 5 路）**：`update.ttpos.com/health`→200；`/dl/cashier.apk`→302；`/dl/unknown.apk`→400+`Cache-Control:no-store`；`releases.ttpos.com/`→200；`aitrans.ttpos.com/`→upstream 正常（**手工搬运无自动化兜底，必须经新 caddy 功能冒烟**）。
- **🔴 证书红线（cutover 后立即，任一异常即回滚）**：`docker logs <新caddy>` **零** `certificate`/`acme`/`obtain`/`trying to solve` 字样；`ss -ltnp` 新 caddy **无 :443 监听**；确认无到 `acme-v02.api.letsencrypt.org` 的出站尝试。
- **observability**：容器健康/restart 计数；`ss -ltnp ':80'` 归属新 caddy；/dl 302、/health 200、aitrans 200 持续观察；db/cache healthy 不变。

## 五、开放决策（已由用户拍板 2026-07-05）

1. **是否顺带切镜像** `faynosync-*`→`ttpos-*:latest`。**已决：不切**——用户定性「caddy 只是移动目录」，镜像跳版是另一类风险，留作单独任务；本次 recreate 仍用冻结的 faynosync-*（防漂移闸保不跳版）。
2. **Caddy infra 版本化归宿**。**已决：先 `/opt/caddy` 主机目录 + 手工版本注记**（对称 staging）；独立 repo 作后续正式化。
3. **迁移前彩排**。**已决：做**——迁移前用隔离 throwaway 网 10min dry-run 演练网络反转机制（廉价保险）。
4. **一次性 vs 延后固化**。**已决：一次性做完**（用户接受短暂空窗、要求不留过渡尾巴）——本次即 recreate api/dashboard 固化，不走 PLAN-036 顺风车，与 PLAN-036 解耦。

## 六、RALPLAN-DR 摘要（DELIBERATE）

**Principles**：①数据面零触碰(db/cache 不重建 + Step0 mongodump 兜底) ②无关项目(aitrans)零回归 ③单一事实来源派生(deploy/Caddyfile) ④可回滚优先(旧 caddy overlay/网络/Caddyfile 保留 7 天回滚锚) ⑤与 staging 对称 ⑥🔴 Caddy 零证书签发/重签(用户红线) ⑦🔴 prod mongo 数据确保安全(用户红线)。

**Decision Drivers**：①host:80 单绑下 downtime 最小化 + 低峰 ②上游 DNS 解析正确性(别名→container_name) ③aitrans/Cloudflare 源站不受波及。

**Viable Options**：A（选中，见二节）；B（原地搬网络定义 = 全栈停机 + 网络销毁重建，违背数据面零触碰，落选）；保持借用网络（不解决 owner 反转，违背 PLAN-037 边界）。

**Pre-mortem（6 场景）**：
1. **host:80 双绑 bind 失败** → 严格先 down 旧确认 `ss -ltnp` 释放再 up 新，禁两栈同 publish 80。
2. **上游名解析错 502**（container_name 未接入 caddy-net，**或 caddy-net 被加前缀成 `caddy_caddy-net`**）→ 裸名创建 + `grep -xw` 命名硬断言 + Step2 先 connect 并从临时容器验解析连通再翻 80 + `caddy validate` 双关。
3. **aitrans vhost 丢失/host 网关不可达** → 逐字搬 + grep 复核 + Step2 从 caddy-net 临时容器 `curl 172.17.0.1:8005` 预检（已预验通）；不可达则 `extra_hosts: host-gateway` + `host.docker.internal:8005` 回退。
4. **本次或未来 recreate 偷换镜像版本**（本次 recreate api/dashboard 或任何未来 `compose up` 若带 `--pull`/本地 `:latest` 已漂移，会把冻结 prod 悄悄跳到未验证版本；api 重启还会过 PLAN-035 fail-closed，已配 DEPLOYMENT_OWNER 故安全但不该跳版）→ 防漂移闸（recreate 前硬断言本地 sha==running sha、不等即中止、禁 `--pull`/`--remove-orphans`、先打 `migration-<UTC>` 不可变 tag）；写进 PROD-CADDY-API-NOTE 作**任何未来 `compose up` 的常备前置**。
5. **🔴 Caddy 触发证书签发/重签（用户红线）**：新 Caddyfile 丢了 `{auto_https off}` 全局块、或站点名丢了 `http://` 前缀、或照搬 staging 的 caddy-cf/TLS 配置 → Caddy 默认 auto_https 开，对 releases/update/aitrans 三域发起 ACME 签发，重签证书且可能撞 Let's Encrypt 限流打黑域名。
   - 缓解：见文首🔴硬约束三层保险 + diff gate 的 `auto_https off`/`^http://`×3 硬断言（派生后、cutover 前）；沿用 `caddy:2.11.4-alpine` 只绑 :80、绝不用 caddy-cf；cutover 后立即查 caddy 日志零 ACME 活动 + 无 :443 监听，异常即回滚旧 overlay。
6. **🔴 prod mongo 数据受损（用户红线）**：api recreate 重启 → migrate-then-serve 对 prod mongo 跑 migration；若镜像意外跳版（新 migration）、或 api recreate 后连不上 mongo（丢了 faynosync-prod 网）→ 数据被改/服务读不到数据。
   - 缓解：Step0 `mongodump` 前置兜底（no-op 也留还原点）；防漂移闸保证不跳版（同一已应用 migration = no-op）；db/cache 容器/卷零触碰 + 禁 `--remove-orphans`；`network connect/disconnect` 只动 caddy-net、api 始终在 faynosync-prod 网；recreate 后断言 api 在 faynosync-prod 网 + `/health` 200 + 只读查询命中数据 + db/cache 容器 id 未变；异常即回滚（必要时 `mongorestore`）。
- （附加：Cloudflare 源站探活失败）→ 行为与现状一致(TLS 终止、http 源站)，cutover 后即冒烟，异常即回滚旧 overlay，低峰 + CF 重试吸收空窗。

**ADR**：Decision=Option A（caddy-net owner 反转 + /opt/caddy + container_name，对称 staging），本次一次性 recreate 固化（用户拍板）；Drivers=downtime 最小化/解析稳妥/aitrans 不波及/数据面零触碰/可回滚；Alternatives=B(全栈停机重建网络)/保持借用网络/Synthesis 延后固化(用户否，要求一次做完)；Why=A 用在线 connect 先把 runtime 搭好再翻 80、逐容器 recreate 固化，停机压到 host:80 秒级 + api/dashboard 各秒级、db/cache 不动、回滚锚清晰、终态对称已验证 staging；Consequences=app compose 加 caddy-net external 并本次 recreate 生效（无过渡态）、主机 Caddyfile 收归 /opt/caddy、旧 caddy overlay/网络/Caddyfile 保留 7 天回滚锚、镜像债独立处理；Follow-ups=(a)镜像 faynosync→ttpos 切换独立任务 (b)Caddy infra 独立 repo 版本化 (c)7 天后清理旧 overlay + 死 nginx + short-latest.json。

## 七、执行验证清单（本次一次性完成，无跨任务交接）

- [ ] 🔴 Step0 mongodump 完成且校验可用（没有它不许进 Step4）。
- [ ] 派生 Caddyfile diff gate 过（仅两处上游名变；🔴 `auto_https off` + 三个 `http://` 零漂移）。
- [ ] Step2 后从 caddy-net 临时容器验 container_name 解析 + `curl 172.17.0.1:8005` aitrans 网关可达。
- [ ] Step3 host:80 归新 caddy；🔴 caddy 日志零 ACME、无 :443 监听。
- [ ] Step4 config 校验过 → 防漂移闸过（本地 sha==running sha、已打 `migration-<UTC>` tag、`--pull never`、无 `--remove-orphans`）→ 逐容器 recreate 后两容器在 caddy-net、按 container_name 反代绿。
- [ ] 🔴 recreate 后 api 在 faynosync-prod 网 + `/health` 200 + 只读查询命中数据 + db/cache 容器 id 未变。
- [ ] 公网 5 路冒烟全绿（update/health、/dl 302、/dl unknown 400、releases、aitrans）。
- [ ] PROD-CADDY-API-NOTE 更新新拓扑 + 防漂移闸作常备 `compose up` 前置；旧锚保留 7 天。

## 非目标

- 不碰 prod 数据面（mongo/redis）、不动 aitrans 或任何别的项目、不改 staging。
- 不切镜像（另立任务）、不清死 nginx / short-latest.json（aging 后独立 follow-up）。
- 不改 /dl 契约、/mcp 行为、公开 API 路径。
