# PLAN-037 Caddy 与 app 项目解耦：仓库归位 + 目标态设计

- **status**: draft（设计已与用户逐段确认，待写实施计划）
- **task**: 待立（实施阶段立 REFACTOR-010）
- **createdAt**: 2026-07-05
- **mode**: DELIBERATE（触碰部署边界与反代契约认知，但本次仅动仓库、不碰线上 prod）
- **决策方式**: brainstorming 逐问收敛（范围、prod 片段去留、片段组织、caddy 栈处置均由用户逐项拍板）
- **关联**: 承接 PLAN-035（server 单 owner，vm-node02/prod 部署）；触碰 REFACTOR-007（/dl 短链迁 Caddy）、PLAN-033、ENH-016（MCP 经 Caddy /mcp）的部署产物认知；prod 主机实际迁移另立后续任务

## 背景与动机

用户观察：**prod 上 Caddy 已作为顶层反代接管流量，但 Caddy 的配置却落在了本项目（ttpos-artifacts）里，违背设计**。正确的边界应是——Caddy 是独立 infra，不受任何项目干扰；项目只作为**网络成员接入**，至多向 Caddy 贡献自己的站点片段。staging（vm-node02）已经严格照此实现，prod 没有。

### 已核实事实（两台机器 + 仓库三方比对）

**staging（vm-node02，符合目标设计）：**
- Caddy 是独立栈，住 `/opt/caddy/`，**自己拥有** `caddy-net` 网络、自己的整份 `/opt/caddy/Caddyfile`（含全局配置）。
- app 项目 `docker-compose.yml` 把 `caddy-net` 声明为 `external: true`，只是**接入**；Caddy 按容器名反代 `faynosync-api/dashboard/mcp`。
- 仓库 `deploy/Caddyfile` 只是 app 自己的**站点片段**（无全局块），注释写明「追加到 `/opt/caddy/Caddyfile` 后 reload」。

**prod（ttpos-releases，违背设计，网络所有权反转）：**
- Caddy 栈住在 **app 项目目录内** `/ttpos-releases/`（`docker-compose.caddy.yml`），其网络 `ttpos-releases_faynosync-prod` **由 app compose 创建**，Caddy 反过来 external 接入它——与 staging 正好相反。
- Caddy 整份 Caddyfile 在 `/ttpos-releases/docker/caddy/Caddyfile`（app 项目内）。
- 仓库 `deploy/` 扛着 `docker-compose.prod-caddy.yml`（整个 Caddy 栈，md5 == prod 线上 `docker-compose.caddy.yml`）+ `prod-caddy-base.Caddyfile`（Caddy 全局块 `auto_https off` + `aitrans.ttpos.com → 172.17.0.1:8005` 这个**无关项目**的路由 + 一份漂移失真的我们片段副本；仓库 22 行 vs prod 线上 69 行）。

**现成护栏（反证「单一权威片段」正确）：**
- `apps/server/server/caddy_config_test.go::TestCaddyShortLatestRouteContract` 直接读 `../../deploy/Caddyfile`，断言 `/dl` map（15 条 alias→app/platform/arch/pkg）、`/mcp` 与 `/dl` handle 顺序、上游 `faynosync-api:9000`。代码里已把 `deploy/Caddyfile` 当作 `/dl` 短链契约的唯一事实来源。
- `deploy/scripts/migrate-caddy-shortlinks.sh` 的机制本身即目标设计：把 app 站点片段（`deploy/Caddyfile`，默认 `--source`）splice 进一份主机自己拥有的 Caddyfile（`/opt/caddy/Caddyfile`，默认 `--target`），并带 `--api-upstream`/`--dashboard-upstream`/`--mcp-upstream none` 把 staging 片段派生成 prod 形态。

## 边界原则

**属于本项目仓库的**，只有一份**站点片段**：仅含本项目自己的 vhost/route 块（`releases`、`update`、`/dl` 短链 map、`/mcp`），reverse_proxy 到本项目自己的容器。**不含任何全局配置，不含任何别的项目。**

**属于 infra、不进本仓库的**：Caddy 的 compose/生命周期、Caddy 全局配置（`auto_https off` 等）、主机 Caddyfile 的整体拼装、别的项目的 vhost（aitrans）、以及**网络本身**（Caddy 拥有网络，项目只接入）。

## 本次范围（用户拍板）

**仓库归位 + 目标态设计，不碰线上 prod 主机。** 真正的 prod 主机迁移（把 Caddy 挪出 app 目录、反转网络所有权、动到 aitrans 活路由）是另一个高风险、单独授权的后续任务。

## 目标仓库 `deploy/` 形态

