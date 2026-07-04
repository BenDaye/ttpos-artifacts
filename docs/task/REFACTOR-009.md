# REFACTOR-009 仓库顶层 monorepo 化（top-level monorepo migration）

- **status**: implemented (pending merge)
- **priority**: P1
- **owner**: Claude
- **createdAt**: 2026-07-04
- **related**: PLAN-036, PLAN-035, QUAL-004

## 描述

按 PLAN-036 把仓库迁为顶层 Bun workspace + Turborepo monorepo：`apps/{web,mcp,server}` + `packages/{config,shared}`，`dashboard-next/` 消失；镜像换新 `ttpos-web/ttpos-mcp/ttpos-server`，发版统一 per-app tag 门控（`web-v*`/`mcp-v*`/`server-v*`）；deploy compose 一次性切换（container_name/Caddy 别名保留 `faynosync-*` 不动）。单分支 `refactor/plan-036-monorepo` 一次性迁移。详见 `docs/plan/PLAN-036.md`。

## 对 spec 的有意偏离（共识评审裁定）

1. **workflow 文件名**：spec 原写「`build-dashboard-next.yaml` 重命名为 `build-web.yaml`」，但该文件名已被 Flutter POS Web 构建（`ttpos-web-menu/mobile/member`）占用，照做会覆盖 Flutter 流水线 → 改名 **`build-dashboard.yaml`**；镜像仍 `ttpos-web`、tag 仍 `web-v*`，命名对齐表不变。
2. **server 验证门**：spec 写「`go test ./...` 通过」，但集成套件（`faynoSync_test.go`、`mongod/*_test.go` 等）依赖 Mongo/Redis/S3，无服务容器必红（PLAN-035 已知缺口）→ `@ttpos/server` 的 `test` 收窄为单元包 `./server/ownership/... ./server/utils/...`（与 CI 完全一致），全量保留在 `test:integration` 逃生口，由 QUAL-004 容器化后升级接入 turbo。

## 验收

- 目录搬家全 `git mv`（386 files 全 rename），`git log --follow` 可追溯。
- 根 workspace + turbo 四门（lint/typecheck/test/build）+ Playwright e2e 全绿；`@ttpos/server` 经薄 package.json 入 turbo（bun.lock 新增空成员条目）。
- 三镜像以新 context 构建成功（web/mcp 根 context + 白名单 .dockerignore + `COPY apps/server/package.json` 补丁；server context `apps/server`）。
- 三工作流 tag 门控闭环：`build-server.yaml` 的 latest 从 `enable=main/release` 翻转为 tag 事件显式 `type=raw`（不翻转则 vm-node02 永远拉不到新 server 镜像）。
- deploy compose 只改 `image:` 三处；`container_name`（faynosync-api/dashboard/mcp）与 Caddy 反代别名（`faynosync-mcp:3010` 等）逐字保留。
- bump-version 改 `--app <web|mcp>` 必填、per-app CHANGELOG、根 version 恒 0.0.0；server 发版纯手动打 tag。
- 文档同步：AGENTS.md（仓库地图/常用命令/发版节）、README、apps/mcp/README、apps/web/CHANGELOG 头。

## 发布 checklist（合并后）

1. 依次打 `server-v*` → `web-v*` → `mcp-v*`，每打一个确认 ghcr 对应 `ttpos-*:latest` 生成再下一个。
2. **硬门**：vm-node02 上三镜像 `docker pull` 全成功后才更新 compose 并 `up -d`；任一失败中止、compose 不动。
3. 冒烟：api 起、dashboard 登录 + 侧边栏版本号、mcp `/healthz`。
4. 回滚：compose 改回 `faynosync-*` 旧镜像名（旧镜像/旧 tag 全程保留）；代码层 `git revert` 合并提交。

## 批注

- 2026-07-04：实施完成。code-reviewer APPROVE（0 阻塞，1 MINOR 已采纳：AGENTS.md 注明未过滤 turbo 命令需本地 Go）；verifier APPROVE（15 项验收 12 VERIFIED、1 PARTIAL、2 已知缺口）。三镜像 staging 实建成功（web/mcp/server 均 EXIT=0）。

- 2026-07-04：实施环境限制——本机（LXC）docker 无法运行容器（runc sysctl 限制），三镜像构建 gate 改在 staging vm-node02 代跑（同为 amd64 部署机，代表性更强）。首跑 server 镜像因 staging 磁盘 98% 满失败（`no space left on device`，非迁移问题），清理 build cache 后重试。
- 2026-07-04：本机无 Go 工具链，为跑 turbo server gate 安装用户态 Go 1.25.5 至 `~/.local/go`（与 go.mod 一致）。
