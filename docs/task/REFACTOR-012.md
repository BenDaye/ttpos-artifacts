# REFACTOR-012 prod 镜像解冻（faynosync-* → ttpos-*）

- **status**: completed
- **priority**: P1
- **owner**: Claude
- **createdAt**: 2026-07-05
- **related**: PLAN-038, PLAN-036, REFACTOR-011, PLAN-035

## 描述

PLAN-038 Follow-up (a)：把 prod api/dashboard 从 PLAN-036 后就冻结的 `faynosync-*:latest` 解冻到 `ttpos-*:latest`，让 prod 重新跟上发版流水线（此前 CI 只推 ttpos-*，prod 拉旧 faynosync-* 收不到新版）。

## 关键发现

- 冻结的 `faynosync-server:latest` 实为 **2026-07-02 build（revision `3aa9a83b`），在 PLAN-035 单租户焊死之前**——即 **prod 此前实际仍跑 pre-lockdown 镜像**（REFACTOR-008 曾记「prod 下次部署安全」，本次才真正把 PLAN-035 部署到 prod）。DEPLOYMENT_OWNER=ttpos 已配、fail-closed 放行。
- 冻结版 `3aa9a83b` → 解冻版 `d489c40` 之间，数据层（mongod/migration/index）唯一改动是纯目录 rename（459dbe4，R100 零内容变更）——**无新 migration**。区间含 PLAN-035（server 逻辑变但不动数据）+ PLAN-036（结构 rename）。

## 执行结果（2026-07-05）

- 解冻前全新 mongodump（`backups/image-unfreeze-20260705T074432Z/`，dryRun 校验可读）+ 备份 compose。
- compose 换镜像名（diff 只 2 处 image 行，config 有效）；新镜像打 immutable prod 锚 `ttpos-{server,web}:prod-20260705T074432Z`；旧 faynosync-* 镜像留作回滚。
- 逐容器 recreate（`--pull never`、`--no-deps`、无 `--remove-orphans`）：api→ttpos-server:latest（sha 68b8d4）、dashboard→ttpos-web:latest（sha dcf35a2b）。
- **数据红线守住**：api 启动日志 `Migrations not applied`（no-op）；db 容器 id 未变；`/dl/cashier.apk` 302 命中真实数据 `TTPOS-2.25.5.apk`（新 lockdown 代码下单 owner 查询正常）。
- fail-closed 放行（DEPLOYMENT_OWNER=ttpos）。公网 5 路冒烟全绿（200/302/400/200/404）。Caddy 未触碰，证书红线不受影响。

## 当前 prod 状态

- api=`ttpos-server:latest`(68b8d4)、dashboard=`ttpos-web:latest`(dcf35a2b)，**已解冻、跟踪 ttpos-*:latest**（CI 发版更新）。
- 回滚：compose image 改回 `faynosync-*:latest`（本地仍在）+ recreate，或 `docker-compose.yml.bak-unfreeze`。

## 后续

- Caddy infra 独立 repo 版本化（PLAN-038 follow-up b）。
- 2026-07-12 后清理旧 caddy overlay + 死 nginx + 迁移锚 tag（含本次旧 faynosync-* 镜像，验证平稳后）。
