# QUAL-004 修复 rotted 集成套件并重塑单 owner 测试

- **status**: pending
- **priority**: P2
- **owner**: 待认领
- **createdAt**: 2026-07-04
- **related**: PLAN-035, REFACTOR-008, PLAN-034(BEST-PRACTICE-01)

## 背景

`server/faynoSync_test.go` 集成套件**先前即已损坏，与 PLAN-035 无关**，在 PLAN-035 的 staging E2E 验证中被意外发现：

- admin 注册测试用密码 `"password"`（纯字母），但 `server/utils/password.go:25` 的 `ValidatePasswordStrength` 要求"字母+数字"，`/signup` 返回 400 → 建不出 admin → 后续用例级联失败并 panic，卡在第一个 signup（`faynoSync_test.go:284`；密码出现在 `:237/:272/:307`）。
- CI（`build-server.yaml`）从不跑集成套件（PLAN-035 前只 build，PLAN-035 起也仅 build/vet/无依赖单测），故该 rot 长期未被发现。
- 跑集成套件需 Mongo + S3：用**丢弃式 mongo:7 + MinIO**，**勿用 staging 真 GCS**。镜像自带 `faynoSync_tests` 二进制（`Dockerfile:8/17`），也可 golang 容器 `go test`。

同时承接 **PLAN-035 延后的单 owner 测试重塑**（因套件卡在 signup 未能进行）。

## 范围

1. **修 pre-existing rot**：admin signup 测试密码改为满足强度校验（如 `password`→`password1`，约 3 处），让套件跑过 signup；逐步修其后暴露的级联失败（未知量，可能不止密码一处）。
2. **单 owner 测试重塑**（PLAN-035 延后项）：`setup()` 已 `ownership.Configure("admin")`；14 个 `Test*WithSecondUser`（第二 admin `administrator`，断言跨-admin 隔离——单 owner 下已不成立，且第二方是 admin 非 team_user、非 RBAC）逐个读 body 判定 删/改写；默认改写为"第二身份坍缩为部署 owner、看到部署命名空间"的新不变量，**不得整批删红**（防误删真实 RBAC 断言）。
3. **新增回归用例**：`latest`/`FetchLatestVersionOfApp` 的 `?owner=GARBAGE` 被忽略（锁死 SECURITY-04；PLAN-035 staging E2E 已用 cache key 证过 owner 被覆盖为 ttpos、GARBAGE 计数=0）；`token.Owner != DEPLOYMENT_OWNER` 仍读写部署命名空间。
4. **CI**：评估把全量 `go test ./...`（集成套件）接入 CI —— 需 Mongo/Redis/S3 服务容器编排；否则显式声明验证方式与缺口。

## 硬性不变量

- 不改生产代码语义；只动测试与（若确有必要）测试数据。是否放宽密码强度校验规则本身**不在本任务**（产品决策，另议）。
- 单 owner 是既定不变量（PLAN-035 已上线 main）；测试须断言它，回退到 per-user 命名空间要响亮失败。
- 团队 RBAC 用例保持绿；不得把真实鉴权断言当"预期 SecondUser 翻车"删掉。
- 测试隔离用丢弃式 mongo + MinIO，**绝不碰 staging/prod 真 mongo/GCS**。

## 验收

- 丢弃式 mongo + MinIO 下 `go test .`（root 集成套件）全绿，逐条记录每个删/改写用例的理由。
- `?owner=GARBAGE` 负向用例存在，且在 SECURITY-04 回归时会红。
- 若接入 CI：新 job 用服务容器跑集成套件并绿；否则说明验证方式与剩余缺口。