| 文件 | 处置 | 理由 |
|---|---|---|
| `deploy/docker-compose.prod-caddy.yml` | **删除** | Caddy 栈是 infra，不该由 app 仓库定义；prod 主机保留其工作副本，Caddy 的版本化归宿由后续迁移任务解决 |
| `deploy/prod-caddy-base.Caddyfile` | **删除** | 全局块 + aitrans 别项目路由 + 漂移失真的我们片段副本，无一是我们的 |
| `deploy/Caddyfile` | **保留，路径不变** | 唯一权威站点片段；prod 形态由脚本派生。路径不动以免破坏 `caddy_config_test.go` 硬编码；文件头补注释说明「本项目贡献给主机 Caddy 的站点片段，主机拥有 Caddy 与全局配置」 |
| `deploy/scripts/migrate-caddy-shortlinks.sh` | **机制不动，改 usage** | 删掉以待删的 `prod-caddy-base.Caddyfile` 当 dry-run 目标的示例，改为对「抓下来的真实主机 Caddyfile 副本」dry-run |
| `deploy/docker-compose.yml` | **不动** | 已正确：接入 external `caddy-net`，是 staging 参考实现 |
| `caddy_config_test.go` | **不动** | `deploy/Caddyfile` 路径不变即无需改，作单一事实来源护栏 |

**「与 staging 对称」的真义**：一个源（`deploy/Caddyfile`），两个环境——prod 站点块由 migrate 脚本带参派生（`--site http://update.ttpos.com --api-upstream <prod api> --dashboard-upstream <prod dashboard> --mcp-upstream none/…`），而非在仓库存第二份易漂移的文件。

## 目标 prod 主机形态（北极星，本次不执行）

```
                 现状 prod（违规）                        目标 prod（= staging 模式）
Caddy 住哪       /ttpos-releases/ 内（app 项目里）        独立 infra 目录（如 /opt/caddy）
网络谁拥有       app 建 faynosync-prod，Caddy 反接入      Caddy 拥有 caddy-net，app external 接入
Caddyfile 谁的   /ttpos-releases/docker/caddy/（app 里）  主机自己的（全局 + splice 我们片段 + aitrans 等）
项目职责         定义 Caddy + 别项目路由                   只接入网络 + 贡献自己的站点片段
```

crux 风险（留给后续任务）：**网络所有权反转**——现状 app 建网、Caddy 接入；目标 Caddy 建网、app 接入。切换要动到线上活路由（含无关的 aitrans），需备份 + 低峰窗口 + 单独授权。

## 活引用同步

- `deploy/scripts/migrate-caddy-shortlinks.sh` usage 示例（移除对 `prod-caddy-base.Caddyfile` 的引用）。
- 视需要在 AGENTS.md「仓库地图」`deploy/` 一行补一句边界说明（Caddy 归 infra，本仓库只贡献站点片段）。
- **历史文档不改**：PLAN-033、REFACTOR-007、PLAN-035、`docs/changelog.md` 中对两个待删文件的引用是历史记录，按项目惯例不重写历史。

## 验证 gate

- 删除后 `apps/server/server` 下 `go test`（含 `TestCaddyShortLatestRouteContract`）通过——证明 `deploy/Caddyfile` 契约未被波及。
- `rg 'prod-caddy-base|docker-compose\.prod-caddy'` 在**活文件**（脚本、AGENTS、README、CI）中清零；历史文档命中属预期保留。
- migrate 脚本 `--validate none` 干跑（对着一份真实主机 Caddyfile 副本或 `deploy/Caddyfile` 自身 `--target`）仍能生成候选、不报错。
- `git diff --check`；确认无越界删除（prod 主机文件、aitrans、别项目零触碰——本次只动仓库 `deploy/`）。

## 非目标

- 不碰线上 prod 主机、不动 aitrans 或任何别的项目。
- 不改 staging 现状（它已是参考实现）。
- 不重写历史文档。
- 不做 prod 主机 Caddy 重新布局与网络反转（= 后续任务 REFACTOR-011 或同级，单独授权）。
- 不改 `/dl` 短链契约、`/mcp` 路由行为、公开 API 路径。

## 后续任务（本 spec 之外）

- **prod 主机 Caddy 独立化迁移**：把 Caddy 挪出 `/ttpos-releases/`、建独立 infra 目录、反转网络所有权（Caddy 拥有网络、app 接入）、主机 Caddyfile 收归主机。高风险、需备份 + 低峰窗口 + 明确授权。
- **Caddy infra 的版本化归宿**：为 Caddy 栈 + 主机 base Caddyfile 找一个独立于任何 app 项目的版本化位置（独立 repo 或 infra 目录），承接本次从 app 仓库删掉的 `docker-compose.prod-caddy.yml`。
