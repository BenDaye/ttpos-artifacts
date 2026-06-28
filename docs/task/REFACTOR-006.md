# REFACTOR-006 owner 收敛为部署单例（single-owner mode）

- **status**: deployed（已合并 main #23；vm-node02 + prod 均 mode-on(`DEPLOYMENT_OWNER=ttpos`)，端到端验证通过）
- **priority**: P1
- **owner**: (未分配)
- **createdAt**: 2026-06-28
- **related**: PLAN-032、REFACTOR-005（短链 shortlink 包）、ENH-007/008（短链演进）、BUG-015（CI 上传语义）；`8d72131`（seed owner 非确定性修复）

## 描述

`/dl` 短链固定 owner，artifact 由非该 owner 的凭据上传时短链 404。根因是 FaynoSync 的 `owner` 把「身份/权限」与「命名空间」缝在一起，而本部署是单 owner，导致"命名空间"被当成逐请求变量在十余处各自推导、语义还不一致（upload team-aware、create/catalog 不解析 team、公开读信任客户端、短链/seed/CMS 各一份硬编码）。

本任务从源头把 owner 收敛为「部署单例」：新增 `ownership` 包提供 `ResolveOwner`（带请求上下文）与 `DeploymentOwner`（无上下文）两个唯一出口，所有 owner 取值点改为调用它们；身份退化为只管权限。详见 PLAN-032。

## 硬性不变量

- `DEPLOYMENT_OWNER` 不设 = 模式关 = 上游多租户行为逐字保留，`go test ./...` 全绿。
- 短链已发布 URL 字节契约（`/dl/cashier.apk` 等）不变。
- 不动 TUF；新代码不硬编码 `ttpos`，全配置驱动。

## 验收

- `ownership` 两出口落地，owner 散落点全部改写为调用它们，无遗留自有推导。
- `DEPLOYMENT_OWNER` 校验：非 admin / 与 SEED_OWNER 冲突 → fatal；未设 → 回退。
- 单测覆盖两模式、fatal 用例、短链 owner 可选、公开读覆盖。
- vm-node02 端到端：单例下短链命中、非单例身份上传落单例、dashboard/CMS/自动更新一致。

## 遗留 follow-up（独立任务）

- `token/*`（create/list/delete）的 owner-scope 仍按 caller username 取，未收敛进 ownership 包。属既有问题、不回归本次路径；但在 mode-on 下若由 team_user 或"username≠DEPLOYMENT_OWNER 的 admin"创建 token，`validateAllowedApps` 会按错 owner 查 apps_meta 而拒绝合法 allowed_apps。prod 当前 admin 即 `ttpos`=`DEPLOYMENT_OWNER`，工作正常。需要时单独评估 token 管理作用域（per-user vs per-deployment）再收敛。

## 批注

- 2026-06-28：由 superpowers brainstorming 产出设计 PLAN-032；前身"上传端 fail-closed 护栏"方案因会在 owner 逻辑上再堆判断且有死锁风险被取代。
- 2026-06-28：实现完成于 branch `refactor/single-owner-mode`；go build/vet/包测试通过，security + code 两 reviewer 均 APPROVE（0 Critical/High）。
- 2026-06-28：合并 main（PR #23）→ CI 出 `:latest`；vm-node02 端到端验证通过后，prod 两段式部署翻 mode-on（`.env` `DEPLOYMENT_OWNER=ttpos`），api 健康、owner 覆盖生效；vm-node02 与 prod 均 `:latest`+mode-on。回滚=删 `.env` 的 DEPLOYMENT_OWNER 重建。status 转 deployed。
