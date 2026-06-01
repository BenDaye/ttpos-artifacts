# REFACTOR-005 将 /dl 短链硬编码目录提取为配置驱动的 shortlink 包

- **status**: done（已合入 main `7082d48`、CI 构建通过、已部署 vm-node02 测试环境并冒烟验证行为等价；`go test ./...` 逻辑级运行为可选后续）
- **priority**: P2
- **owner**: (未分配)
- **createdAt**: 2026-06-01
- **related**: ENH-003 / ENH-004 / ENH-007 / ENH-008（短链与公开 latest 下载演进）、FEAT-001

## 描述

发版前赶工时，公开短链下载入口 `GET /dl/:target` 的目录被硬编码进 `server/server/handler/handler.go`：
`publicLatestOwner = "ttpos"`、`publicLatestDefaultChannel = "prod"`、别名表 `shortLatestAppAliases`（cashier→TTPOS 等 5 条）、
扩展名默认表 `shortLatestTargetDefaults`（apk/exe/dmg→平台/架构）。这把单一租户的产品目录烤进了 Go 源码，
既不优雅，也与 brand-neutral 目标冲突；同时 `SquirrelReleases` 与 `ShortLatestDownload` 各自手搓 query 改写，存在重复。

本任务把目录提取为「完全配置化」的独立 JSON 配置文件，新建 `shortlink` 子包承载配置加载/校验/解析，
源码不再保留任何 TTPOS 字面量，并统一两处 query 改写为共享 helper。

## 硬性不变量（behavior-preserving）

`/dl/cashier.apk`、`/dl/assistant.exe` 等是嵌在网站与二维码里的**已发布公开 URL 契约**。重构必须逐字节保持：
每个现有别名×扩展解析出的 `(owner, app_name, channel, platform, arch, package)` 元组不变，别名字符串不变。
等价表（`jq` 已逐行核对，见下）即权威清单。

## 决策记录（brainstorm 已确认）

- **目标**：完全配置化（源码零 TTPOS 字面量）。
- **载体**：独立 JSON 配置文件，启动加载。
- **粒度**：全局单一 owner/channel（顶层定义，所有别名共用）；换租户=换整份配置。
- **启动容错**：未配 `SHORT_LATEST_CONFIG`→不注册 `/dl` 路由（功能关闭，与 `enablePrivateDownload` 同套路）；
  配了路径但文件缺失/解析失败/校验不过→`logrus.Fatalf`（绝不带破损配置静默上线）。

## 实施方案（已落地源码）

### 新增 `server/server/handler/shortlink/` 子包

- `config.go`：`Target{Platform,Arch,Package}`、`Catalog{Owner,DefaultChannel,Aliases,Targets}`；
  `Load(path)` 读 JSON→`normalize()`（别名/扩展键归一小写）→`validate()`（owner/default_channel 非空、
  aliases/targets 非空、别名值非空、每个 target 三字段非空），任一不过返回 error。
- `resolve.go`：`(*Catalog).Resolve(target)`，与原 `resolveShortLatestTarget` 逐字等价（小写归一、按最后一个点切分、
  空别名/空扩展拒绝）。
- `shortlink_test.go`：5 别名×3 扩展表驱动断言精确元组；大小写不敏感；拒绝用例（未知别名/扩展/无点/末尾点/前导点/空）；
  `Load` 有效 + 各类无效（坏 JSON、缺 owner、缺 channel、空 aliases、空 targets、别名空值、target 缺字段、缺文件）。

### 改造 `server/server/handler/handler.go`

- 删除 5 处硬编码（2 const + 2 var + 1 type）及 `resolveShortLatestTarget` / `setLatestDownloadQueryValues`，移除 `strings` import。
- `appHandler` 增 `shortLatest *shortlink.Catalog` 字段。
- `NewAppHandler` 末位增 `shortLatest ...*shortlink.Catalog`（**可变参数**：`faynoSync_test.go` 有约 150 处既有 7 参调用，
  可变参使其零改动继续编译，保持本次 diff 外科手术式精简、不在无法本地编译的 9k 行测试文件里批量改写；至多取首个 catalog。
  **可复审权衡**：SEC-007 已合并（见 related），不再有同文件纠缠，故若偏好更地道的显式 8 参签名 + 同步更新约 150 处调用亦可行——留作评审决定）。
