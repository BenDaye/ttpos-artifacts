# REFACTOR-011 prod 主机 Caddy 独立化迁移

- **status**: completed
- **priority**: P1
- **owner**: Claude
- **createdAt**: 2026-07-05
- **related**: PLAN-038, PLAN-037, REFACTOR-010, PLAN-035

## 描述

按 PLAN-038 在 prod 主机（ttpos-releases）执行 Caddy 独立化迁移：把 Caddy 从 app 项目目录挪到 `/opt/caddy/`、反转网络所有权（Caddy 拥有裸名 `caddy-net`、app external 接入）、上游改 container_name，与 staging 对称。用户拍板一次性做完（含 api/dashboard recreate 固化）、不切镜像。**两条用户红线全程守住**：Caddy 零证书签发/重签、prod mongo 数据确保安全。详见 `docs/plan/PLAN-038.md`。

## 执行结果（2026-07-05）

- **Step0** 备份：compose×2 + Caddyfile + 网络 inspect + 容器基线 + **mongodump（495M 数据、faynosync.apps 290 文档等，dryRun 校验可读）**，落 `/ttpos-releases/backups/caddy-migration-20260705T073000Z/`。公网基线 200/302/400/200/404。
- **Step1** `/opt/caddy`：外科生成新 Caddyfile（复制线上 + 仅改 3 处 reverse_proxy 上游名，diff 证其余零漂移；`{auto_https off}`/`http://`×3/aitrans 逐字保留）；裸名 `caddy-net` 创建 + `grep -xw` 断言；compose（`caddy:2.11.4-alpine`、只绑 :80、无 caddy-cf）；`caddy validate` Valid。
- **Step2** 在线 `network connect` api/dashboard 到 caddy-net（**未重启**），验按 container_name 解析+连通、aitrans 可达、仍在 mongo 网。
- **Step3** host:80 交接（唯一即时空窗）：停旧 caddy（保留作锚）→ 起 /opt/caddy 新 caddy。🔴 日志 `automatic HTTPS is completely disabled`、零 ACME、无 :443。公网 5 路冒烟全绿。
- **Step4** codify + recreate 固化：app compose 行级插入 caddy-net（diff 只增不改，db 仍单网）；防漂移闸（api/dashboard running sha == 本地 :latest，不跳版）+ 打不可变 `migration-20260705T073000Z` tag + `--pull never`/无 `--remove-orphans` 逐容器 recreate；断言两容器在双网、`/health healthy`、**db 容器 id 未变（数据面未触碰）**、fail-closed 放行（DEPLOYMENT_OWNER=ttpos）。
- **Step5** 更新 `PROD-CADDY-API-NOTE.md`（新拓扑/回滚/防漂移常备前置/证书红线）；旧 `docker-compose.caddy.yml` 标废弃、旧 Caddyfile/旧停止容器/mongodump 保留至 **2026-07-12** 作回滚锚。

## 两条红线守住证据

- **证书零重签**：新 caddy 日志 `automatic HTTPS is completely disabled for server` + HTTP/2/3 因需 TLS 被跳过 + 零 ACME/letsencrypt/challenge 关键词 + `ss` 无 :443 监听。Caddyfile diff 证 `{auto_https off}` 与三站 `http://` 零漂移。
- **数据安全**：Step0 mongodump 前置兜底；db/cache 容器全程不重建（id 前后一致）；防漂移闸保证 api recreate 不跳版=同一已应用 migration=no-op；api 全程保留 faynosync-prod 网，recreate 后 `/health healthy` + `/dl` 302（读 mongo 命中数据）。

## 后续（PLAN-038 Follow-ups）

- 镜像 `faynosync-*`→`ttpos-*` 切换（prod 收不到新版的债）——独立任务。
- Caddy infra 独立 repo 版本化。
- 2026-07-12 后清理旧 caddy overlay + 死 nginx + 迁移锚 tag（验证平稳后独立执行）。

## 批注

- 2026-07-05：全程只用 aissh 只读+受控命令操作 prod，先做隔离 throwaway 网 dry-run 验证机制（裸名网络/container_name 解析/aitrans 跨桥/证书红线）全绿，再执行。防漂移闸实测 running sha 与本地 :latest 一致（api e8486d、dash 8995），未跳版。
