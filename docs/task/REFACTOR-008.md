# REFACTOR-008 server 单租户焊死（single-owner lockdown）

- **status**: completed
- **priority**: P1
- **owner**: Claude
- **createdAt**: 2026-07-03
- **related**: PLAN-035, PLAN-032, PLAN-034(SECURITY-04, BEST-PRACTICE-01), REFACTOR-006, QUAL-004

## 描述

按 PLAN-035 把单租户确立为 server 唯一支持模式，删除多租户（多 owner）能力。**保留 `owner` 字段/查询/索引/团队 RBAC/token 路径，无数据迁移**——只删「怎么算 owner 值」的多租户分支。详见 `docs/plan/PLAN-035.md`。

## 验收

- `ownership` 坍缩为单函数 `Owner()`（删 `Enabled/DeploymentOwner/OwnerOrUsername/ResolveOwner` 双模式 + db 参 + 无用 import），16 个调用点统一。
- `latest.go` 无条件用部署 owner → 结构性闭合 PLAN-034 SECURITY-04（客户端 `?owner=` 不进查询/缓存键）。
- `server.go` 引导期豁免 fail-closed 守卫：有 admin 时 `DEPLOYMENT_OWNER` 必填、不配拒启动；空库首启放行。
- CI `build-server.yaml` 加 go build/vet/单测门（闭合 PLAN-034 BEST-PRACTICE-01）。
- 本地 gate + 独立 Opus 评审 APPROVE + staging E2E（bootstrap 放行 / fail-closed 拒启 exit=1 / normal 过守卫 / `owner=GARBAGE` 覆盖）全过。

## 批注

- 2026-07-03：过程中拦下一个会炸 prod 的坑——计划原含 migration `os.Exit(0)` 早退，但 `Dockerfile:19` 是 `CMD ["faynoSync","--migration"]`（migrate-then-serve），早退会让 prod 服务永不启动；引导期豁免已覆盖全新库场景，故撤销早退。
- 2026-07-04：PR #27 合并 main（merge `7f8a8e8`），CI 重建 `:latest`（含单 owner 代码）。prod(ttpos-releases)/staging(vm-node02) 均已 `DEPLOYMENT_OWNER=ttpos`，下次部署安全。
- 2026-07-04：集成套件 `WithSecondUser` 重塑 + `owner=GARBAGE`/token 回归用例，因发现套件 pre-existing rot（密码强度）转 QUAL-004。