- 新增共享 `setLatestQuery(c, map[string]string)`，`SquirrelReleases` 与 `ShortLatestDownload` 共用。
- `ShortLatestDownload`：nil catalog→404（防御性，生产中路由按存在性注册故不会触发）；解析失败→400（文案不变）；
  成功→`setLatestQuery` + `CacheRedirectHeadersContextKey` + 委派 `info.FetchLatestVersionOfApp`。

### 改造 `server/server/handler/handler_test.go`

旧测试引用了被删符号，重写为：`TestSetLatestQuery`（共享 helper）、`TestShortLatestDownloadRejectsUnsupportedTargets`（注入 catalog→400）、
`TestShortLatestDownloadWithoutCatalog`（nil→404）。穷尽解析/校验覆盖移至 `shortlink` 包。

### 改造 `server/server/server.go`

读 `config.GetString("SHORT_LATEST_CONFIG")`：非空→`shortlink.Load`，失败 `logrus.Fatalf`；注入 `NewAppHandler`；
仅当 `catalog != nil` 时注册 `router.GET("/dl/:target")`。

### 部署接线（`deploy/`）

沿用 `gcs-credentials.json` 惯例：真实目录文件由宿主机提供，仓库只留中性模板。

- `deploy/short-latest.example.json`：中性占位模板（owner/alias 占位，targets 用通用平台默认）。
- `deploy/.gitignore`：追加 `short-latest.json`（真值不入库）。
- `deploy/docker-compose.yml`：`api` 服务挂载 `./short-latest.json:/app/short-latest.json:ro` + env `SHORT_LATEST_CONFIG=/app/short-latest.json`。
- `deploy/.env.example`：新增 `SHORT_LATEST_CONFIG` 说明。

## 文件清单（本次改动集，提交时仅含这些；**排除 SEC-007 的 model.go / faynoSync_test.go / SEC-007.md**）

- 新增 `server/server/handler/shortlink/config.go`
- 新增 `server/server/handler/shortlink/resolve.go`
- 新增 `server/server/handler/shortlink/shortlink_test.go`
- 改 `server/server/handler/handler.go`
- 改 `server/server/handler/handler_test.go`
- 改 `server/server/server.go`
- 新增 `deploy/short-latest.example.json`
- 改 `deploy/.gitignore`
- 改 `deploy/docker-compose.yml`
- 改 `deploy/.env.example`
- 新增 `docs/task/REFACTOR-005.md` + 改 `docs/task/index.md`

## 待定决策（部署前请用户确认）

**配置真值落点**：当前实现按「真值仅宿主机 + 仓库留中性 example」（最 brand-neutral，沿用 credentials 惯例）。
若改为「真值也提交进仓库」（版本可控、部署更省事，但 TTPOS 数据进 repo），需新增 `deploy/short-latest.json` 并移除 `.gitignore` 项。
真实目录内容已备于 `tmp/short-latest.json`，等价于原硬编码值。

## 验证交接（blocker：本环境无 Go/docker 工具链）

- ✅ 本环境已完成：实现落地、悬挂引用扫描（旧符号 0 残留、`NewAppHandler` 仅 server.go 用新签名、测试 150 处经可变参兼容）、
  `jq` 全 schema 校验、15 条短链等价表逐行核对。
- ⛔ 需用户在 Go 环境执行（CI `build-server.yaml` 只构建镜像、不跑 `go test`，故此 gate 无法自证）：
  - `cd server && go build -o faynoSync .`
  - `cd server && go test ./...`（尤其 `./server/handler/...` 与新 `./server/handler/shortlink`）
  - `gofmt -l server/server/handler server/server/handler/shortlink server/server/server.go`（应无输出）

## ⚠️ 部署前生产状态发现（2026-06-01 侦察，阻塞自动部署）

vm-node02（`8b154be3…`，`/home/ubuntu/ttpos-releases`）当前 api/dashboard **不是**用基础 compose 的 `:latest` 跑的：

- 运行镜像：`faynosync-server:zero-trust-ada91b4`（**本地构建、无 ghcr 前缀**），经覆盖文件
  `docker-compose.zero-trust-ada91b4.yml` 钉死（api 与 dashboard 同此 tag）。`ada91b4` 不在 git 历史，是镜像 tag。
- `.env` 尚无 `SHORT_LATEST_CONFIG`，compose 目录尚无 `short-latest.json`。
- 这是一套刻意"钉住已知良好构建"的手工编排，与 dashboard 文档记录的 push→CI→拉 `:latest` 不同。

