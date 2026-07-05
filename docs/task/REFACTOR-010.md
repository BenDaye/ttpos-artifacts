# REFACTOR-010 Caddy 与 app 项目解耦（仓库归位）

- **status**: completed
- **priority**: P2
- **owner**: Claude
- **createdAt**: 2026-07-05
- **related**: PLAN-037, PLAN-035, REFACTOR-007, PLAN-033, ENH-016

## 描述

按 PLAN-037 把「Caddy 配置越界落在 app 项目里」这一违规在**仓库层面**归位：本项目只保留自己贡献给主机 Caddy 的站点片段（`deploy/Caddyfile`）+ app compose（接入外部 `caddy-net`）+ splice 脚本；Caddy 本体、全局配置、网络与别的项目路由（aitrans）一律归主机 infra，从仓库删除。**本次不碰线上 prod 主机**——真正的 prod 主机 Caddy 独立化与网络反转是后续单独授权任务。详见 `docs/plan/PLAN-037.md`。

## 验收

- 删除 `deploy/docker-compose.prod-caddy.yml`（Caddy 栈 = infra）与 `deploy/prod-caddy-base.Caddyfile`（全局块 + aitrans 别项目 + 漂移片段副本）。
- `deploy/Caddyfile` 保留（路径不变，护住 `caddy_config_test.go` 契约），头部补边界说明；prod 形态由 splice 脚本派生，不存第二份。
- `migrate-caddy-shortlinks.sh` usage 去掉以被删文件当 dry-run 目标的示例，改为对抓下来的真实主机 Caddyfile 副本操作。
- AGENTS.md `deploy/` 地图行说明 Caddy 边界。
- gate：`go test ./server/...`（含 `TestCaddyShortLatestRouteContract`）通过；`rg 'prod-caddy-base|docker-compose\.prod-caddy'` 活文件零命中（历史文档保留）；`git diff --check` 干净。

## 批注

- 2026-07-05：范围仅仓库归位，不动线上 prod（用户拍板）。历史文档（PLAN-033/REFACTOR-007/PLAN-035/changelog）对被删文件的引用按惯例不重写。
- 2026-07-05：顺带修复 REFACTOR-009 遗留 bug——`caddy_config_test.go` 读 `../../deploy/Caddyfile`，server 迁 apps/server 后相对层级失效（应为 `../../../`）；因 CI 单测门只跑 `ownership/utils`、不覆盖 `faynoSync/server` 包，该契约测试自迁移起一直静默 FAIL。已修路径。**遗留隐患**：CI 仍不跑该包，契约测试可能再次静默失效——补 `faynoSync/server` 进 CI 单测覆盖宜随 QUAL-004 集成套件容器化一并处理（architect 验证建议，超出本任务范围）。