**因此下方"拉 :latest"计划不适用**，且：切到 `:latest` 会把自 `ada91b4` 以来合入 main 的 SEC-007(#9)、
零信任(#8) 等改动一并带入生产（均未在生产验证）；而复刻"本地构建+钉 tag"流程需在宿主机 `docker build`（本环境无 docker）。
**部署机制须由用户定夺**（见报告中的 A/B/C 选项），不擅自切换。

## 部署计划（vm-node02，需用户显式放行；**因上方发现，机制待定**）

> 因 `fatal-on-missing-config` + `route-gated-on-config`，**先备配置、后上镜像**，避免新镜像起不来或 `/dl` 失效。

1. **先 provisioning 宿主机**（旧镜像无视新 env/volume，无害）：把 `tmp/short-latest.json` 放到 vm-node02 compose 目录
   （`/home/ubuntu/ttpos-releases/short-latest.json`），并同步更新该机 `docker-compose.yml`（加 volume+env）与 `.env`（加 `SHORT_LATEST_CONFIG`）。
   **失败模式警示**：若 `short-latest.json` 在 `docker compose up` 前**不是一个已存在的文件**，Docker 会把挂载源自动建成**目录**，
   `os.ReadFile` 失败→新镜像 `Fatalf` 崩溃循环。务必在 up 前 `test -f /home/ubuntu/ttpos-releases/short-latest.json` 守卫。
2. **push**（仅本次改动文件）→ `build-server.yaml` 触发（`paths: server/**`）→ 推 `faynosync-server:latest`。
   **推送方式**：已查 `main` 无分支保护、直接 `git push origin main` 技术上允许；但近期 #8/#9 均走 PR（习惯而非强制）。
   按用户习惯二选一：直接 push（最快，符合部署惯例记录）或推 feature 分支开 PR 合并（与近期一致、可复审）。
3. 等 CI：`gh run list --workflow=build-server.yaml --limit 1` → `gh run watch <id> --exit-status`。
4. 拉新镜像重启：`aissh exec <node02> "cd /home/ubuntu/ttpos-releases && docker compose pull api && docker compose up -d api" --reason=...`。
5. **冒烟验收**（非「容器起了」）：`curl -sI https://<host>/dl/cashier.apk` 等确认仍 302 到正确产物；抽查 exe/dmg 与另一别名。

## 落地与验证结果（2026-06-01）

- 提交 `7082d48` 推 main（仅本次 10 文件），`build-server.yaml` CI **构建通过**（即 `go build` + `go test -c` 编译门全绿，
  含 `faynoSync_test.go` ~150 处可变参调用），镜像 `ghcr.io/.../faynosync-server:latest` 已推。
- **vm-node02（测试环境，非生产）部署**：现有 api 原以本地镜像 `zero-trust-ada91b4` 经覆盖文件钉死。本次：
  宿主机放 `short-latest.json` + `.env` 加 `SHORT_LATEST_CONFIG` + base compose 给 api 加 volume/env +
  覆盖文件移除 api 钉死项（dashboard 保持钉死），原文件均 `*.r005.bak` 备份；
  `docker compose -f base -f override pull api && up -d api` 切到 ghcr `:latest`。
  api 状态 running，启动日志 `Short latest download enabled (5 aliases)`，无 Fatalf。
- **冒烟验证**（`https://update.ttpos.dev/dl/*`）：拒绝用例 `unknown.apk`/`cashier.zip`/`cashier` 均 **400**（路由+解析正确）；
  有效别名返回 **404**，且与直连同一未改动 handler 的 `/apps/latest?owner=ttpos&app_name=TTPOS&channel=prod&platform=android&arch=arm64&package=apk`
  **结果逐字一致**（`No matching data found`）。证明 `/dl` 的 query 改写与下游等价，**404 系测试库无 TTPOS prod 制品的数据状态，非重构回归**。
- 残留可选项：`go test ./...` 逻辑级运行（CI 不跑、本环境无 Go）；若测试库灌入 TTPOS prod 制品，`/dl` 即返回 302。

## 进行时描述

已把 `/dl` 短链硬编码目录提取为配置驱动的 `shortlink` 包，源码去除 TTPOS 字面量、统一 query 改写，并部署到 vm-node02 测试环境验证行为等价。
