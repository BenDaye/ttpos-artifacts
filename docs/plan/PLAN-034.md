# PLAN-034 server 对抗式评审报告与推进计划

- **status**: proposal
- **createdAt**: 2026-07-03
- **scope**: `server/`（FaynoSync Go API，Go 1.25 + gin，约 1.8 万行非测试代码）
- **method**: 5 阶段动态工作流 —— 上下游梳理(6 子系统) → 综合项目地图 → 6 维度评审 → 每条发现独立对抗验证 → 综合推进计划
- **result**: 评审 40 条 → 对抗验证后确认 **32 条**、驳回 8 条

## 一、评审方法与可信度

本报告由一条对抗式评审工作流产出，核心机制是**发现与验证分离**：6 个维度（代码异味、过度设计、潜在缺陷、遗漏逻辑、安全、Go 最佳实践）各自独立找问题，每条发现随后交给一个**专门尝试反驳它**的独立怀疑者，回读真实源码核验证据、构造最强反驳，证据不足即判不成立。这样最终计划只建立在经得起反驳的发现上，规避 AI 评审常见的"看似合理实为幻觉"噪声。

- 共 60 个 agent 参与；评审出 40 条候选发现，对抗验证**驳回 8 条**（见第五节），确认 32 条。
- 确认发现严重度分布：致命 1、高 2、中 9、低 20。
- 严重度以怀疑者校准后的 `adjustedSeverity` 为准（可能低于评审员初判）。

## 二、项目上下游地图

### 整体概览

FaynoSync 是一个 Go 1.25 + gin 的跨平台桌面应用更新分发 API，采用清晰的分层架构：进程入口 faynoSync.go 引导 -> server.StartServer 装配 gin.Engine 与全部路由/中间件 -> handler 门面(appHandler)分派到按领域拆分的子包 -> mongod 仓储层(AppRepository)持久化 -> S3 对象存储/Redis 缓存与遥测/Slack 通知等基础设施。横切的 utils 层提供 JWT/API-Token 认证、RBAC 权限门、IP 限流、参数与语义化版本校验、多云存储抽象(AWS/MinIO/DO Spaces/GCS)与 updater 协议(squirrel/electron-builder/tauri/sparkle)响应整形。owner 命名空间是核心租户边界，在 DEPLOYMENT_OWNER 单租户模式下坍缩到唯一 owner。TUF 更新框架是主分发流之上的可选安全层，由 TUF_ENABLED 闸控，仅管理员可用，但当前前端入口被主动禁用、更新流未真正校验 TUF，是一条未闭环的负债链路。三条核心业务链路为：发布上传(/upload)、客户端查版本(/checkVersion、/apps/latest、Squirrel RELEASES)、下载(/download)。系统最敏感的设计点是 ENABLE_PRIVATE_APP_DOWNLOADING 为真时 /download 完全绕过鉴权，且 key 参数无 owner/app 归属校验，构成跨租户越权下载热区。

### 上游消费者（谁调用 server）

- **dashboard-next 前端 (apps/web)**：features/{apps,channels,settings,telemetry}/api.ts 携带 JWT 调用几乎全部管理端点：/login /whoami /app/list /search /upload /apps/update /app/update /artifact/delete、channel|platform|arch|app 的 create|list|reorder|delete|update、/user/* /users/list /token/* /admin/update /telemetry /download。Permissions 按 JSON 首字母大写 key 传参。
- **dashboard-next MCP server (apps/mcp)**：apps/mcp/src/tools/{apps,telemetry}.ts：公开只读调 /apps/latest(auth=false)，鉴权调 /telemetry。
- **桌面更新客户端 / updater 框架**：Electron/Tauri/Squirrel/Sparkle/electron-builder 经 GET /checkVersion?app_name&version&channel&platform&arch&updater(无鉴权)拿 302/204/200；squirrel_windows 专用 path 路由 GET /update/:owner/:app/:channel/:platform/:arch/:version/RELEASES 由 handler 重写成 query 复用 FindLatestVersion。
- **CI/CD 分发流水线 (.github/workflows)**：以 API_KEY 调 /signup 建 admin，以 JWT 或 fns_ API token 调 POST /upload 推构建产物(multipart file[] + query 参数)，可先 GET /upload/check 预检冲突。API token 仅限 apps.upload 且受 allowed_apps 白名单约束。
- **反向代理 / Caddy 短链**：deploy/ 下 Caddy 把 /dl、/d 等短链转发到 /apps/latest(单命中 302 重定向到对象存储 URL)，公网匿名下载走此路径。ClientIP 依赖代理对 X-Forwarded-For 的信任配置。
- **运维 / 健康探针**：GET /health(Mongo Ping + performanceMode 时 Redis Ping)。
- **TUF 客户端 (设计中，当前未闭环)**：旧版 dashboard 或 Python CLI 调 /tuf/v1/*(全部经 authMiddleware + AdminOnlyMiddleware)；当前 dashboard-next 的 /settings/tuf 仅渲染 disabled 占位，features/tuf/* 资产无引用。

### 下游依赖（server 依赖什么）

- **MongoDB (mongod 仓储层 + 直连集合)**：持久化 apps(版本+artifacts 内嵌数组)、apps_meta(channel/platform/arch/app 四类元数据同集合按判别字段区分)、admins、team_users、api_tokens、upload_claims(TTL 6h 防并发)。handler 走 AppRepository 接口做 CRUD/聚合/reorder/上传声明；sign/team/token/updateAdmin 与中间件绕过 repository 直连集合做鉴权与作用域校验。所有查询 owner-scoped(FetchAppByID 例外)。
- **S3 兼容对象存储 (AWS/MinIO/DO Spaces/GCS)**：由 STORAGE_DRIVER 选择驱动。双桶模型：S3_BUCKET_NAME(public，logo 与非私有制品直链) + S3_BUCKET_NAME_PRIVATE(private，15min presigned)。存安装包/RELEASES/yml。凭证静态明文从 env(S3_ACCESS_KEY/S3_SECRET_KEY、GCS_PRIVATE_KEY)读取，无 IAM/轮换。
- **Redis (可选)**：PERFORMANCE_MODE 或 ENABLE_TELEMETRY 开启时连接。查版本响应缓存(TTL 24h)、遥测计数(stats:owner:app:*, TTL 30d)、Slack 通知去重锁(SetNX)、TUF 任务状态/引导锁/配置。缺失时查版本回退直查 Mongo、发布不失效缓存、遥测丢失、TUF config.go 直接解引用会 panic。
- **utils 中间件与鉴权原语**：AuthMiddleware(JWT HS256 + fns_ API token 回退)、CheckPermission(RBAC)、AdminOnlyMiddleware、RateLimitMiddleware、ValidateJWT、GenerateJWT/GenerateAPIToken、bcrypt、GetUsernameFromContext。产出 gin.Context key(username/is_api_token/allowed_apps 等)供 handler 消费。
- **ownership 包**：owner 命名空间单点解析：OwnerOrUsername(catalog/create/update/delete/reorder 用调用者用户名)、ResolveOwner(upload/telemetry team member 归并到其 admin)；单 owner 模式全部塌缩为 DEPLOYMENT_OWNER。
- **updaters 包**：BuildS3Key 按 updater 类型定制对象 key 路径(squirrel_windows/ electron-builder/ 前缀)与 /download?key= 链接；BuildResponse 按类型整形响应(204/302/200)与状态码。ValidateFiles/ValidateParams/ValidateUpdaters 校验。
- **Slack (可选 SLACK_ENABLE)**：上传/更新/删除成功后异步 goroutine 发布/更新/清理通知，Redis 锁去重同一 (owner,channel,app,version) 消息，失败仅记日志不影响主流程。
- **TUF 子系统 (可选 TUF_ENABLED)**：为每个 (admin,app) 维护独立 TUF 元数据仓库(root/targets/snapshot/timestamp)，离线多方签名 + 在线自动签名，把 artifact 转 target 写入 S3 tuf_metadata/{admin}/{app}/。依赖 go-tuf v2 + sigstore、Redis、Mongo tuf_private_keys、文件系统 ONLINE_KEY_DIR。
- **golang-migrate + seed**：启动期从 mongod/migrations/(相对 cwd)加载 35 个 JSON 迁移执行 m.Up()(错误被吞只看 version)；RunSeed 幂等播种通用 channel/platform/arch(靠 already exists 字符串匹配判幂等)。

### 关键端到端流程

**发布上传流 (POST /upload)**
1. AuthMiddleware 验 JWT(HS256) 或 fns_ API token，注入 username/is_api_token/allowed_apps 到 gin.Context
2. CheckPermission(apps.upload)：API token 仅放行 upload+apps 且必须命中 allowed_apps；admin 直通；team_user 按 Permissions 位判定
3. ownership.ResolveOwner 派生 owner 命名空间(单租户坍缩为 DEPLOYMENT_OWNER，team member 归并到 admin)
4. ValidateParams 正则校验 app_name/version(semver)/channel/platform/arch + CheckChannels/Platforms/Archs 存在性
5. validateAPITokenAppScope 在 apps_meta 校验 token 允许的 app 归属；overwrite 需额外 apps.edit
6. updaters.ValidateFiles/ValidateParams 按 updater 校验(squirrel 需 RELEASES、electron-builder 需 yml)；CheckPrivate 决定 public/private 桶
7. 逐文件 CalculateFileHashes(SHA256+SHA512) -> repository.PrepareUpload(resolveUploadScope 解析 meta ObjectID + checkUploadAvailable + acquireUploadClaim 唯一 _id 占位防并发)
8. UploadToS3(BuildS3Key 按 updater 生成 key+link，getContentType 强制 MIME)
9. repository.Upload 幂等写 apps 集合(存在版本则 append/replace artifact，不存在则 InsertOne，11000 唯一键并发兜底降级为原子 append)
10. publish 且 performanceMode 时 InvalidateCache 用 KEYS 通配删 Redis 缓存
11. 返回 {uploadResult.Uploaded: id}，异步发 Slack；defer releaseUploadPlans 兜底释放 claim

**客户端查版本流 (/checkVersion + /apps/latest + Squirrel RELEASES)**
1. 无鉴权。FindLatestVersion: ValidateParamsLatest 正则校验 + CheckPlatformsLatest 反查 platform 默认/指定 updater(squirrel_ 前缀 -> squirrel_darwin)
2. 单租户模式强制 owner = DeploymentOwner 覆盖客户端传值(多租户则 owner 来自客户端 query，无访问控制)
3. CreateCacheKey；performanceMode 命中 Redis 直接返回(缓存命中也记遥测、302 缓存也重定向)
4. 未命中 CheckLatestVersion：getMeta 解析 meta ObjectID -> 聚合按 semver 分段排序取 published 最新版 -> CheckRequiredMigrationStep 找强制中间版本 -> requestedVersion vs latest 比较得 found/rollback -> 过滤 platform+arch 的 artifacts
5. BuildArtifactUrls(按 package 生成 update_url_<ext>) + BuildChangelogResponse
6. updaters.BuildResponse 按 updater 整形(squirrel_windows->302 到 RELEASES；darwin->url=zip 或 204；electron->302 到 yml；tauri->version/notes/signature) -> 回填缓存 -> 302/JSON
7. 遥测 resolveDeviceID(X-Device-ID 或 sha256(IP|UA) 前 8 字节)写 Redis Set
8. SquirrelReleases 把 path 参数重写进 query 后复用 FindLatestVersion(updater 固定 squirrel_windows)；/apps/latest 走 FetchLatestVersionOfApp 构建 channel/platform/arch/package 嵌套表，urlCount==1 时 302 到对象存储 URL

**下载流 (GET /download)**
1. 链接来源：上传时 BuildS3Key 写进 artifact.Link 的 <API_URL>/download?key=<PathEscape(objectKey)>
2. 路由装配分叉：ENABLE_PRIVATE_APP_DOWNLOADING=true 时 /download 在 router.Use(authMiddleware) 之前注册，完全公开无鉴权；false 时先 Use(authMiddleware) 再挂 CheckPermission(download,apps)
3. DownloadArtifact 直接取 c.Query("key")，无 owner/app 前缀或路径穿越校验
4. GeneratePresignedURL 对 S3_BUCKET_NAME_PRIVATE 签 15 分钟 presigned URL
5. enablePrivate=true 时 302 重定向到 presigned URL；false 时返回 {download_url}
6. public 桶的 artifact.Link 是直链，不经此路由(如 /apps/latest 302 直接指向 public 桶 URL)

### 风险热区（指导评审的重点）

- **私有下载匿名越权 (IDOR)：/download 免鉴权 + key 无归属校验**
  - 原因：ENABLE_PRIVATE_APP_DOWNLOADING=true 时 /download 在 router.Use(authMiddleware) 之前注册(gin 的 Use 只对其后路由生效)，完全绕过身份/权限/白名单；DownloadArtifact 又直接把 c.Query("key") 交给 GeneratePresignedURL 对私有桶签名，无 owner/allowed_apps 隔离与路径穿越约束。key 可从 /apps/latest 或 /checkVersion 响应直接获得，任何人知道 key 即可换取私有桶对象的 15min 直链，跨租户读取任意对象。这是全系统最高危热区。注意：任务描述所谓 'DEBUG 分支' 在代码中不存在，真实开关是 ENABLE_PRIVATE_APP_DOWNLOADING。
  - 涉及：`server/server/server.go`、`server/server/handler/download/download.go`、`server/server/utils/s3.go`、`server/server/utils/utils.go`
- **RBAC 资源级隔离一致性与 allowed_* 白名单落地**
  - 原因：CheckPermission 只把 allowed_* 白名单在'任一资源 Allowed 非空'时才写入 context，空白名单 team_user 等于对该资源全量放行；且是否真正按 allowed_apps/allowed_channels 过滤取决于下游各 handler 自行实现——upload 有 validateAPITokenAppScope，channel/platform/arch 的 Allowed 是否生效需逐一核对。Channels/Platforms/Archs 的 switch 只覆盖 Create/Delete/Edit 缺 Download/Upload(fail-closed 尚安全但矩阵易失同步)。API token 分支只按 is_api_token 布尔硬编码放行 upload+apps。
  - 涉及：`server/server/utils/permissions.go`、`server/server/handler/create/upload.go`、`server/server/handler/token/create.go`
- **JWT 无法吊销 + owner 纯字符串命名空间越权读**
  - 原因：JWT HS256 claims 仅 username+exp(24h)，无 jti/iat/aud，改密码/删用户后旧 token 仍有效直到过期；ValidateJWT 成功路径不校验用户是否仍存在(延迟到 CheckPermission)，对只挂 authMiddleware 不挂 CheckPermission 的路由(/whoami、/telemetry、/user/*、/token/*)第一层可被已删除用户的未过期 JWT 通过。多租户模式下查版本/latest 的 owner 来自客户端 query 且无访问控制，任意 owner 可枚举读取。越权边界完全依赖 {_id, owner} 复合条件与 handler 内 owner 派生正确性。
  - 涉及：`server/server/utils/auth.go`、`server/server/utils/validate.go`、`server/server/handler/info/latest.go`、`server/server/ownership/ownership.go`
- **上传两阶段非事务：S3 孤儿对象与部分写入**
  - 原因：upload.go 先全部 UploadToS3 再逐个 repository.Upload，非事务；若第 N 个文件 Upload 写库失败中途 return，已上传 S3 的对象与已写库的前 N-1 条 artifact 不回滚，只有 upload_claims 靠 defer/TTL 释放，残留孤儿对象与部分版本文档。TOCTOU：checkUploadAvailable 内存判 tuple 存在，原子性靠 upload_claim 唯一 _id + 11000 降级，需确认 11000 降级分支 artifact 的 hashes/length 一致性。多文件仅按扩展名去重。
  - 涉及：`server/server/handler/create/upload.go`、`server/mongod/create.go`、`server/server/utils/s3.go`
- **脏数据/缺参导致 panic 打挂请求**
  - 原因：CheckLatestVersion 与 CheckRequiredMigrationStep 用 version.Must(NewVersion(...)) 解析库中 version，历史或直写的非 semver 字符串会 panic -> 500；create.go Upload 中 ctxQuery["signature"]/changelog 及 update.go ctxQueryMap["app_name"] 用非 ok 形式类型断言，上游未注入键会 panic；ValidateParams 未强制这些键。这些是可被脏数据或异常入参触发的可用性热区。
  - 涉及：`server/mongod/check.go`、`server/mongod/create.go`、`server/server/handler/update/update.go`
- **限流可绕过 + 缓存失效用 KEYS 阻塞**
  - 原因：RateLimitMiddleware 只保护 /login(6s/burst10)、/signup(20s/burst3)，用 c.ClientIP()——gin.Default 默认信任所有代理，部署在 Caddy 后未配 trusted proxies 时 X-Forwarded-For 可伪造绕过或全局共享一个桶；>10000 桶时无序 map 驱逐可能删活跃 IP。/download、/upload 等无速率保护。InvalidateCache 用 KEYS 通配扫描删除，大 keyspace 下阻塞 Redis，且 pattern 与 CreateCacheKey 必须同构否则漏失效。auth 每次 API token 请求写 last_used_at 是写放大且无限流。
  - 涉及：`server/server/utils/ratelimit.go`、`server/server/handler/info/latest.go`、`server/server/utils/auth.go`
- **多租户作用域缺 owner 过滤：CheckPrivate 与团队命名空间碰撞**
  - 原因：utils/check.go CheckPrivate 仅按 app_name 查 apps_meta 不带 owner 过滤且取首条文档，多租户下同名 app 可能取错记录，影响 upload/delete 走公桶还是私桶；team/create.go username 查重是全局(不带 owner)，login 先查 admins 再查 team_users，team username 与 admin username 命名空间是否碰撞导致越权登录/夺号需确认。catalog List* 出错仅 logrus.Error 返回空列表+200，前端无法区分'真没有'与'查询失败'。
  - 涉及：`server/server/utils/check.go`、`server/server/handler/team/create.go`、`server/server/handler/catalog/list.go`、`server/server/handler/sign/login.go`
- **TUF 子系统：配置不自洽 + 信任根来源 + 私钥落盘 + 未闭环**
  - 原因：TUF_ENABLED 默认 true 但 redisClient 仅在 PERFORMANCE_MODE||ENABLE_TELEMETRY 时连接，只开 TUF_ENABLED 会注册路由但 redisClient=nil，config.go GetConfig/PutConfig 无 nil 保护直接解引用 -> panic。离线签名授权以 S3 上 trusted root 作为 allowedKeys 来源，若 S3 key 命名空间写权限隔离不当则信任根可被替换绕过多方签名。root/targets/snapshot/timestamp 私钥以 base64 seed 明文存 Mongo，削弱离线密钥威胁模型。前端 features/tuf/* 12 文件无引用、/settings/tuf 渲染 disabled 占位，且无公开元数据分发路由，更新流未真正校验 TUF——整条链未闭环。AddArtifacts/RemoveArtifacts 后台失败与 Mongo tuf_signed 状态存在最终一致性缺口。
  - 涉及：`server/server/tuf/config/config.go`、`server/server/tuf/metadata/metadata.go`、`server/server/tuf/signing/signing.go`、`server/server/tuf/artifacts/handlers.go`、`server/server/server.go`
- **遥测隐私 + public 桶 ACL + 迁移错误被吞**
  - 原因：resolveDeviceID 用 sha256(IP|UA) 前 8 字节做伪匿名 deviceID，低熵可暴力反解、未 HMAC 加盐(SEC-008 已标注)，公网暴露前是隐私热区。UploadPublicObject 默认打 public-read ACL(AWS 可由 S3_DISABLE_OBJECT_ACL 关，DO 硬编码)，若桶策略与 ACL 不一致(Garage/MinIO 可能不支持 canned ACL)则 public 直链 403 影响 /apps/latest 302 后下载，或反之把本应私有制品暴露。RunMigrations 吞掉 m.Up() 错误只看 version，索引冲突不 panic 可能带病运行；migrations 相对 cwd 路径换目录启动 panic。
  - 涉及：`server/server/handler/info/latest.go`、`server/server/utils/storage/aws_s3_client.go`、`server/mongod/migration.go`、`server/server/utils/notifications.go`

## 三、整体健康度评估

FaynoSync 是一套架构清晰、分层合理的 Go 1.25 + gin 更新分发 API：进程入口→StartServer 装配→appHandler 门面→mongod 仓储→S3/Redis/Slack 基础设施，owner 命名空间贯穿全链做租户隔离，updater 协议整形与多云存储抽象都做得体面，端到端测试覆盖 155 个用例。本次对抗式评审确认了 32 条发现，但它们的分布高度不均衡：真正致命的问题集中在一处——ENABLE_PRIVATE_APP_DOWNLOADING=true 时 /download 在 router.Use(authMiddleware) 之前注册（server.go:125-131 已核实），叠加 DownloadArtifact 直接透传 c.Query("key") 无归属/穿越校验（download.go:16 已核实），构成匿名跨租户读取整个私有桶的 critical IDOR。其次是一枚可远程触发的进程级 DoS：signup 畸形密码经 CreateUser 的 bcrypt 失败走 logrus.Fatal 直接 os.Exit（createUser.go:18 已核实）。除这两条外，大量发现是低严重度的工程债：三处重复的 stringly-typed switch 骨架、319 行 God Function、约 2 万行建了没用的 TUF 子系统、以及 Server CI 完全没有 Go 质量门。整体判断：设计底子好、可用性与安全的护栏没做全，属于"架构合格但边界收口不严"，通过一轮聚焦的 P0/P1 修复即可把风险面大幅收敛。

> 整体健康度：中等偏上，有一个必须立刻堵的洞。做得好的地方值得肯定：(1) 分层边界干净，handler/repository/utils/ownership/updaters 职责分明，owner-scoped 查询是贯穿全库的显式不变量；(2) 上传流已经考虑了并发（upload_claims 唯一 _id 占位 + 11000 唯一键降级）、幂等（append/replace/insert）和 defer 兜底释放，说明作者对分布式写入有认知；(3) updater 协议抽象（squirrel/electron-builder/tauri/sparkle 分类整形 204/302/200）和多云存储驱动分离是恰当的抽象层级；(4) 端到端测试规模可观。真正的短板集中在三类：一是安全边界收口不严——最高危的 IDOR 源于 gin 中间件注册顺序这一个细节，SECURITY-01/MISSING-LOGIC-01 指向同一根因；二是错误处理不够防御——请求路径出现 logrus.Fatal（DEFECTS-01）、对 DB 脏数据用 version.Must（MISSING-LOGIC-02/BEST-PRACTICE-08）、List 出错吞成 200+空集（DEFECTS-05）；三是工程化欠账——Server CI 无 go vet/test/golangci-lint/govulncheck（BEST-PRACTICE-01），以致上面这些问题本可被静态检查提前拦住却一路合入。TUF 子系统是一笔独立的、需要明确决策的负债，但它当前未接入主分发流，短期不构成在产风险。结论：不是推倒重来，而是一轮聚焦收口——先堵 IDOR 与 DoS，再补 CI 门禁把回归挡在门外，然后按性价比清理工程债。

## 四、确认发现清单（32 条，按严重度排序）

### 致命危发现

#### `MISSING-LOGIC-01` /download 在私有下载模式下先于 authMiddleware 注册，且 key 参数无归属/穿越校验，构成匿名跨租户 IDOR
- **维度/严重度**：遗漏逻辑 · 致命（初判 致命）
- **位置**：server/server/server.go:125-131；server/server/handler/download/download.go:13-28；server/server/utils/s3.go:191-208
- **问题**：当 ENABLE_PRIVATE_APP_DOWNLOADING=true 时，/download 在 `router.Use(authMiddleware)` 之前注册。gin 的 Use 只对其后注册的路由生效，因此该路由完全绕过 AuthMiddleware、CheckPermission 与 allowed_apps 白名单。DownloadArtifact 直接把 `c.Query("key")` 交给 GeneratePresignedURL，对私有桶 S3_BUCKET_NAME_PRIVATE 签 15 分钟 presigned URL，全程无 owner/app 前缀校验、无路径归属校验。key 可从公开无鉴权的 /apps/latest 或 /checkVersion 响应中直接读到。缺失的逻辑是：私有下载分支既没有身份鉴权，也没有对 key 做 owner 命名空间约束，任何匿名请求者拿到任意 key 即可换取私有桶任意对象的直链，跨租户读取。
- **影响**：匿名者拿到任意 objectKey 即可获得私有桶对象 15 分钟直链，跨租户/越权下载任意私有制品；这是全系统最高危的鉴权遗漏。
- **对应最佳实践**：OWASP A01:2021 Broken Access Control / IDOR：所有对象访问必须做服务端对象级授权（object-level authorization），不得以“知道标识符”作为授权依据。
- **建议**：私有下载分支也必须过 authMiddleware + CheckPermission；并在 DownloadArtifact 内按已鉴权用户解析出的 owner 派生 key 前缀（owner/app），拒绝不属于调用者命名空间的 key，同时对 key 做路径穿越/前缀白名单校验（禁止 `..`、跨 owner 前缀），而非直接透传 c.Query("key")。
- **对抗验证核实**：Verified in source: server/server/server.go:125-131 — when enablePrivateDownload is true, `router.GET("/download", handler.DownloadArtifact)` is registered at line 126 BEFORE `router.Use(authMiddleware)` at line 127; gin's Use only affects subsequently-registered routes, so private-mode /download runs with neither AuthMiddleware nor CheckPermission (the else branch at line 130 explicitly adds both). handler.go:236-239: handler.DownloadArtifact -> download.DownloadArtifact(c, ch.enablePrivateDown

### 高危发现

#### `DEFECTS-01` signup 用超长密码可触发 bcrypt 错误 -> logrus.Fatal 整进程退出 (DoS)
- **维度/严重度**：潜在缺陷 · 高（初判 致命）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/mongod/createUser.go:14-18 (CreateUser),被 /home/weifashi/projects/ttpos-artifacts/server/server/handler/sign/signup.go:42 调用
- **问题**：POST /signup 处理链:SignUp 只调用 utils.ValidatePasswordStrength(password.go)做强度校验,该函数只强制最小长度>=8、含字母+数字,没有任何最大长度限制。随后 mongod.CreateUser 里 bcrypt.GenerateFromPassword([]byte(credentials.Password), ...) 对超过 72 字节的密码会确定性返回 bcrypt.ErrPasswordTooLong,而错误分支是 logrus.Fatal(err) —— logrus.Fatal 会调用 os.Exit(1) 直接终止整个服务进程,不是返回 500。攻击者只需持有 API_KEY(CI 或任何知道该 key 的调用方),发一个密码长度 > 72 字节且含字母数字的请求即可让整个 API 服务崩溃退出。/signup 仅受宽松限流(20s/burst3)保护,单个请求即可打挂。
- **影响**：任何持有 API_KEY 的调用方(CI/dashboard 建号流程)用一个畸形密码即可让 faynoSync 进程 os.Exit(1),整服务不可用(需外部重启/编排拉起),属可远程触发的进程级 DoS。
- **对应最佳实践**：Effective Go / gin 服务惯例:请求处理路径禁止使用 log.Fatal/os.Exit;错误应向上返回并转成 HTTP 状态码。OWASP:对用户可控输入(密码长度)做上限校验。
- **建议**：CreateUser 的 bcrypt 失败必须 return err 而非 logrus.Fatal;同时在 ValidatePasswordStrength 增加最大长度校验(如 <=72 字节)提前拒绝,避免把内部错误升级成进程退出。
- **对抗验证核实**：Read createUser.go:16-19 — hashedPassword, err := bcrypt.GenerateFromPassword([]byte(credentials.Password), bcrypt.DefaultCost); if err != nil { logrus.Fatal(err) }. Confirmed the error branch is logrus.Fatal, which by default calls os.Exit(1); grep found NO logrus.RegisterExitHandler/ExitFunc override in the repo, and os.Exit cannot be recovered by gin.Recovery (which is not even installed in server.go). Read password.go:8-28 — ValidatePasswordStrength only enforces len>=8 and letter+digit; the

#### `SECURITY-01` 私有制品下载匿名越权 (跨租户 IDOR)：/download 免鉴权 + key 无归属校验
- **维度/严重度**：安全 · 高（初判 致命）
- **位置**：server/server/server.go:125-131；server/server/handler/download/download.go:13-28；server/server/utils/s3.go:191-208；server/server/utils/storage/base_s3_client.go:128-139
- **问题**：当 ENABLE_PRIVATE_APP_DOWNLOADING=true 时，/download 在 router.Use(authMiddleware) 之前注册（gin 的 Use 只对其后注册的路由生效），因此 /download 完全绕过身份认证、RBAC 与 allowed_apps 白名单。DownloadArtifact 直接把 c.Query("key") 交给 GeneratePresignedURL，对私有桶 S3_BUCKET_NAME_PRIVATE 签发 15 分钟 presigned URL，全程无 owner/app 前缀校验、无路径穿越约束。更严重的是：对象 key 由 BuildS3Key 生成为完全可预测的结构 {app_name}-{owner}/{channel}/{platform}/{arch}/{filename}，且该 key 被明文拼进 /download?key=... 链接，通过无鉴权的 /apps/latest 和 /checkVersion 响应直接返回给任意匿名调用者。因此任何人拿到（或枚举出）key 即可换取私有桶任意对象的直链，实现跨租户读取。这是全系统最高危热区。
- **影响**：远程、未认证可利用。攻击者从公开 /apps/latest 或 /checkVersion 响应直接读取 /download?key=... 链接，或按 {app_name}-{owner}/channel/platform/arch/file 结构枚举，即可对私有桶任意对象取得 15 分钟直链，跨租户下载任意（本应鉴权保护的）安装包/RELEASES/yml。blast radius = 整个私有对象存储的读取。对更新分发服务这等同私有制品全量泄露。
- **对应最佳实践**：OWASP Top 10 A01:2021 Broken Access Control — 'Deny by default'、每个受保护资源都必须做对象级授权（IDOR 防护）；OWASP ASVS V4.1.3/V8.3。gin 中间件顺序规范：router.Use 仅影响其后注册的路由。
- **建议**：1) 无论开关如何，/download 都必须挂在 authMiddleware 之后，并保留 CheckPermission(download, apps)；匿名公开下载应只走 public 桶直链（/apps/latest 302），不经此签名路由。2) 对 key 做归属校验：解析 key 前缀的 owner/app，与调用者的 owner 和 allowed_apps 比对，拒绝不匹配请求；同时拒绝含 `..`、绝对路径、越界前缀的 key。示例（Go）：
```go
// GOOD
func DownloadArtifact(c *gin.Context, enablePrivate bool) {
    key := c.Query("key")
    caller, _ := utils.GetUsernameFromContext(c) // 已在 authMiddleware 之后
    owner, _ := ownership.ResolveOwner(c, db)
    if strings.Contains(key, "..") || strings.HasPrefix(key, "/") {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid key"}); return
    }
    if !keyBelongsToOwner(key, owner) { // 校验 {app}-{owner}/ 前缀
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"}); return
    }
    // 若为 API token，再校验 allowed_apps 命中
    url, err := utils.GeneratePresignedURL(c, key, 15*time.Minute)
    ...
}
```
3) 考虑给私有对象 key 加入不可枚举随机段（如 UUID），避免可预测枚举。
- **对抗验证核实**：逐条核实全部成立。(1) server.go:125-131 确认:enablePrivateDownload 分支先 router.GET("/download", handler.DownloadArtifact) 再 router.Use(authMiddleware);gin v1.9.1(go.mod 确认)中 Use 只对其后注册的路由生效,故此 /download 只带 gin.Default 的 Logger/Recovery + corsMiddleware(line 113),不带 authMiddleware,也无 CheckPermission。(2) download.go:13-28 确认 DownloadArtifact 把 c.Query("key") 原样传给 utils.GeneratePresignedURL,无 owner/app/路径穿越/`..` 校验;enablePrivate 为 true 时直接 c.Redirect(302, urlStr)。(3) s3.go:191-208 确认 GeneratePresignedURL 恒用 en

### 中危发现

#### `BEST-PRACTICE-01` Server CI 无任何 Go 质量门：无 go test / go vet / golangci-lint / gosec / govulncheck
- **维度/严重度**：Go 社区最佳实践 · 中（初判 高）
- **位置**：/home/weifashi/projects/ttpos-artifacts/.github/workflows/build-server.yaml (整文件)；仓库无 .golangci.yml
- **问题**：server 的唯一工作流 build-server.yaml 只做 checkout → docker build → push ghcr，没有任何静态检查或测试步骤。全仓 grep 'go test|go vet|golangci|gosec|govulncheck|staticcheck' 在 .github/ 下 0 命中；仓库根与 server/ 下不存在 .golangci.yml/.golangci.yaml，也无 Makefile、pre-commit、lefthook。Dockerfile 里虽有 'go test -c -o faynoSync_tests' 但那只是把测试编译成二进制打包进镜像，从不执行(CMD 是 faynoSync --migration)，等于测试从不在 CI 跑。这意味着本报告其它维度指出的 panic 型断言、越权、错误吞并等问题没有任何自动门禁拦截。
- **影响**：缺乏 Go 社区公认的最低质量基线：编译期能过但 go vet 会警告的 printf 参数错配、丢失 err、race、可疑断言全部放行；已知 CVE 无 govulncheck 拦截；安全反模式无 gosec 拦截。回归全靠人工，主分支可合入带病代码。
- **对应最佳实践**：golangci-lint 官方‘作为 CI 门禁运行’指南 / Go 官方 govulncheck(https://go.dev/blog/govulncheck) / GitHub Actions golangci/golangci-lint-action
- **建议**：新增 lint/test job(在 build 之前作为 needs 前置)：`golangci-lint run`(启用 errcheck/govet/staticcheck/gosec/contextcheck/errorlint)、`go vet ./...`、`go test ./...`、`govulncheck ./...`；补一份 .golangci.yml。参考官方与社区规范：golangci-lint 官方文档 https://golangci-lint.run/ 、`govulncheck`(golang.org/x/vuln)、GitHub Actions 官方 golangci-lint-action。
- **对抗验证核实**：1) 完整读取 build-server.yaml(82行)：steps 仅 显示构建信息/checkout/获取Commit/setup-buildx/login ghcr/metadata/build-push-action/构建完成总结，无 test/vet/lint。2) `grep -rilE "golangci|gosec|govulncheck|go vet|go test|staticcheck" .github/` 退出码 1(零命中)。3) `find` 查 .golangci*/Makefile/pre-commit/lefthook 全仓无结果。4) Dockerfile 第8行编译测试二进制、第17行拷入镜像，CMD 为 faynoSync --migration，grep 确认 faynoSync_tests 仅出现在 Dockerfile 编译/拷贝两处，无任何执行点。5) `find -name "*_test.go"` 得 40 个测试文件(faynoSync_test.go、mongod/*、server/handler/*、server/tuf/*

#### `CODE-SMELL-04` catalog List* 四个函数逐字复制,未复用同包已有的骨架抽取手法
- **维度/严重度**：代码异味 · 中（初判 中）
- **位置**：server/server/handler/catalog/list.go:15-101
- **问题**：list.go 里 ListChannels、ListPlatforms、ListArchs、ListApps 四个函数结构逐字相同:同样的 30s 超时 ctx、同样的 OwnerOrUsername + Unauthorized 分支、同样的 `if result, err := repository.ListX(...); err != nil { logrus.Error(err) } else { list = result }` 骨架、同样的 `c.JSON(200, gin.H{"xxx": &list})`,仅列表元素类型与 repository 方法名不同。同一个包的 reorder.go 已经把等价结构抽成了 `reorderHandler(c, fn)` 共享骨架(reorder.go:53-76),说明团队认可这种抽取,但 list.go 没有跟进,形成包内不一致的复制粘贴。
- **影响**：List 逻辑(如出错时改为返回非 200、或加分页)要改四遍;新增一类 meta 又要再抄一份。当前所有 List 出错只 logrus.Error 后返回空列表+200,前端无法区分'真没有'与'查询失败',这一缺陷也被复制了四份。
- **对应最佳实践**：Fowler《Refactoring》Duplicated Code;DRY 原则;与同包既有抽象保持一致(Consistency)。
- **建议**：参照同包 reorder.go 抽出泛型/闭包骨架 `listHandler[T any](c, fn func(ctx, owner) ([]*T, error), jsonKey string)`,四个 List 收敛为一行封装;顺带统一错误语义(查询失败返回非 2xx)。
- **对抗验证核实**：list.go:15-101 read directly: ListChannels/ListPlatforms/ListArchs/ListApps are verbatim-identical except element type ([]*model.Channel/Platform/Arch/App), repository method name, and JSON key. Each uses identical 30s context.WithTimeout, identical ownership.OwnerOrUsername→StatusUnauthorized branch, identical `if result, err := repository.ListX(ctx, owner); err != nil { logrus.Error(err) } else { list = result }` skeleton, and identical `c.JSON(http.StatusOK, gin.H{"key": &list})`. On query er

#### `DEFECTS-03` TUF_ENABLED 但未开 Redis 时,config/bootstrap 等 handler 对 nil redisClient 解引用 panic
- **维度/严重度**：潜在缺陷 · 中（初判 高）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/server/tuf/config/config.go:37-38 及 162-163;装配见 /home/weifashi/projects/ttpos-artifacts/server/server/server.go:85-96,186-187
- **问题**：server.go 里 redisClient 仅在 config.GetBool("PERFORMANCE_MODE") || config.GetBool("ENABLE_TELEMETRY") 为真时才连接(第87行),否则保持 nil。而 TUF 路由在 config.GetBool("TUF_ENABLED") 为真时无条件注册(第186-187行),SetupRoutes 把同一个可能为 nil 的 redisClient 透传给所有 TUF handler(tuf.go 里 GetConfig/PutConfig/GetBootstrapStatus 等)。config.go 的 GetConfig/PutConfig 第一步就是 redisClient.Get(ctx, bootstrapKey).Result(),对 nil *redis.Client 调用会 panic。因此只要运维单独设 TUF_ENABLED=true 而没同时开 PERFORMANCE_MODE/ENABLE_TELEMETRY,任一 TUF 端点(经 authMiddleware+AdminOnly 的管理员请求)都会 panic->500,且是 nil 方法接收者上的运行时 panic。
- **影响**：配置组合不自洽(只开 TUF 不开 Redis)时,全部 TUF 管理端点 nil 解引用 panic;虽需管理员触发且需该 env 组合,但一旦命中是稳定 500 且无法通过输入规避。
- **对应最佳实践**：依赖对象在使用前做 nil 前置校验;跨模块传入的可选依赖应在边界处 fail-fast 或降级,而非在深层 panic。
- **建议**：在 SetupRoutes 或各 TUF handler 入口对 redisClient==nil 显式返回 503/配置错误;或在 server.go 里让 TUF_ENABLED 隐含要求 Redis 连接(启动期校验一致性)。
- **对抗验证核实**：亲自核实：server.go:85 `var redisClient *redis.Client`，仅在 :87 `if config.GetBool("PERFORMANCE_MODE") || config.GetBool("ENABLE_TELEMETRY")` 为真时于 :95 连接，否则保持 nil。server.go:186-187 `if config.GetBool("TUF_ENABLED") { tuf.SetupRoutes(router, authMiddleware, mongoDatabase, redisClient, repo) }` 无条件透传 nil。tuf.go:40-45 路由 GET/PUT /tuf/v1/config 直接调用 config.GetConfig/PutConfig(c, redisClient)，中间无 nil 检查。config.go:39 `bootstrapValue, err := redisClient.Get(ctx, bootstrapKey).Result()` 与 :172 同样调用，grep 确认 con

#### `DEFECTS-04` 多文件上传两阶段非事务:中途写库失败留下 S3 孤儿对象与部分版本文档
- **维度/严重度**：潜在缺陷 · 中（初判 高）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/server/handler/create/upload.go:214-260 (UploadApp 第二/三个 for 循环)
- **问题**：UploadApp 分三段:先对每个文件 PrepareUpload 占 claim;再一个循环把所有文件 UploadToS3;最后一个循环逐个 repository.Upload 写库。若第 N 个文件的 repository.Upload 返回 err,handler 直接 c.JSON+return —— 此时前 N-1 个文件已成功写入 apps 集合的 artifacts 数组,且全部 M 个文件已经上传到 S3。没有任何补偿/回滚:已写库的前 N-1 条 artifact 保留、已上传但未入库的 S3 对象成为孤儿。upload_claims 仅靠 defer releaseUploadPlans 释放,不回收已落库的部分数据也不删已上传的 S3 对象。结果是版本文档处于部分写入状态(部分平台的 artifact 存在),客户端可能查到不完整版本,且对象存储长期堆积孤儿文件。
- **影响**：任一文件写库失败即产生:(1) 部分发布的版本(部分平台 artifact 已入库,客户端可查到残缺版本);(2) 已上传 S3 但无库引用的孤儿对象,长期累积占用私/公桶且无清理路径。
- **对应最佳实践**：跨存储的多步写入需 saga/补偿或事务边界;避免部分成功导致的数据/对象不一致(分布式一致性基本原则)。
- **建议**：将同一次上传的多文件写库放入 Mongo 事务(replica set 下 client.UseSession),失败整体回滚;或在写库失败时回删本次已上传的 S3 对象与已追加的 artifact;至少记录并异步清理孤儿对象。
- **对抗验证核实**：亲自核实：(1) upload.go:229-260 确为"先全部 UploadToS3 再逐个 repository.Upload"两段循环，第 250-258 行 err 分支只 c.JSON+return，无任何 DeleteFromS3、无 DB 回滚。(2) 全仓 grep "UseSession|StartSession|WithTransaction|StartTransaction" 在非测试 Go 文件中零命中——上传路径确实没有 Mongo 事务。(3) DeleteFromS3 (server/utils/s3.go:151) 仅在 server/handler/delete/delete.go:71,127 被调用，upload 失败路径从不调用它。(4) defer releaseUploadPlans (upload.go:191-193) → ReleaseUploadClaim (mongod/create.go:612-622) 只 DeleteOne 掉 upload_claims 锁文档，绝不删已 append 的 artifact 或 S3 对象

#### `MISSING-LOGIC-04` CheckPrivate 按 app_name 查询不带 owner 过滤且取首条，多租户下同名 app 决定公/私桶时可能取错记录
- **维度/严重度**：遗漏逻辑 · 中（初判 中）
- **位置**：server/server/utils/check.go:194-213
- **问题**：CheckPrivate 用 `bson.M{"app_name": input}` 查询 apps_meta，完全不带 owner 过滤，并返回游标第一条文档的 private 值。upload.go:184、update.go:200、delete.go:58/114 都用它的返回值决定制品写入/删除走 public 桶还是 private 桶（S3_BUCKET_NAME vs S3_BUCKET_NAME_PRIVATE）。多租户模式下若两个 owner 各有同名 app（一个私有一个公开），MongoDB 返回顺序不确定，可能取到另一租户的 meta，导致：本应私有的制品被上传/链接到公有桶（泄露），或反之公有制品被写进私有桶（下载 403）。缺失的逻辑是查询没有把当前 owner 纳入过滤条件。
- **影响**：多租户部署下同名 app 的可见性（public/private 桶路由）判定可能落到错误租户的 meta，造成私有制品被放公有桶泄露、或下载因桶不匹配失败。单租户 DEPLOYMENT_OWNER 模式下风险收敛。
- **对应最佳实践**：多租户数据访问必须在每个查询上强制 tenant/owner 过滤（tenant isolation by default），不得依赖返回顺序或全局唯一假设。
- **建议**：给 CheckPrivate 增加 owner 参数并把 `owner` 加入过滤条件（与 resolveUploadScope 一样按 {app_name, owner} 精确定位），调用方传入已解析的 owner。
- **对抗验证核实**：1) check.go:194-213 逐字符核实：CheckPrivate 用 db.Collection("apps_meta").Find(ctx, bson.M{"app_name": input})，无 owner 过滤，for cursor.Next 取首条文档的 document["private"].(bool) 即 return，evidence 属实。2) 迁移 20250410145736_update_app_name_index_in_apps_meta_collection.up.json 定义唯一索引 key={app_name:1, owner:1, created:-1}、unique:true —— app_name 仅在 (app_name,owner) 组合上唯一，因此两个不同 owner 合法地可以各有同名 app（一私一公），发现的前提成立。3) 该 bool 直接决定桶：s3.go:124-137，checkAppVisibility==false 走 S3_BUCKET_NAME(公有)，否则走 S3_BUCKET_NAME_PRIVAT

#### `OVER-ENGINEERING-01` 整套 TUF 子系统（后端 ~7300 行 + 测试 ~12700 行）已被主动禁用且从未接入核心分发流，构成纯负债的“建了没用”资产
- **维度/严重度**：过度设计 · 中（初判 高）
- **位置**：server/server/tuf/**（21 个非测试文件，7312 行）+ dashboard-next/apps/web/src/features/tuf/**（12 文件，0 引用）
- **问题**：TUF 子系统是全仓最大的过度设计负债。证据链：(1) 后端 tuf/ 目录 21 个非测试文件共 7312 行、17 个测试文件 12713 行，约 2 万行代码；(2) 三条核心业务链路（upload / checkVersion / apps/latest / download）grep 无任何 tuf 引用——upload.go、download.go、info/latest.go、mongod/check.go 全不触碰 TUF，更新流从不校验 TUF 元数据；create.go:113 与 update.go:138 里的 `tuf` 只是写进 Mongo 的一个 bool 标记位，不触发任何签名/校验行为；(3) 前端 features/tuf/ 的 12 个文件被 grep 证实零处 import，/settings/tuf 路由仅渲染一个 `TufPanel` 的 disabled EmptyState（'TUF management is disabled'）；(4) 提交 6a8f17a 标题即 '禁用 TUF 入口（R0）'，是一次刻意关闭。因此这是一套已装配路由、带完整离线多方签名 + sigstore + go-tuf v2 实现、却被产品明确关闭、且从未在更新校验中生效的死代码，是纯维护负担（依赖升级、安全扫描、编译时间、认知负荷）而无任何在产价值。
- **影响**：约 2 万行代码（含 go-tuf/sigstore/uuid 等重依赖）永久挂在编译与安全维护面上，却不产生任何在产安全价值：CVE 扫描、依赖升级、Go 版本迁移都要为一段死路径买单；新贡献者需理解一套与真实更新流毫无耦合的复杂密码学子系统。同时它是 storage 层 ListObjects/DownloadObject 两个接口方法（见 OVER-ENGINEERING-05）唯一的存活消费者——TUF 死则这些方法也随之成为纯负债。
- **建议**：做一次明确决策而非无限期搁置：要么(a)把 TUF 从主仓剥离到独立分支/模块并从 server 装配中移除，让主二进制不再编译它；要么(b)给出明确的重新启用里程碑并在 README/docs 记录“当前为不生效的预留实现”，避免后续读者误以为更新流受 TUF 保护。切忌保留“已禁用但仍编译进产物”的中间态。
- **对抗验证核实**：Verified every evidence pointer against source (cwd = server module; repo-root 'server/server/tuf' == module 'server/tuf'). (1) Line counts exact: find server/tuf -name '*.go' !-name '*_test.go' => 7312 lines / 21 files; test => 12713 lines / 17 files. (2) server.go:186-188 gates tuf.SetupRoutes behind config.GetBool("TUF_ENABLED"); no viper SetDefault exists (faynoSync.go:53 only viper.AutomaticEnv), so absent env it is false; deploy/.env.example:74 = TUF_ENABLED=false (docker-compose.yml uses 

#### `SECURITY-02` JWT 不可吊销 + 无用户存活性校验：改密/删号后旧 token 仍可访问纯 authMiddleware 路由
- **维度/严重度**：安全 · 中（初判 高）
- **位置**：server/server/utils/utils.go:40-50；server/server/utils/auth.go:36-54；server/server/utils/validate.go:17-47；server/server/server.go:135,172-184
- **问题**：JWT claims 仅含 username+exp（24h），无 jti/iat/aud/token_version，服务端无吊销机制或密码变更失效逻辑。AuthMiddleware 的 JWT 成功分支在提取 username 后直接 c.Set + c.Next，从不校验该用户是否仍存在于 admins/team_users。对只挂 authMiddleware 而不挂 CheckPermission 的路由——/whoami、/telemetry、/user/*、/users/list、/token/*、/admin/update（这些仅靠 AdminOnlyMiddleware 二次查库兜底）——第一层身份校验会放行任何已删除/已改密用户的未过期 JWT。修改密码或删除用户后，被泄露的旧 token 在最长 24 小时内仍然有效。
- **影响**：远程、需持有一枚未过期 JWT（凭据泄露、离职员工、日志泄露等场景）。被删除或已改密的账户在 token 过期前仍可调用 /whoami、/telemetry 等 authMiddleware-only 端点；无法主动强制下线。对 /user/*、/token/* 有 AdminOnlyMiddleware 二次查 admins 兜底（若该 admin 已删除则会被拦），但 team_user 类 authMiddleware-only 路由缺乏此兜底。
- **对应最佳实践**：OWASP A07:2021 — 会话/令牌失效要求；OWASP JWT Cheat Sheet：登出/改密后令牌应可失效，含 jti 支持吊销、校验时验证主体仍有效。
- **建议**：1) 在 GenerateJWT 加入 jti 与 iat，并维护服务端吊销/版本机制：为每个用户存 token_version（或 password_changed_at），ValidateJWT 后比对，token 早于该时间戳即失效。2) AuthMiddleware 的 JWT 成功分支应回查用户存活性（可加短 TTL 缓存降低开销）。示例：
```go
// GOOD: 生成时带版本
claims := jwt.MapClaims{"username": username, "ver": user.TokenVersion, "iat": now.Unix(), "exp": now.Add(24*time.Hour).Unix()}
// 校验时
if user, err := lookupUser(username); err != nil || claims["ver"] != user.TokenVersion { reject() }
```
3) 缩短 JWT 有效期并引入 refresh token；改密/删号即 bump token_version。
- **对抗验证核实**：utils.go:43-46 GenerateJWT 的 claims 只有 {username, exp:24h}，确无 jti/iat/token_version。auth.go:37-54 JWT 成功分支提取 username 后直接 c.Set+c.Next 返回，不回查用户存活或密码版本。validate.go:17-47 ValidateJWT 仅验签名/过期，无主体存活校验。server.go:135 /whoami、179 /telemetry 仅挂 authMiddleware(+telemetryMiddleware)无 CheckPermission/AdminOnly。改密路径：team/update.go:82-90 与 update/updateAdmin.go:78-86 只 update["password"]=hash，无 token 版本字段；全仓 grep 无 token_version/password_changed_at/iat/jti。兜底事实（削弱举例但不翻案）：team/whoami.go:48-66 删号后返回 401 "User 

#### `SECURITY-06` 限流仅覆盖 /login /signup，且依赖 gin.Default 默认信任所有代理的 ClientIP，可被 X-Forwarded-For 伪造绕过
- **维度/严重度**：安全 · 中（初判 中）
- **位置**：server/server/server.go:43,120-123；server/server/utils/ratelimit.go
- **问题**：限流只挂在 /login（6s、burst10）与 /signup（20s、burst3），敏感的 /upload、/download、/checkVersion、/apps/latest、以及每次 API token 请求写 last_used_at 的路径均无速率保护。更关键：router := gin.Default() 未调用 SetTrustedProxies，gin 默认信任所有代理，c.ClientIP() 会采信客户端伪造的 X-Forwarded-For。部署在 Caddy 之后若未正确配置可信代理，攻击者可通过轮换伪造 XFF 让每个请求落入不同令牌桶，从而绕过登录/注册限流进行暴力破解；反之未配代理时也可能所有真实客户端共享同一个桶。
- **影响**：远程、未认证。XFF 伪造可绕过登录限流，对 bcrypt 弱口令实施暴力破解或对 /signup 探测 API_KEY；对无限流的 /upload/download 亦无滥用防护。exploitability 取决于是否正确配置了 trusted proxies——默认 gin.Default 未配置即高危。
- **对应最佳实践**：OWASP A07 认证防暴力破解 + gin 官方安全建议：生产必须 SetTrustedProxies，切勿信任所有代理；ClientIP 用于安全决策时必须基于可信代理链。
- **建议**：1) 显式配置可信代理：router.SetTrustedProxies([]string{反代内网段}) 或使用 TrustedPlatform，使 ClientIP 只采信可信来源的 XFF。2) 将限流扩展到 /signup 已有基础上覆盖敏感与匿名高频端点（/checkVersion、/apps/latest、/download）并对 API token 的 last_used_at 写入做节流。示例：
```go
// GOOD
router := gin.New(); router.Use(gin.Logger(), gin.Recovery())
if err := router.SetTrustedProxies([]string{"10.0.0.0/8"}); err != nil { logrus.Fatal(err) }
```
- **对抗验证核实**：亲自核实：server.go:43 `router := gin.Default()`，全仓库 grep 无任何 SetTrustedProxies/TrustedPlatform/RemoteIPHeaders 生产配置（其余匹配均在 faynoSync_test.go 与 latest_test.go）。ratelimit.go:89 `limiter.getLimiter(c.ClientIP()).Allow()` 确以 ClientIP 为令牌桶键。server.go:120-123 限流仅挂 /login(6s,burst10) 与 /signup(20s,burst3)；/upload、/download、/checkVersion、/apps/latest 无限流。auth.go:92-99 每次 fns_ API token 请求都 UpdateOne 写 last_used_at，无节流。从 gin v1.9.1 官方源码核实：New() 设 ForwardedByClientIP=true、RemoteIPHeaders=[X-Forwarded-For,X-Re

#### `SECURITY-07` TUF 签名私钥以 base64 明文种子存储于 MongoDB，削弱离线密钥威胁模型
- **维度/严重度**：安全 · 中（初判 中）
- **位置**：server/server/tuf/signing/signing.go:25-70,77-105
- **问题**：TUF 各角色（root/targets/snapshot/timestamp）的 ed25519 私钥被 base64.StdEncoding 编码后以明文形式写入 Mongo 集合 tuf_private_keys（PrivateKey 字段），无信封加密、无 KMS/HSM 封装、无静态加密保证。TUF 的核心安全价值在于离线 root/targets 私钥不可被在线系统窃取；将它们明文落在与在线服务同一 Mongo 中，等于把本应离线的信任根降级为在线秘密——数据库一旦泄露（备份外泄、Mongo 未鉴权、注入读取），攻击者即可取得签名私钥伪造更新元数据。
- **影响**：需先攻破/读取 Mongo（备份、未授权访问、其它漏洞链）。一旦获得 tuf_private_keys，攻击者可伪造任意 TUF 元数据/target 签名，向更新客户端投递恶意更新——供应链攻击的最高目标。当前 TUF 更新流未真正闭环校验，短期实际影响受限，但一旦启用即为致命信任根泄露面。
- **对应最佳实践**：OWASP A02:2021 Cryptographic Failures — 敏感密钥不得明文存储，应加密静态化并使用 KMS/HSM；TUF 规范：root/targets 私钥应离线保管，在线系统只持有 snapshot/timestamp 且应受保护。
- **建议**：1) 离线密钥（root/targets）绝不落在线库：改用 KMS/HSM 或文件系统 ONLINE_KEY_DIR 隔离，root/targets 走离线签名。2) 若必须持久化在线密钥（snapshot/timestamp），至少用信封加密（KMS data key）而非明文 base64。3) 对 tuf_private_keys 强制加密静态存储与最小权限访问。示例（信封加密思路）：
```go
// GOOD
sealed, err := kms.Encrypt(ctx, privateKeyBytes) // KMS/age/nacl secretbox
keyDoc.PrivateKey = base64.StdEncoding.EncodeToString(sealed)
```
- **对抗验证核实**：signing.go:52-53 privateKey.Seed() 后 base64.StdEncoding.EncodeToString，signing.go:55-66 以明文 PrivateKey 字段 InsertOne 到 collection "tuf_private_keys"，signing.go:94 DecodeString 即得明文种子，evidence 逐行属实。generate.go:66-133 证实 keys map 覆盖 targets/snapshot/timestamp/root 及 root_extra 全部四类角色，generate.go:273 无差别调用 SavePrivateKeysToMongoDB，故离线角色 root/targets 私钥确实进入在线 Mongo。调用链核实：server.go:186 if config.GetBool("TUF_ENABLED") 包裹 tuf.SetupRoutes；.env.example:91 TUF_ENABLED=true（默认开启）；tuf.go:29-31 该端点受 authMidd

### 低危发现

#### `BEST-PRACTICE-02` context.Context 未作为函数首参，系统性违反 Go 官方 context 约定
- **维度/严重度**：Go 社区最佳实践 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/mongod/create.go, update.go, structs.go, seed.go, check.go 等 AppRepository 接口方法
- **问题**：整个仓储层把 `ctx context.Context` 放在参数列表末尾(甚至在 owner、redisClient、env 之后)，而不是 Go 官方约定的首参。调用点如 latest.go:180 也把 ctx 夹在字符串参数中间传入。Go 官方 context 包文档明确写：‘The Context should be the first parameter, typically named ctx.’ 这不仅是风格问题——ctx 靠后使 contextcheck/containedctx 类 linter 难以核验传播链，且新增参数时易把 ctx 越挤越靠后。
- **影响**：违反最广为人知的 Go 约定之一，降低接口可读性与一致性；参数顺序与生态惯例相反，团队协作/代码审查成本上升，且不利于自动化上下文传播检查。属大面积但非功能性缺陷。
- **对应最佳实践**：Go 官方 context 包文档约定‘Context 作为首参、命名 ctx’(https://pkg.go.dev/context) / Go Code Review Comments ‘Contexts’
- **建议**：逐步重构 AppRepository 及内部方法，将 ctx 提为首参(`func (c *appRepository) CreateChannel(ctx context.Context, channelName, owner string)`)，同步改调用点；可分批 PR 降低风险。
- **对抗验证核实**：32 methods place ctx after other params.

#### `BEST-PRACTICE-05` 日志几乎全为非结构化 printf 风格 + TextFormatter，可观测性弱
- **维度/严重度**：Go 社区最佳实践 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/faynoSync.go:25,38；server/ 与 mongod/ 全域 logrus 调用
- **问题**：日志用 logrus，但格式器显式设为 TextFormatter(非 JSON)，且几乎全部调用是 `logrus.Error("...: ", err)`/`Infof`/`Warnf` 这类 printf 拼接：全仓 `logrus.WithField(s)` 仅 3 处，plain 格式化调用 473 处。这意味着 error、owner、app、version、request-id 等关键字段全被拼进一整行字符串，机器无法按字段检索/聚合。另外 faynoSync.go:25 有一句 `logrus.New()`——返回的 *Logger 被丢弃，是空操作死代码(作者意图配置全局 logger 却用错 API)。
- **影响**：生产日志非结构化，难以在日志系统里按 owner/app/error 类型做检索、告警、聚合；缺少字段化上下文与 request-id 关联，排障效率低；`logrus.New()` 死代码误导读者以为已初始化独立 logger。属可观测性与工程化短板。
- **对应最佳实践**：Go 1.21+ 官方结构化日志 log/slog(https://go.dev/blog/slog) / logrus 官方‘生产用 JSONFormatter’建议
- **建议**：生产用 JSON 格式器(logrus.JSONFormatter 或迁移到标准库 log/slog——项目已在 Go 1.25)；关键路径改 `WithFields(Fields{"owner":..,"app":..,"err":err})`；删除 faynoSync.go:25 死 `logrus.New()`。
- **对抗验证核实**：亲自核实（注意 Go module 实际在 server/server/ 嵌套目录，env cwd 的 server/ 上层）：1) faynoSync.go:25 确为 `logrus.New()` 单独一行、返回的 *Logger 未接收，是丢弃返回值的空操作。2) faynoSync.go:38 确为 `logrus.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})`，非 JSON；全仓无 JSONFormatter、无 slog 引用；SetFormatter/SetLevel 仅在此一处配置。3) 非测试 `logrus.WithField(s)` 恰好 3 处：tuf/metadata/metadata_delete.go:77、utils/notifications.go:50、utils/notifications.go:356——与描述完全一致。4) latest.go 实际路径 handler/info/latest.go:183 逐字为 `logrus.Error("Error in CheckLat

#### `BEST-PRACTICE-07` 仓储层大量返回裸 interface{}，抛弃类型信息
- **维度/严重度**：Go 社区最佳实践 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/mongod/structs.go；mongod/create.go, update.go
- **问题**：AppRepository 接口有 20 个方法返回 `(interface{}, error)`(Upload/CreateChannel/CreatePlatform/CreateArch/CreateApp/UpdateApp/UpdateChannel... 等)，把本可具名的返回值(通常是插入 ID `primitive.ObjectID`/`InsertOneResult`)退化成 interface{}，调用方还得再断言。Go 惯例是返回具体类型；裸 interface{} 返回被社区视为‘懒惰的 API’，丧失编译期检查与自文档性。配合前述 map[string]interface{} 入参，整个数据层是 interface{} 进、interface{} 出。
- **影响**：接口自文档性差、调用方需二次断言并承担 panic 风险；编译期无法约束返回类型；旧式 interface{} 拼写占绝对多数，未跟进 Go 1.18+ 的 any 惯例。是数据层 API 设计与 idiomatic 度的整体短板。
- **对应最佳实践**：Go Code Review Comments ‘返回具体类型、不要用 interface{} 偷懒’ / Go 1.18 release notes ‘any 别名’(gofmt -r interface{} -> any)
- **建议**：将返回类型具化(如 `(primitive.ObjectID, error)` 或具名结果 struct)；统一把 `interface{}` 迁到 `any`(`gofmt -r 'interface{} -> any'` 可批量)。
- **对抗验证核实**：structs.go 16-48 确认 AppRepository 接口含 9 个 `(interface{}, error)` 声明(Upload/CreateChannel/CreatePlatform/CreateArch/CreateApp/UpdateApp/UpdateChannel/UpdatePlatform/UpdateArch);mongod 非测试 grep 计 20 处该签名(含 impl)。实现侧:create.go:187 返回 `uploadResult.InsertedID`(mongo driver 该字段类型即 interface{});create.go:912-926 Upload 用 type switch 处理 `*mongo.InsertOneResult`/`primitive.ObjectID` 并最终返回 `model.SpecificApp`;create.go 内 Upload 多个 return 分支返回 nil、string 错误消息、appData 三种异构类型;update.go UpdateDocument 成功路径 `

#### `BEST-PRACTICE-08` version.Must 在解析数据库中的版本串时用于运行时数据，脏数据触发 panic
- **维度/严重度**：Go 社区最佳实践 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/mongod/check.go:241-242,251,261-262
- **问题**：`version.Must` 语义等同 `MustCompile`：仅应用于编译期常量/程序内固定值，解析失败即 panic。这里却把它用在**来自数据库游标的动态值**上(latestVersion/currentVersion/游标里每条 v.Version/requiredSteps 元素)。库里若存在历史脏数据或被直写的非 semver 字符串，`version.NewVersion` 失败 → Must panic → 请求 500。Go 社区明确：`Must*` 只用于确定不会失败的输入，运行时/外部数据必须走返回 error 的普通构造函数并处理。
- **影响**：版本表一旦混入非 semver 值，查版本主链路(客户端 checkVersion/latest 会调用到)panic→500，属可被脏数据触发的可用性热区；违反 Must 的适用契约。
- **对应最佳实践**：Go 标准库 Must* 约定(如 regexp.MustCompile 文档：仅用于编译期确定成功的输入) / Go 官方‘不要对运行时输入 panic，返回 error’
- **建议**：改用 `ver, err := version.NewVersion(s); if err != nil { 记录并跳过该条/返回可控错误 }`，绝不对外部/DB 数据用 Must；入库侧已有 semver 校验也应在读取侧防御。
- **对抗验证核实**：check.go:241-242,251,261-262 confirm exactly 5 version.Must(version.NewVersion(...)) calls, all inside CheckRequiredMigrationStep; grep -c on non-test files = 5, all here. v.Version (251) and requiredSteps (261-262) do come from cursor.Decode of DB docs — evidence is factually accurate. HOWEVER: the sole caller is CheckLatestVersion at check.go:363, and immediately above it (lines 352-360) both latestApp.Version and currentVersion are already parsed with version.NewVersion + explicit err handlin

#### `CODE-SMELL-01` create/update/delete 三个 handler 复制同一套 stringly-typed switch + titleCase + 拼接 JSON key 骨架
- **维度/严重度**：代码异味 · 低（初判 高）
- **位置**：server/server/handler/create/create.go:22-146, server/server/handler/update/update.go:26-153, server/server/handler/delete/delete.go:197-238
- **问题**：CreateItem、UpdateItem、deleteEntity 三个函数是同一段逻辑的复制粘贴:都用 `func(c, repository, itemType string)` 签名,内部 `switch itemType { case "channel"/"platform"/"arch"/"app" }` 分派,每个 case 里重复 `ShouldBindJSON`->`ValidateItemName`->(update/delete 还有 `ObjectIDFromHex`) 的样板,结尾又都重复完全相同的三行 titleCase 惯用法后拼接响应 key。itemType 是 stringly-typed(primitive obsession):合法值散落在字符串字面量里,编译器无法校验,新增一类 meta 要同时改三处 switch + 三处薄封装 + handler.go。每个 case 内的 `ShouldBindJSON`/`ValidateItemName` 错误处理块逐字重复 3-4 次。这是典型的 Duplicated Code + Shotgun Surgery,与同仓库 reorder.go 已经抽出 `reorderHandler` 共用骨架的做法自相矛盾。
- **影响**：任何 meta 类型/校验/响应格式的调整都要在三个文件同步修改,极易漏改一处造成行为分叉;stringly-typed itemType 让拼错的字符串(如 "platfrom")无法在编译期发现,只在运行时落入 default 返回 400。维护成本高、回归风险大。
- **对应最佳实践**：Martin Fowler《Refactoring》Duplicated Code / Shotgun Surgery;Go 官方 Code Review Comments 反对以字符串标签驱动分支的 primitive obsession。
- **建议**：把 titleCase 三行抽成 `capitalize(itemType)` 工具函数(或直接用查表);把 itemType 从 string 改为受限枚举类型;将 create/update/delete 的 ShouldBindJSON+ValidateItemName+ObjectIDFromHex 样板抽成按 metaKind 注册的处理表(参考本包 reorder.go 的 reorderHandler 骨架),消除跨文件复制。
- **对抗验证核实**：亲自读三处代码,evidence 的字面事实全部属实:create.go:125-129、update.go:148-152、delete.go:233-237 的 titleCase 三行 + JSON key 拼接惯用法逐字重复(仅 create/update/delete 前缀与 Created/Updated/DeletedCount 后缀不同),grep 确认这三处是全 server 仅有的 cases.Title 用法。三处 switch 均为 `case channel/platform/arch/app ... default: 400 "Invalid item type"`。itemType 确为 stringly-typed,且 utils/validate.go:149 的 ValidateItemName 本身是第四份同样的 `switch itemType` 分派。reorder.go:53 确有已抽出的 reorderHandler 共用骨架(catalog 包),ReorderChannels/Platforms/Archs/Apps 四个薄封装调用它,

#### `CODE-SMELL-02` appRepository.Upload 是 319 行、8 参数、深嵌套的超长函数(God Function)
- **维度/严重度**：代码异味 · 低（初判 高）
- **位置**：server/mongod/create.go:624-942
- **问题**：单个 Upload 方法从 624 行延伸到 942 行,共 319 行,承担了:team_user 权限判定、apps_meta 查 app_id、团队 app 访问校验、channel/platform/arch meta 解析、apps 集合幂等 upsert(存在版本 append/replace、不存在 InsertOne、11000 唯一键并发降级)、changelog 拼装、缓存失效等至少 6-7 类互不相关的职责,是明显的 God Function。参数列表 8 个(ctxQuery map、appLink、extension、owner、ctx、redisClient、env、checkAppVisibility)——长参数列表本身即 code smell。函数体有 22 行处于 4 层及以上 tab 缩进,嵌套过深。
- **影响**：函数无法单元测试其内部分支(只能整体黑盒),阅读者需通读 300 行才能定位一条业务规则;并发降级、幂等 upsert 与权限校验耦合在同一作用域,改动一处易误伤其他分支,是上传两阶段非事务风险区里最难验证的一段。
- **对应最佳实践**：Fowler《Refactoring》Long Function / Long Parameter List;Go 社区惯例:单函数单一职责,超长函数拆小以利测试。
- **建议**：按职责拆分:权限/owner 派生、meta 解析(已有 resolveUploadScope 可复用)、幂等写入(append/replace/insert/11000 降级)、changelog 拼装、缓存失效各自成函数;用参数结构体(如 UploadParams)收敛 8 个入参。
- **对抗验证核实**：亲自读 mongod/create.go 全文核实：Upload 签名在 624 行，函数体到 942 行，awk 计数确为 319 行；签名确有 8 个入参(ctxQuery、appLink、extension、owner、ctx、redisClient、env、checkAppVisibility)，mongod/structs.go:24 与 tuf/bootstrap/generate_test.go:59 的接口/mock 一致。body(625-942)内 grep 'if err != nil' 得 9 处；≥4 个前导 tab 且非空的行 awk 计数为 22 行，与描述吻合。职责确实混杂：team_users 查询+Upload 权限判定(637-656)、apps_meta 查 app_id(659-668)、checkEntityAccess(672-676)、channel/platform/arch meta 解析各带一次 checkEntityAccess(679-733)、apps 幂等 upsert(739-909，含 append/replace 分支

#### `CODE-SMELL-05` 死代码:被注释的 GetAllApps 路由/接口/实现散落三处,且活代码 catalog.GetAllApps 无任何路由引用
- **维度/严重度**：代码异味 · 低（初判 中）
- **位置**：server/server/server.go:134; server/server/handler/handler.go:21,101-104; server/server/handler/catalog/get.go:80
- **问题**：GetAllApps 相关内容呈现典型的注释掉代码 + 悬挂死代码组合:server.go:134 有被注释的路由 `// router.GET("/", handler.GetAllApps)`;handler.go:21 接口里 `// GetAllApps(*gin.Context)` 被注释,handler.go:101-104 整个方法实现被注释掉;而 catalog/get.go:80 的 `func GetAllApps(...)` 仍然是活的导出函数,却没有任何非注释代码调用它(唯一引用全在注释里)。既留下了注释坟场,又留下了一个永远不会被触达的导出实现。
- **影响**：注释掉的代码是版本控制该负责的历史,留在源码里增加噪声、误导读者以为该端点将启用;catalog.GetAllApps 作为无引用的导出函数会一直被当作公共 API 维护、参与编译却永不执行,属于纯负债。
- **对应最佳实践**：Fowler《Refactoring》Dead Code / Comments;《The Pragmatic Programmer》: 不要用注释保存旧代码,交给版本控制。
- **建议**：直接删除三处注释残留(server.go:134、handler.go:21、handler.go:101-104)以及无引用的 catalog.GetAllApps 实现;确需保留则明确恢复路由并加测试,否则交给 git 历史。
- **对抗验证核实**：All four cited locations match exactly. server.go:134 `// router.GET("/", handler.GetAllApps)` (commented). handler.go:21 `// GetAllApps(*gin.Context)` (commented interface member; the live AppHandler interface does NOT declare it). handler.go:101-104 the whole method body is commented out. catalog/get.go:80 `func GetAllApps(c *gin.Context, repository db.AppRepository)` is a live exported function. `grep -rn GetAllApps --include=*.go` returns 6 hits: 1 definition + 5 references, and ALL 5 refere

#### `CODE-SMELL-06` 魔法数字:30*time.Second 请求超时字面量在 21 个文件中出现 28 次
- **维度/严重度**：代码异味 · 低（初判 中）
- **位置**：server/server/handler/catalog/list.go:16,38,60,82; server/server/handler/create/create.go:23; server/server/handler/update/update.go:27; server/server/handler/delete/delete.go:198; (共 21 个文件 28 处)
- **问题**：几乎每个 handler 都硬编码 `ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)`,精确到字面量层面共 28 处、分布在 21 个文件。30 秒这个业务超时值没有具名常量,散落各处;若要统一调整(如缩到 15s 或按端点差异化)必须逐处 grep 修改,极易漏改导致超时不一致。这既是魔法数字,又是同一行代码的大规模复制。注意 server.go 里其它超时(30*time.Second owner 校验、10*time.Second Slack)也各自裸写,进一步说明缺少集中的超时常量约定。
- **影响**：超时策略无法集中治理;不同 handler 若被误改成不同值会造成难以察觉的行为漂移;数字 30 的业务含义(为何是 30 而非 15/60)在代码里无任何说明。
- **对应最佳实践**：Fowler《Refactoring》Magic Number / Duplicated Code;将魔法值提升为具名常量是通用编码规范。
- **建议**：定义 `const handlerRequestTimeout = 30 * time.Second`(放 handler 公共包)并全局替换;或提供一个 `handlerContext(c)` 辅助函数统一构造带超时的 ctx,消除 28 处重复字面量。
- **对抗验证核实**：亲自核实：(1) `grep` 精确匹配 `context.WithTimeout(c.Request.Context(), 30*time.Second)` 得 28 处、跨 21 个文件，与 evidence 完全一致。(2) 逐行确认 catalog/list.go:16,38,60,82（Read 全文）、create/create.go:23、update/update.go:27、delete/delete.go:198 均为该字面量。(3) 全仓 `grep` 无任何具名超时常量（handlerRequestTimeout/RequestTimeout/DefaultTimeout/const .*Timeout 均无结果），也无 handlerContext/withTimeout 辅助函数（匹配到的都是测试 helper）。(4) server.go:26-33 存在 const 块，已把 `loginRateInterval = 6 * time.Second`、`signupRateInterval = 20 * time.Second` 提为具名常量——证明本仓

#### `CODE-SMELL-08` 单个 312KB / 9598 行测试文件承载 155 个 Test,是不可维护的巨型文件
- **维度/严重度**：代码异味 · 低（初判 中）
- **位置**：server/faynoSync_test.go
- **问题**：根包唯一的测试文件 faynoSync_test.go 达 9598 行、312KB、173 个顶层函数(其中约 155 个 Test 函数 + 18 个小写辅助函数),把 signup/login/upload/channel/platform/arch/telemetry/BUG 回归等所有端到端用例塞进同一个文件。测试用例之间还带有强烈的顺序/状态耦合迹象(命名如 TestSignUp / TestSignUpSecondUser / TestSecondaryAppCreate / TestSecondaryChannelCreateNightly,靠先后共享 DB 状态)。单一巨型测试文件难以并行心智定位、Review 时 diff 噪声极大、多人协作必然频繁冲突,是典型的 Large File / Divergent Change 异味。
- **影响**：任何小改动的测试 diff 都淹没在近万行文件里,Review 与合并冲突成本高;用例间隐式状态依赖使单独运行某个 Test 可能失败,削弱测试可信度;新贡献者难以按领域找到相关用例。
- **对应最佳实践**：Fowler《Refactoring》Large Class/Large File、Divergent Change;Go 测试惯例:按被测单元/领域组织测试文件,避免单文件承载全部端到端用例。
- **建议**：按领域拆分为多个 *_test.go(如 auth_test.go / upload_test.go / channel_test.go / telemetry_test.go / regression_bug_test.go),把共享 setup 抽进 helpers;显式化或消除用例间的顺序/状态耦合(用 t.Cleanup 与独立夹具),降低巨型文件的维护负担。
- **对抗验证核实**：亲自核实：wc -l=9598、wc -c=312689，与 evidence 完全一致；grep '^func '=173、'^func Test'=155，一致；根目录仅 faynoSync.go + faynoSync_test.go 两个 .go 文件，确为唯一测试文件。示例行号全部命中：TestSignUp(253)/TestSignUpSecondUser(288)、TestAppCreate(551)/TestSecondaryAppCreate(751)、TestChannelCreateNightly(1287)/TestSecondaryChannelCreateNightly(1374)。状态耦合比描述更强而非更弱：line 359 `var authToken string` 为包级变量，在 TestLogin(line 397 `authToken = token.(string)`)写入，被下游数十个测试以 `Bearer +authToken`（line 466、593、659、727...2353+）消费；另有 authTokenSecondUser(l

#### `DEFECTS-05` catalog List* 查询出错吞成空列表+200,前端无法区分'空'与'查询失败'
- **维度/严重度**：潜在缺陷 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/server/handler/catalog/list.go
- **问题**：风险图指出 catalog List* 出错仅 logrus.Error 返回空列表+200。经核对 handler 层普遍存在'查询/聚合失败仅记日志、对客户端返回空集合或 200'的降级模式,使调用方(dashboard-next features/*/api.ts)无法区分'该 owner 下真没有数据'与'后端查询失败'。当 Mongo 抖动或聚合出错时,前端会把空结果当成'资源被删空',可能引导用户误操作(如以为 channel/platform 丢失而重建),或掩盖持续性后端故障。这类静默降级在下载/查版本相邻路径尤其危险,因为错误被 200 掩盖后监控也难以发现。
- **影响**：后端故障被 200+空集合掩盖,前端与监控均无法感知,可能诱发误操作与故障漏报;属可用性与可观测性缺陷。
- **对应最佳实践**：HTTP 语义:后端故障必须以 5xx 表达,不能用 200+空体掩盖(REST 错误处理约定)。
- **建议**：List* 在 repository 返回 err 时应返回 500(或带 error 字段的非 200),让前端区分空与失败;仅在确实无匹配文档时返回空集合。
- **对抗验证核实**：server/server/handler/catalog/list.go 第28-34行(ListChannels)确证吞错模式:`if result, err := repository.ListChannels(ctx, owner); err != nil { logrus.Error(err) } else { channelsList = result }` 之后无条件 `c.JSON(http.StatusOK, gin.H{"channels": &channelsList})`——err 时 channelsList 保持 nil,返回 200+空。ListPlatforms(50-56)、ListArchs(72-78)、ListApps(94-100)同构。mongod/list.go 的 listItems(第91-104行):collection.Find 失败或 cur.All 解码失败才返回 err;无匹配文档返回 nil+空 slice,故 handler 处"空"与"失败"确被合并成同一 200 响应。前端 dashboard-next/apps/we

#### `DEFECTS-07` reorder 用非事务 BulkWrite,查存在与写 sort 之间存在 TOCTOU,失败可留部分排序
- **维度/严重度**：潜在缺陷 · 低（初判 中）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/mongod/reorder.go (reorderMeta)
- **问题**：reorderMeta 先 Find 出作用域内实际存在的 _id 集合做未知/重复校验,再对每个 assignment 构造 UpdateOne 放进 models 一次性 BulkWrite。存在两个原子性问题:(1) 校验用的 Find 与最终 BulkWrite 非同一事务,期间若有并发 delete 把某个 id 删掉,校验通过但该 UpdateOne 匹配 0 文档(默认 BulkWrite 非 ordered 保障不回滚),形成部分 sort 更新。(2) BulkWrite 本身不是事务:若中途某条写失败(或网络中断),已执行的前若干条 sort 已落库,返回 err 但排序处于半更新状态,catalog 列表顺序变成不一致的中间态。由于 reorder 是幂等重排语义,半更新会让 UI 顺序错乱且客户端无法得知哪些生效。
- **影响**：并发删除或 BulkWrite 部分失败时留下不一致的 sort 值,导致 dashboard 排序错乱;属可复现的原子性缺陷(非致命但破坏数据一致性)。
- **对应最佳实践**：多文档写一致性需事务边界;TOCTOU(检查-使用分离)是经典竞态,应在同一原子操作内完成校验与写入。
- **建议**：将 existence 校验与 BulkWrite 放入同一 Mongo 事务(replica set),或改用单次聚合/条件写保证全成或全败;至少对 BulkWrite 结果的 ModifiedCount 与期望数量比对并在不符时告警/回退。
- **对抗验证核实**：test

#### `DEFECTS-08` DownloadArtifact 里 context.WithTimeout 被丢弃,30s 超时对签名与后续无实际约束(误导性死代码)
- **维度/严重度**：潜在缺陷 · 低（初判 低）
- **位置**：/home/weifashi/projects/ttpos-artifacts/server/server/handler/download/download.go:13-16 (DownloadArtifact)
- **问题**：DownloadArtifact 用 _, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second) 建了带超时的 ctx 但用 _ 丢弃,只保留 cancel。随后调用的 utils.GeneratePresignedURL(c, ...) 内部使用的是 c.Request.Context()(见 s3.go: storageClient.GeneratePresignedURL(c.Request.Context(), ...)),完全不是这个带超时的 ctx。因此这里的 30s 超时是无效死代码:既没传给下游,也没对任何操作生效。当前下游 PresignGetObject 是本地 SigV4 签名(base_s3_client.go,无网络往返),影响面小;但这是明显的 context 未传播缺陷,若将来下游改成需要网络的操作(如换驱动),开发者会误以为已有 30s 超时保护,实际不受任何 deadline 约束。
- **影响**：当前实际影响低(下游为本地签名);但超时保护实为空,存在误导,未来下游改为网络调用时将无 deadline 约束,可能出现请求悬挂。
- **对应最佳实践**：Go context 惯例:创建的带超时 context 必须传递给下游调用才有意义;不使用则删除,避免误导性死代码。
- **建议**：删除无用的 WithTimeout,或将带超时的 ctx 通过参数真正传递到 GeneratePresignedURL 及底层存储调用,使超时生效。
- **对抗验证核实**：亲自读代码核实：download.go:14 确为 `_, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)`，带超时的 ctx 用 `_` 丢弃，仅保留 cancel；download.go:15 `defer cancel()`；download.go:16 调用 `utils.GeneratePresignedURL(c, c.Query("key"), 15*time.Minute)` 传入的是 *gin.Context 而非那个 ctx。s3.go:202 内部 `storageClient.GeneratePresignedURL(c.Request.Context(), ...)` 确实用 c.Request.Context()，与带超时的 ctx 无关。进一步核实所有存储后端的 presign 均为本地签名：base_s3_client.go:128-139(PresignGetObject 本地签名)、minio_client.go:78-84(PresignedGetObject 本

#### `MISSING-LOGIC-02` CheckRequiredMigrationStep 用 version.Must 解析库中 version 字段，非 semver 数据在无鉴权 /checkVersion 路径触发 panic
- **维度/严重度**：遗漏逻辑 · 低（初判 高）
- **位置**：server/mongod/check.go:241-262，经 check.go:363 由 CheckLatestVersion 调用
- **问题**：CheckRequiredMigrationStep 对遍历到的每个数据库文档的 version 字段执行 `version.Must(version.NewVersion(v.Version))`。version.Must 在解析失败时 panic，而 v.Version 直接来自 apps 集合文档，是存储数据、不受上传时 IsValidVersion 正则约束（历史迁移数据、直写、或旧 semver 规则不同的记录都可能是非 semver）。该函数由 CheckLatestVersion（check.go:363）调用，而 CheckLatestVersion 挂在完全无鉴权的公开路由 /checkVersion 与 squirrel RELEASES 之下。缺失的逻辑是：对存储层读出的 version 没有做 error 分支处理（对比 line 352/357 对 latestApp.Version 与 currentVersion 用的是返回 error 的 version.NewVersion），一旦命中脏数据即 panic。line 241/242 的 latestVer/currentVer 同样用 Must。
- **影响**：任意一条 version 非严格 semver 的 apps 文档会让匿名 /checkVersion 请求 panic 成 500（依赖 gin Recovery 兜底不至于进程崩溃，但该 app+channel+platform 的查版本长期不可用），构成可被脏数据触发的可用性缺口。
- **对应最佳实践**：Go 惯例：Must 仅用于程序启动期/常量、不用于运行时外部或存储数据；不可信/存储输入必须走 error 返回路径（Effective Go error handling）。
- **建议**：把这些 version.Must 全部替换为返回 error 的 version.NewVersion，解析失败的文档 skip（continue）并记 warn，而不是 panic；同时对 latestVer/currentVer 用 error 分支提前返回。
- **对抗验证核实**：路由：server/server/server.go:118 router.GET("/checkVersion", handler.FindLatestVersion) 在 line 127/129 的 router.Use(authMiddleware) 之前注册，确为匿名公开。调用链：latest.go:180 FindLatestVersion→CheckLatestVersion→check.go:363 CheckRequiredMigrationStep(唯一调用点，grep 确认)。关键排序：check.go:352-354 latestAppVersion,err:=version.NewVersion(latestApp.Version){if err!=nil return}；357-360 对 currentVersion 同样；363 才调用 CheckRequiredMigrationStep。Must 位置：check.go:241/242/251/261/262 全用 version.Must。stepVer(251)来自 required_interm

#### `MISSING-LOGIC-03` 删除版本先删 DB 文档再删 S3，S3 删除失败无回滚导致孤儿对象
- **维度/严重度**：遗漏逻辑 · 低（初判 中）
- **位置**：server/mongod/delete.go:50-63；server/server/handler/delete/delete.go:51-72
- **问题**：DeleteSpecificVersionOfApp 仓储方法在 delete.go:50 先执行 `collection.DeleteOne(ctx, filter)` 删除整条版本文档并返回 artifact links。handler 随后（delete.go:58 起）才调用 CheckPrivate、ExtractS3Key、DeleteFromS3 逐个删对象存储对象。若 CheckPrivate 出错、ExtractS3Key 报错（handler 直接 return）、或 DeleteFromS3 失败（仅 logrus.Error 不回滚），DB 记录已经删除但 S3 对象残留，成为无引用孤儿对象，且无任何补偿/重试/回滚逻辑。这是两阶段非事务操作缺少失败补偿的遗漏。
- **影响**：每次 S3 删除失败或中途 return 都留下私有/公有桶孤儿对象，长期累积占用存储与成本，且已删记录无法据此重建引用来清理。
- **对应最佳实践**：分布式两阶段清理应“先外部资源后权威记录”或采用补偿事务/最终一致清理（saga / orphan-sweeper），不可让权威记录先消失而外部对象无引用。
- **建议**：先解析出所有 S3 key 并（尽力）删除对象存储、确认成功后再删 DB 记录；或把删除结果做补偿队列/软删标记，失败对象入待清理列表，避免 DB 与对象存储不一致。
- **对抗验证核实**：已逐行核实 evidence 属实。mongod/delete.go:50 `deleteResult, err := collection.DeleteOne(ctx, filter)` 确实在函数最前部执行并删除整条版本文档，:63 返回 links 后 handler 才处理 S3。handler server/server/handler/delete/delete.go:58-72：CheckPrivate 出错直接 `return`(:62)，ExtractS3Key 出错 `c.JSON(400)+return`(:68-69)，此时 DB 记录已删、循环中断，剩余 link 对应对象全部残留。关键补充：DeleteFromS3(server/server/utils/s3.go:151-189) 签名无 error 返回值，删除失败(:182-186)只 logrus.Errorf + 向 gin context 写 500 后 `return`(从自身返回)，handler 的 for 循环并不感知失败仍继续，DB 早已删除→孤儿对象产生且无任何反馈。全仓 rg `o

#### `OVER-ENGINEERING-02` TUF_ENABLED / PERFORMANCE_MODE / ENABLE_TELEMETRY 三个独立开关过度灵活，默认组合下即产生“注册路由但 redisClient=nil→首个请求 panic”的非法状态
- **维度/严重度**：过度设计 · 低（初判 高）
- **位置**：server/server/server.go:87-99, 186-188; server/server/tuf/config/config.go:39
- **问题**：三个布尔开关彼此正交却存在隐藏依赖，却没有在装配层收敛校验，构成“非法状态可被表达”的过度灵活性。server.go:87 仅在 `PERFORMANCE_MODE || ENABLE_TELEMETRY` 为真时才连接 Redis；server.go:186 却在 `TUF_ENABLED` 为真时就注册全部 TUF 路由并把（可能为 nil 的）redisClient 传进去。而 .env.example:91 的出厂默认恰恰是 `TUF_ENABLED=true`，同时 PERFORMANCE_MODE、ENABLE_TELEMETRY 默认 false。也就是说按示例配置启动，TUF 路由会带着 nil redisClient 注册；config.go:39 `redisClient.Get(ctx, bootstrapKey)` 无任何 nil 判断，管理员一旦调用 GET /tuf/v1/config 就 panic。子系统内 nil 保护还不一致：grep 显示 tuf/ 下共 18 处 `redisClient == nil` 判断（多在 bootstrap），但 config.go 恰恰是 0 处。这类需要“开 A 必须同时开 B”的隐性耦合，正是开关过度拆分、缺乏组合校验的典型过度设计。
- **影响**：按官方示例默认配置启动时，TUF（虽已被前端禁用，仍在后端注册路由）对管理员请求会 nil 解引用 panic 打挂该 goroutine/请求；即便 TUF 未来重新启用，运维也可能踩到“只开 TUF 忘开 Redis”的静默陷阱。根因是开关粒度过细却无组合约束，把本应在启动期 fail-fast 的非法组合推迟成运行期崩溃。
- **建议**：在 StartServer 装配处加组合校验：当 TUF_ENABLED 为真且 redisClient 仍为 nil 时，要么在启动期 logrus.Fatal 明确拒绝（fail-fast），要么强制此时也连接 Redis；同时统一 tuf/ 各 handler 的 nil 保护（config.go 补齐）。更进一步，考虑把“TUF 需要 Redis”这一依赖显式建模，减少可表达的非法开关组合。
- **对抗验证核实**：亲自核实：.env.example:91 TUF_ENABLED=true、:77 PERFORMANCE_MODE=false、:9 ENABLE_TELEMETRY=false，出厂默认组合属实。server.go:87 仅在 PERFORMANCE_MODE||ENABLE_TELEMETRY 时连 Redis；server.go:186 在 TUF_ENABLED 时调 tuf.SetupRoutes(...,redisClient,...)，故默认组合下 redisClient 为 nil。tuf.go:41-43 /tuf/v1/config GET → config.GetConfig(c, redisClient)，前置中间件仅 authMiddleware, adminMiddleware，无 nil 保护。config.go:39 `bootstrapValue, err := redisClient.Get(ctx, bootstrapKey).Result()` 对可能为 nil 的 *redis.Client（go-redis/v8 v8.11.5）解引用会 

#### `OVER-ENGINEERING-03` updaters 包存在两套并行的 updater 类型校验体系，其中一整套（Get*UpdaterConfig + *Updater 结构体 + Validate*Updater）为零生产调用的死脚手架
- **维度/严重度**：过度设计 · 低（初判 中）
- **位置**：server/server/utils/updaters/sparkle.go, tauri.go, squirrel.go, electron_builder.go
- **问题**：updater 子系统里同时存在两套 updater 类型验证实现，其中一套是过早泛化出来、从未被生产代码使用的死脚手架。存活的一套是 validator.go：`ValidUpdaterTypes` 切片 + `ValidateUpdaters`（被 create.go:61、update.go:67 调用）+ 基于 `FileValidator`/`ParamValidator` 接口的 `CreateFileValidator`/`CreateParamValidator` 工厂（这套是合理的，因为各 updater 的文件/参数校验规则确实不同）。死的一套是每个 per-type 文件里的：空壳结构体 `SparkleUpdater{Type string}` / `TauriUpdater` / `SquirrelUpdater` / `ElectronBuilderUpdater`（仅存一个调用方已知的 type 字符串，无任何额外数据），`ValidateSparkleUpdater/ValidateTauriUpdater/...`（各自拿一个单元素 `[]string{"xxx"}` 做等值判断），以及包装它们的 `Get*UpdaterConfig`。grep 证实：这 4 个 `Get*UpdaterConfig` 与 4 个 `Validate*Updater` 的唯一非测试调用点就是彼此（Validate 只被同文件的 Get 调用，Get 无任何外部调用者），形成一个自我封闭的死循环。这是为“将来每种 updater 可能有独立配置对象”而预先泛化、但 YAGNI 从未兑现的典型。
- **影响**：约 100+ 行分散在 4 个文件的死代码，与真正生效的 validator.go 校验逻辑重复表达“合法 updater 类型”这一事实——一旦新增 updater 类型，维护者面对两套写法容易只改一套、误以为另一套生效，埋下认知与一致性风险；且这些空壳 config 结构体给人“存在按类型定制配置”的错觉，实际毫无内容。
- **建议**：删除 4 个 per-type 文件中的 `*Updater` 空壳结构体、`Validate*Updater` 与 `Get*UpdaterConfig`（及其测试），只保留被工厂真正使用的 `*FileValidator`/`*ParamValidator` 实现。合法类型判断统一收敛到 validator.go 的 `ValidUpdaterTypes` 单一真相源。
- **对抗验证核实**：对整个 faynoSync 模块做 grep 逐条核实：(1) GetSparkleUpdaterConfig/GetTauriUpdaterConfig/GetSquirrelUpdaterConfig/GetElectronBuilderUpdaterConfig 四个函数——全仓库只有定义、零调用点（含测试）。(2) ValidateSparkleUpdater 等四个函数——唯一调用者是同文件的对应 Get*（sparkle.go:24、tauri.go:27、squirrel.go:76、electron_builder.go:58），无任何外部消费者，形成自封闭死环。(3) 四个 *Updater 空壳 struct 仅含一个 Type 字段，仅在死环内部被构造。(4) 存活校验路径确认无误：create.go:61 与 update.go:67 调用 updaters.ValidateUpdaters -> ValidateUpdater -> validator.go:21 的 ValidUpdaterTypes 切片；文件/参数校验走 CreateFileValida

#### `OVER-ENGINEERING-04` sparkle updater 是暴露给前端用户可选、却在查版本响应端只返回 test_stub 的半成品功能（YAGNI 反向：提前铺开了不工作的表面）
- **维度/严重度**：过度设计 · 低（初判 中）
- **位置**：server/server/utils/updaters/updaters.go:54-56; dashboard-next/apps/web/src/features/platforms/updaters.ts:13
- **问题**：sparkle 被完整铺进了整条链路的“输入侧”却在“输出侧”是死的，属于提前暴露了不工作的功能表面。证据：validator.go:25 把 'sparkle' 列入 `ValidUpdaterTypes`（可通过 upload/create 校验）；updaters.go:138 BuildS3Key 的 sparkle 分支 fallthrough 到 electron-builder 逻辑（能正常生成 S3 key）；前端 platforms/updaters.ts:13 明确把 sparkle 作为用户可选项呈现（label 'Sparkle'，description 'Sparkle appcast-compatible artifacts'）。但在真正决定客户端能否拿到更新的 BuildResponse 里，updaters.go:54-56 的 sparkle 分支直接返回 `gin.H{"status": "test_stub", "updater": "sparkle"}` 且 HTTP 200，注释写着 'Test stub for sparkle'。即：用户可以创建 sparkle 平台、上传制品、通过全部校验，但客户端查版本永远拿到一个占位 stub 而非可用的 appcast。这是典型的“为将来支持某协议先把表面全铺开、核心实现留 stub”的过度设计——不完整功能却对用户可见可选。
- **影响**：运维/用户会误以为 Sparkle 已受支持（前端明确提供该选项、上传全程无报错），实际客户端得到的是无意义 stub，属于对外可见的假功能。此外该 stub 以 200 返回而非明确的“未实现/未找到”，掩盖了缺陷、增加将来排障成本。
- **建议**：二选一：(a) 若近期不实现 Sparkle appcast，则从 `ValidUpdaterTypes` 和前端 updaters.ts 选项中移除 sparkle，让“不支持”在输入侧就明确拒绝；(b) 若要保留，则补齐 BuildResponse 的真实 appcast/重定向实现并去掉 test_stub。无论哪种，都不应让“可选、可上传、但响应是 stub”的中间态对用户可见。
- **对抗验证核实**：逐条核实全部属实且有加强：(a) updaters.go:54-56 sparkle 分支 return gin.H{"status":"test_stub","updater":"sparkle"}, 200，注释 // Test stub for sparkle——确认。(b) updaters.go:138-141 BuildS3Key 的 sparkle 分支 fallthrough 到 electron-builder，正常生成可用 S3 key——确认。(c) validator.go:25 ValidUpdaterTypes 含 "sparkle"，ValidateUpdater 会放行——确认。(d) 前端 updaters.ts:13 UPDATER_OPTIONS 含 sparkle；且 updater-selector.tsx:62 用 UPDATER_OPTIONS.map 渲染为 Checkbox，只有 manual 被 disabled（第79行），sparkle 真实可勾选——比发现描述更强（发现只提到常量列表，我确认了它被渲染为交互控件）。(e) 额外：

#### `OVER-ENGINEERING-05` StorageClient 接口的 DownloadObject/ListObjects 与 BaseS3Client.UploadObjectWithACL 属被 5 份/1 份实现却仅服务于死子系统（或完全无调用）的冗余表面
- **维度/严重度**：过度设计 · 低（初判 低）
- **位置**：server/server/utils/storage/interfaces.go:15-16; base_s3_client.go:101-113
- **问题**：存储抽象本身是合理的（见下方“合理抽象”说明），但接口表面存在为将来预留而膨胀、当前仅服务死代码或完全无调用的方法。(1) `DownloadObject` 与 `ListObjects` 被 5 个存储实现（AWS/DO/MinIO/GCS/Base）各实现一遍，但 grep 证实二者在主业务流零调用，唯一非测试消费者是 tuf/storage/storage.go:108（DownloadMetadataFromS3）与 :130（ListMetadataFromS3）——即它们只为已被禁用的 TUF 子系统而存在，随 OVER-ENGINEERING-01 一并成为负债。(2) `BaseS3Client.UploadObjectWithACL`（base_s3_client.go:102）grep 证实全仓零调用（含测试），是彻底的死方法。这类“接口先把可能用到的 IO 操作都列上、实现全体陪跑”的做法是接口过早泛化。
- **影响**：每新增一个存储驱动都被迫实现 2 个业务侧从不调用的方法（DownloadObject/ListObjects），抬高扩展成本；UploadObjectWithACL 则是纯死代码。规模不大，但与 TUF 负债耦合放大：TUF 一旦剥离，这两个接口方法可一并从主路径消除。
- **建议**：若采纳 OVER-ENGINEERING-01 剥离 TUF，则把 DownloadObject/ListObjects 从主 StorageClient 接口移出（可下沉为 TUF 专用的窄接口，遵循接口隔离原则），主业务侧接口只保留 UploadObject/UploadPublicObject/DeleteObject/GeneratePresignedURL；删除无人调用的 UploadObjectWithACL。
- **对抗验证核实**：interfaces.go:15-16 确实声明 DownloadObject/ListObjects 于 StorageClient 接口。全仓 `rg '\.DownloadObject\('` 非测试调用者仅 tuf/storage/storage.go:108；`rg '\.ListObjects\('` 非测试非 storage 调用者仅 tuf/storage/storage.go:130（minio_client.go:110 的 ListObjects 是 minio SDK 调用，非本接口方法）。生产实现只有 3 份：base_s3_client.go:142/167、minio_client.go:87/109、google_cloud_storage_client.go:187/211；aws_s3_client.go 与 digitalocean_spaces_client.go 通过嵌入 *BaseS3Client 继承，未重写这两方法。关键：`rg -rl 'faynoSync/tuf/' --type go | grep -v _test.go | gre

#### `OVER-ENGINEERING-06` DigitalOceanSpacesClient 逐字复制 BaseS3Client 的 UploadObject/DeleteObject/GeneratePresignedURL 三个方法，属可直接删除的冗余覆盖
- **维度/严重度**：过度设计 · 低（初判 低）
- **位置**：server/server/utils/storage/digitalocean_spaces_client.go:39-53,77-100
- **问题**：DigitalOceanSpacesClient 通过 `*BaseS3Client` 嵌入（digitalocean_spaces_client.go:16-18），Go 会自动提升基类方法，因此它只需覆盖真正不同的 `UploadPublicObject`（硬编码 public-read ACL + 自定义 URL 拼接，:56-74，确有差异）。但该文件却额外重写了 `UploadObject`(:39-53)、`DeleteObject`(:77-86)、`GeneratePresignedURL`(:89-100) 三个方法，其实现与 BaseS3Client 对应方法逐字等价（同样的 s3 SDK 调用、同样的错误包装，仅错误信息里的 provider 名不同）。这些覆盖不改变任何行为，删除后嵌入的基类方法会自动接管，输出完全一致。属于典型的复制粘贴式冗余，增加了改一处需同步多处的维护面。
- **影响**：三段冗余覆盖使 DO 驱动无谓膨胀，且制造“DO 可能有特殊删除/预签名逻辑”的错觉；未来若在 BaseS3Client 修正 Delete/Presign 行为，DO 会因这层影子覆盖而被漏掉，形成隐性不一致。规模小、无正确性风险，故定为 low。
- **建议**：删除 DigitalOceanSpacesClient 的 UploadObject/DeleteObject/GeneratePresignedURL 三个方法，仅保留确有差异的 UploadPublicObject，依赖 `*BaseS3Client` 嵌入自动提升其余方法。
- **对抗验证核实**：实际路径为 server/server/utils/storage/(仓库为嵌套 server/server 布局，发现给的路径正确)。逐行核对：DO UploadObject(:39-53) 与 Base UploadObject(base_s3_client.go:85-99) 构造相同 PutObjectInput、相同 contentType 守卫、相同 PutObject 调用，仅错误 Message 由字面量 vs sprintf(providerName)，展开后同值。DO DeleteObject(:77-86)==Base(:116-125)，DO GeneratePresignedURL(:89-100)==Base(:128-139)，均逐字等价。DigitalOceanSpacesClient 结构体为 `struct { *BaseS3Client }`(:16-18)，Go 会提升 Base 的所有导出方法。providerName 在 :29 唯一处硬编码为 "DigitalOcean Spaces"，无第二条构造路径能改它。对照 aws_s3_clien

#### `SECURITY-08` 多租户下 CheckPrivate 不带 owner 过滤且取首条文档，可致同名 app 公私桶归属判定错误（跨租户信息暴露/误私有化）
- **维度/严重度**：安全 · 低（初判 中）
- **位置**：server/server/utils/check.go:194-213；server/server/utils/s3.go:124-146
- **问题**：CheckPrivate 仅按 app_name 查询 apps_meta（bson.M{"app_name": input}），不带 owner 过滤，且遍历 cursor 后返回第一条命中文档的 private 字段。在多租户部署下，不同 owner 可能存在同名 app，查询将无差别命中并取到任意租户的记录，导致上传/删除时公桶 vs 私桶的判定基于错误租户的可见性设置：可能把本应私有的制品写入 public-read 桶（公开泄露），或反之把公开制品放进私有桶导致 /apps/latest 直链 403。桶选择这一安全边界依赖了一个非 owner-scoped 的查询。
- **影响**：需存在跨租户同名 app 的多租户部署。错误的可见性判定可把私有制品以 public-read ACL 上传到公桶，构成未授权公开泄露（配合公桶直链 URL 匿名可下），或误将公开制品私有化影响可用性。属租户隔离与设计缺陷，触发条件依赖命名冲突，故评 medium。
- **对应最佳实践**：OWASP A01:2021 — 所有 owner-scoped 查询必须带租户过滤（该 JSON 已指出'所有查询 owner-scoped' 为不变量，CheckPrivate 是破例）；安全相关判定不得依赖非确定性的首条匹配。
- **建议**：1) CheckPrivate 必须带 owner 过滤并对结果唯一性负责：
```go
// GOOD
func CheckPrivate(appName, owner string, db *mongo.Database, ctx *gin.Context) (bool, error) {
    var doc struct{ Private bool `bson:"private"` }
    err := db.Collection("apps_meta").FindOne(ctx, bson.M{"app_name": appName, "owner": owner, "app_name": bson.M{"$exists": true}}).Decode(&doc)
    if errors.Is(err, mongo.ErrNoDocuments) { return false, nil }
    return doc.Private, err
}
```
2) 调用点传入已解析的 owner（ownership.ResolveOwner），确保桶选择永远基于正确租户的可见性设置。
- **对抗验证核实**：亲自核实：check.go:195 `Find(ctx, bson.M{"app_name": input})` 确无 owner 过滤，check.go:200-207 遍历游标返回首条命中的 private。s3.go:124-146 确以该返回值二选一落桶（public 桶走 UploadPublicObject 打 public-read ACL / 私桶走 UploadObject）。四个调用点（upload.go:184、update.go:200、delete.go:58/114）均先正确解析 owner（ResolveOwner/OwnerOrUsername）并用于真正的元数据写入（PrepareUpload、DeleteSpecificVersionOfApp 等都是 owner-scoped），却唯独把 owner 漏给了 CheckPrivate。前置条件为真：迁移 20250410145736_...up.json 建立唯一索引 key=(app_name,owner,created)、unique=true，说明同名 app 在不同 owner 下可合法共存

## 五、被对抗验证驳回的发现（8 条）

以下发现在评审阶段被提出，但独立怀疑者回读源码后判定不成立或严重度被高估，**未纳入推进计划**。保留于此以示评审严谨度，也提醒勿据此改动。

- **`DEFECTS-02` CheckRequiredMigrationStep 用 version.Must 解析库中版本,脏数据必 panic -> 500**
  - 驳回理由：The finding's literal code citations are accurate but its impact hinges on a premise it never substantiates: that the apps collection can hold a non-semver `version` string. Every write path that sets the `version` field enforces strict SemVer 2.0.0. Create/upload (mongod/create.go:870, 883) writes `ctxQuery["version"]`, which passed `IsValidVersion` (strict semver.org regex at server/utils/valida
- **`DEFECTS-06` InvalidateCache 用 KEYS 通配扫描删除,大 keyspace 下阻塞 Redis**
  - 驳回理由：发现把一个"真但低危"的观察和一个"错误"的正确性断言捆绑在一起，而作为 medium 定级主驱动的正确性断言站不住脚：

(1) stale-cache 断言(核心正确性 bug)是错的。失效 pattern 以 `arch=*` 结尾。Redis glob 匹配(stringmatchlen)中，位于模式末尾的 `*` 会贪婪吞掉键剩余的整个后缀——包括 `&updater=...&package=...`。因此 `owner=*&app_name=NAME&version=*&channel=CH&platform=*&arch=*` 同时命中 `...&arch=arm64` 和 `...&arch=arm64&updater=tauri&package=.dmg`。带 updater/package 后缀的键会被正常失效，不会 stale。发现误把 `arch=*` 当作锚定/精
- **`MISSING-LOGIC-07` InvalidateCache 用 Redis KEYS 通配扫描删缓存，大 keyspace 阻塞 Redis，且 pattern 缺 updater/package 维度与 CreateCacheKey 不同构**
  - 驳回理由：该发现的核心"缺失逻辑/漏失效"论点不成立，且被其自身证据自我驳斥。失效 pattern 以开放尾通配 `arch=*` 结尾，Redis glob 中 `*` 匹配任意后续字符（含 `&updater=...&package=...`），因此 CreateCacheKey 追加的 updater/package 维度键当前完全被覆盖——发现自己也承认"`arch=*` 的尾部 `*` 虽能匹配带后缀的 key"。所以今天不存在任何"漏失效→客户端 24h 拿旧版本"的现象，撑起 medium 严重级的影响链并不发生。剩下的"结构耦合脆弱→未来漂移漏失效"纯属假设：由于 pattern 以开放 `*` 收尾，任何像现有 updater/package 一样"追加"的新维度都会被自动匹配，漂移只在极为牵强的场景（在固定锚字段 channel 之前插入新字段，或改动固定字段序列化格式）才可能咬
- **`SECURITY-03` TUF 只开 TUF_ENABLED 而未开 Redis 时，管理端 TUF 端点 nil 解引用 panic（DoS）**
  - 驳回理由：发现的机制层面部分属实（config.GetConfig/PutConfig 确实在 redisClient 可能为 nil 时无判空直接 redisClient.Get()，且 .env.example 默认组合会让 redisClient=nil），但其定性为"high 安全性 DoS / 进程崩溃 / 打崩整个 API 进程、影响所有租户"是错误的，因此按其陈述的影响判 isReal=false。决定性反驳：路由由 gin.Default() 创建（server.go:43），gin.Default() = New() + Use(Logger(), Recovery())，Recovery 中间件处于中间件链最前端，用 deferred recover() 包裹每个请求。config handler 里 nil *redis.Client 的解引用 panic 会被 Recover
- **`SECURITY-04` 多租户模式下查版本/latest 的 owner 来自客户端 query，无访问控制，任意租户数据可枚举**
  - 驳回理由：这条发现描述的代码事实全部属实，但作为一条"高危、现网可利用"的 A01 漏洞不成立，理由有三：

1) 风险在本仓库的实际部署中已闭合。发现自己承认"仅当强制单租户 DEPLOYMENT_OWNER 时该风险闭合"。而 docs/plan/PLAN-032.md（status: deployed）第 3、138 行明确记录 prod 与 vm-node02 均以 DEPLOYMENT_OWNER=ttpos 运行（single-owner mode ON），并端到端验证过 owner=GARBAGE/空 被覆盖为 ttpos（返回 302/200）。即 server.go:59-72 的启动逻辑在生产上 ownership.Enabled()==true，latest.go:144-146 与 266-269 的覆盖分支恒生效，客户端传入的 owner 被服务端单例覆盖。多租户"任意租户
- **`SECURITY-05` CORS 允许携带凭据且反射匹配到的 Origin；配置为空/宽松时风险放大**
  - 驳回理由：该 CORS 实现已经是 OWASP 推荐的安全形态：只有当请求 Origin 与配置白名单条目发生严格全字符串相等（`allowedOrigin == origin`，server.go:203-208）时才会反射并附带 credentials，没有任何通配、子串、后缀或“反射任意 Origin”的逻辑。发现自身也承认三点：(a) `"*"` 不会真正通配（“尚安全”）；默认 `ALLOWED_CORS=http://localhost:3000` “相对安全”；“风险主要来自误配”。因此该发现的实质仅剩“运维可能把白名单填错”，而这是所有基于白名单的 CORS 实现共有的、且是唯一可能的语义，不构成本代码的缺陷。关于空串边界(b)：`strings.Split("", ",")` 确得 `[""]`，无 Origin 头的请求（origin==""）会命中并反射空 ACAO+crede
- **`BEST-PRACTICE-03` 大量使用 map[string]interface{} + 非 ok 类型断言传递请求参数，panic 型断言遍布 handler**
  - 驳回理由：发现把一个真实存在的"不 idiomatic"风格问题（map[string]interface{} + 无 ok 断言）夸大成 high 级"可用性 panic 热区"，而 panic 前提在当前代码里不可达。每一处被点名的 `.(string)` 断言都作用在一个由本仓库自己构造、键集固定且类型静态可证为 string 的 map 上，外部输入无法让键缺失或类型不符：

1) ValidateParamsLatest（GET 的 /checkVersion、/apps/latest）恒定用字面量构造全部 8 个键，值全部来自 c.Query()（gin 恒返回 string）；随后只把 platform/arch/updater 覆盖为 CheckPlatformsLatest/CheckArchsLatest 的 string 返回值；owner 覆盖为 DeploymentOwne
- **`BEST-PRACTICE-04` 生产未设 gin.ReleaseMode；router.Run() 忽略返回错误且无超时/优雅停机**
  - 驳回理由：发现的核心且最重的论点——“服务默认以 debug 模式运行、泄露路由/调试信息并降低性能”——是错误的。gin 在 mode.go 的 init() 里读取 os.Getenv("GIN_MODE") 并调用 SetMode()，这发生在包初始化阶段、早于 server.go:43 的 gin.Default()。而 deploy/docker-compose.yml:11 对 api 服务（即生产镜像 ghcr.io/.../faynosync-server:latest）显式设置了 `- GIN_MODE=release`。因此实际部署跑在 release 模式，不会打印 debug 警告、不输出调试日志。用环境变量 GIN_MODE=release 是 gin 官方文档明确认可的、与显式 gin.SetMode(gin.ReleaseMode) 等价的惯用做法；发现只 grep 了

## 六、推进计划

### 主题归并

- **安全边界与鉴权收口（最高优先）** [SECURITY-01、MISSING-LOGIC-01、SECURITY-02、SECURITY-06、SECURITY-08、MISSING-LOGIC-04]
  - 核心风险集中在此。/download 在私有模式下先于 authMiddleware 注册且 key 无归属/穿越校验，构成匿名跨租户 IDOR（全系统最高危，已核实 server.go:125-131 与 download.go:16）。其余为 JWT 不可吊销无存活性校验、限流仅覆盖登录且依赖默认信任所有代理的 ClientIP、以及 CheckPrivate 多租户下不带 owner 过滤取首条导致公私桶归属判定错误。共同根因是'把知道标识符当作授权依据'与'租户过滤有例外'。
- **错误处理与可用性稳定性** [DEFECTS-01、MISSING-LOGIC-02、BEST-PRACTICE-08、DEFECTS-05、DEFECTS-08、DEFECTS-03、OVER-ENGINEERING-02]
  - 请求路径存在两类可用性陷阱：可远程触发的进程级 DoS（signup 畸形密码→CreateUser bcrypt 失败→logrus.Fatal→os.Exit，已核实 createUser.go:18），以及脏数据触发的 panic（version.Must 解析 DB 中非 semver 版本串、TUF nil redisClient 解引用、类型断言无 ok 分支）。此外 List 出错吞成 200+空集掩盖故障、DownloadArtifact 的 WithTimeout 被丢弃形成误导性死代码。
- **数据一致性与两阶段非事务** [DEFECTS-04、MISSING-LOGIC-03、DEFECTS-07]
  - 跨存储写入缺事务边界：多文件上传先全部 UploadToS3 再逐个写库，中途失败留 S3 孤儿对象与部分版本文档；删除版本先删 DB 再删 S3，S3 失败无回滚同样产生孤儿对象；reorder 用非事务 BulkWrite 存在 TOCTOU 可留部分排序。均非致命但持续侵蚀数据/存储一致性。
- **去过度设计与死代码清理** [OVER-ENGINEERING-01、OVER-ENGINEERING-03、OVER-ENGINEERING-04、OVER-ENGINEERING-05、OVER-ENGINEERING-06、CODE-SMELL-05]
  - 约 2 万行 TUF 子系统（后端 ~7300 + 测试 ~12700）已被主动禁用且从未接入核心分发流，是最大的'建了没用'负债，且是 storage 层 DownloadObject/ListObjects 唯一存活消费者。此外 updaters 有两套并行校验体系（一套死脚手架）、sparkle 是对外可选但只返回 test_stub 的半成品、DO 驱动逐字复制 Base 方法、GetAllApps 死代码散落三处。需要一次明确的保留/剥离决策而非无限期搁置。
- **CI 质量门与工程化基线** [BEST-PRACTICE-01、BEST-PRACTICE-05、BEST-PRACTICE-02、BEST-PRACTICE-07]
  - Server CI 没有任何 Go 质量门（无 go test/vet/golangci-lint/gosec/govulncheck），上面多条缺陷（丢 err、可疑断言、已知 CVE）本可被静态检查拦住却一路合入。日志非结构化、ctx 未作首参、仓储层大量裸 interface{} 是 idiomatic 度短板。补 CI 门禁是防止回归的杠杆点。
- **重复代码与可维护性** [CODE-SMELL-01、CODE-SMELL-02、CODE-SMELL-04、CODE-SMELL-06、CODE-SMELL-08]
  - create/update/delete 三个 handler 复制同一套 stringly-typed switch+titleCase 骨架、catalog List* 四函数逐字复制、Upload 是 319 行 8 参数 God Function、30s 超时字面量散落 21 文件 28 处、单个 9598 行测试文件承载 155 用例。均为 low，但抬高每次改动的回归风险，建议在触碰相关文件时顺手收敛。

### 路线图

#### P0 立即修复（本周内，阻断在产高危）

| 事项 | 成本 | 影响 | 关联发现 | 验收标准 |
|------|------|------|----------|----------|
| **堵死 /download 匿名跨租户 IDOR：无条件走 authMiddleware + key 归属与穿越校验**<br/><sub>这是全系统唯一 critical。已核实 server.go:125-131 在私有模式下把 /download 注册在 router.Use(authMiddleware) 之前（gin Use 只对其后路由生效），download.go:16 又直接把 c.Query('key') 交给 GeneratePresignedURL 对私有桶签 15min 直链。攻击者从公开 /apps/latest 或 /checkVersion 响应即可拿到 key，跨租户读取整个私有桶。影响面=全部私有制品泄露。</sub> | M | high | SECURITY-01、MISSING-LOGIC-01、DEFECTS-08 | 两种开关组合下 /download 均在 authMiddleware 之后注册并保留 CheckPermission(download,apps)；DownloadArtifact 内按已鉴权用户 ResolveOwner 派生的 owner 前缀校验 key（拒绝跨 owner 前缀、含 .. 或以 / 开头的 key），API token 额外校验 allowed_apps 命中；匿名公开下载只走 public 桶直链（/apps/latest 302）不经此签名路由。新增回归测试：匿名请求私有 key 返回 401/403、跨租户 key 返回 403、路径穿越 key 返回 400、合法 owner 请求 302 到 presigned URL。顺手删除 download.go:14 被丢弃的 WithTimeout 或将带超时 ctx 真正传入。 |
| **修复 signup 可远程触发的进程级 DoS：CreateUser bcrypt 失败返回 error 而非 logrus.Fatal**<br/><sub>已核实 createUser.go:18 在 bcrypt.GenerateFromPassword 失败时 logrus.Fatal→os.Exit(1)。持有 API_KEY 的调用方（CI/建号流程）用一个 >72 字节畸形密码即可让整进程退出，需外部重启，属可远程触发的进程级 DoS。</sub> | S | high | DEFECTS-01 | CreateUser 的 bcrypt 失败 return err，signup handler 转成 HTTP 4xx/5xx 而非进程退出；ValidatePasswordStrength 增加最大长度上限（<=72 字节）在入口提前拒绝。新增测试：72+ 字节密码 signup 返回明确 4xx 且进程存活，全库 rg 确认请求路径无残留 logrus.Fatal/os.Exit。 |

#### P1 短期（2 周内，堵可用性与鉴权二线风险）

| 事项 | 成本 | 影响 | 关联发现 | 验收标准 |
|------|------|------|----------|----------|
| **消除脏数据 panic：version.Must 全部改为返回 error 并跳过非 semver 文档**<br/><sub>已标注 check.go:241-262 用 version.Must 解析 DB 中 version 字段，历史或直写的非 semver 值会让无鉴权 /checkVersion panic→500，该 app+channel+platform 查版本长期不可用。Must 契约仅适用于编译期常量，不该用于运行时/存储数据。</sub> | S | high | MISSING-LOGIC-02、BEST-PRACTICE-08 | check.go 中所有 version.Must 改为 version.NewVersion 的 error 分支，解析失败的文档 continue 并记 warn；同时排查 create.go/update.go 中无 ok 的类型断言补齐 ok 分支。新增测试：库中混入非 semver 版本文档时 /checkVersion 返回可控结果而非 500。 |
| **限流与代理信任加固：SetTrustedProxies + 扩展限流到匿名高频端点**<br/><sub>gin.Default 默认信任所有代理，部署在 Caddy 后未配 trusted proxies 时 X-Forwarded-For 可伪造绕过登录限流；且 /checkVersion /apps/latest /download 无任何限流。</sub> | S | medium | SECURITY-06 | StartServer 显式 router.SetTrustedProxies 为反代内网段（失败 fatal）；限流覆盖 /signup 之外的匿名高频端点并对 API token last_used_at 写入做节流。验证：伪造 XFF 无法绕过登录限流桶，可信代理链下 ClientIP 取值正确。 |
| **JWT 可吊销 + 用户存活性校验**<br/><sub>JWT claims 仅 username+exp，改密/删号后旧 token 直到过期仍可访问 /whoami /telemetry 等 authMiddleware-only 路由，无法主动下线。team_user 路由缺少 AdminOnly 的存活兜底。</sub> | M | medium | SECURITY-02 | GenerateJWT 加入 jti/iat 与 token_version（或 password_changed_at）；AuthMiddleware JWT 成功分支回查用户存活性（可加短 TTL 缓存）；改密/删号即 bump token_version 使旧 token 失效。测试：删号后旧 token 访问 authMiddleware-only 路由返回 401。 |
| **CheckPrivate 增加 owner 过滤，消除多租户公私桶归属误判**<br/><sub>check.go:194-213 CheckPrivate 仅按 app_name 查询不带 owner 且取首条，多租户同名 app 可能把私有制品以 public-read 上传到公桶（匿名可下）或误私有化。破坏了'所有查询 owner-scoped'不变量。</sub> | S | medium | SECURITY-08、MISSING-LOGIC-04 | CheckPrivate 签名增加 owner 参数并把 owner 加入过滤条件，调用点传入 ResolveOwner 解析结果；结果唯一性有保证。测试：跨租户同名 app 各自的 private 设置被正确解析到对应桶。 |
| **List* 查询错误不再吞成 200+空集**<br/><sub>catalog/list.go 四个 List 出错仅 logrus.Error 后返回空列表+200，后端故障被掩盖，前端与监控无法区分'真没有'与'查询失败'。</sub> | S | medium | DEFECTS-05 | repository 返回 err 时 List 返回 5xx（或带 error 字段的非 2xx），仅无匹配文档时返回空集；前端可区分空与失败。 |

#### P2 中期（1 个月内，工程化基线与一致性）

| 事项 | 成本 | 影响 | 关联发现 | 验收标准 |
|------|------|------|----------|----------|
| **为 Server 补齐 Go CI 质量门**<br/><sub>当前 Server CI 无 go test/vet/golangci-lint/gosec/govulncheck，上面多条缺陷本可被静态检查提前拦住。这是防止回归的最高杠杆项，应尽早落地以守住 P0/P1 成果。</sub> | M | high | BEST-PRACTICE-01 | build-server.yaml 新增 lint/test job 作为 build 的 needs 前置：go vet ./...、go test ./...、golangci-lint run（启用 errcheck/govet/staticcheck/gosec/errorlint/contextcheck）、govulncheck ./...；仓库补 .golangci.yml。PR 在任一 gate 失败时被阻断合入。 |
| **上传/删除两阶段写入引入事务或补偿，消除 S3 孤儿对象**<br/><sub>多文件上传先全部 UploadToS3 再逐个写库、删除先删 DB 再删 S3，均非事务，中途失败留孤儿对象与部分版本文档，长期累积占用桶且无清理路径。</sub> | L | medium | DEFECTS-04、MISSING-LOGIC-03、DEFECTS-07 | 同一次上传的多文件写库放入 Mongo 事务（replica set client.UseSession）失败整体回滚，或写库失败时回删本次已上传 S3 对象；删除改为先删 S3 确认成功再删 DB 或引入待清理补偿队列；reorder 的 existence 校验与 BulkWrite 放同一事务或比对 ModifiedCount。测试：注入中途失败断言无孤儿对象与部分文档残留。 |
| **TUF 子系统去留决策并落地**<br/><sub>约 2 万行 TUF 已被主动禁用且从未接入核心分发流，永久挂在编译与安全维护面上（CVE 扫描、依赖升级、Go 迁移都要为死路径买单），且是 storage DownloadObject/ListObjects 唯一存活消费者。需明确决策而非无限期搁置。若只开 TUF_ENABLED 不开 Redis 还会 nil 解引用 panic。</sub> | L | medium | OVER-ENGINEERING-01、OVER-ENGINEERING-05、DEFECTS-03、OVER-ENGINEERING-02、SECURITY-07 | 做出二选一决策：(a) 把 TUF 从 server 装配剥离到独立分支/模块使主二进制不再编译它，并把 DownloadObject/ListObjects 下沉为 TUF 专用窄接口；或 (b) 给出重新启用里程碑并在 README/docs 记录'当前为不生效的预留实现'，同时在 StartServer 加 TUF_ENABLED 需 Redis 的启动期 fail-fast 校验、补齐 config.go nil 保护、离线私钥不再明文存 Mongo。不保留'已禁用但仍编译进产物且会 panic'的中间态。 |
| **sparkle 半成品与 updaters 死脚手架收敛**<br/><sub>sparkle 对前端可选、可上传但查版本响应只返回 test_stub，是对外可见的假功能；updaters 存在两套并行校验体系（Get*UpdaterConfig/*Updater/Validate*Updater 为零调用死脚手架）。</sub> | S | low | OVER-ENGINEERING-04、OVER-ENGINEERING-03 | sparkle 二选一：从 ValidUpdaterTypes 与前端 updaters.ts 移除，或补齐真实 appcast 响应；删除 4 个 per-type 文件中的死脚手架，合法类型判断收敛到 validator.go 的 ValidUpdaterTypes 单一真相源。 |

#### P3 长期（按触碰顺手收敛，降低维护成本）

| 事项 | 成本 | 影响 | 关联发现 | 验收标准 |
|------|------|------|----------|----------|
| **重复 handler 骨架抽取（create/update/delete/catalog List*）**<br/><sub>三个 handler 复制同一套 stringly-typed switch+titleCase，List* 四函数逐字复制，itemType 拼错只能运行时落 default。任何 meta 类型/校验调整要同步改多处，易漏改。</sub> | M | low | CODE-SMELL-01、CODE-SMELL-04 | 参照同包 reorder.go 骨架把 create/update/delete 收敛到按 metaKind 注册的处理表，List* 收敛为泛型/闭包 listHandler；itemType 从 string 改为受限枚举。行为不变，测试全绿。 |
| **拆分 319 行 Upload God Function**<br/><sub>mongod/create.go:624-942 是 319 行 8 参数深嵌套函数，是上传两阶段非事务风险区里最难验证的一段，内部分支无法单元测试。</sub> | M | low | CODE-SMELL-02 | 按职责拆为 meta 解析/幂等写入/changelog 拼装/缓存失效等子函数，用 UploadParams 结构体收敛入参，关键分支可独立单测；对外行为与测试不变。 |
| **结构化日志、context 首参、any 与超时常量等 idiomatic 收敛**<br/><sub>日志非结构化难聚合告警、ctx 未作首参违反 Go 约定、仓储层大量裸 interface{}、30s 超时字面量散落 28 处、9598 行巨型测试文件。均为 low，随触碰顺手改。</sub> | L | low | BEST-PRACTICE-05、BEST-PRACTICE-02、BEST-PRACTICE-07、CODE-SMELL-06、CODE-SMELL-08、OVER-ENGINEERING-06、CODE-SMELL-05 | 生产用 JSON 日志器并在关键路径 WithFields(owner/app/err)；分批把 AppRepository 的 ctx 提为首参；gofmt -r 'interface{} -> any'；超时提为具名常量 handlerRequestTimeout；巨型测试文件按领域拆分；删除 GetAllApps 死代码与 DO 驱动冗余覆盖。每批 PR 独立且测试全绿。 |

### Quick Wins（低成本高回报，建议随 P0/P1 一并做）

- CreateUser 的 logrus.Fatal 改 return err + 密码长度上限（DEFECTS-01，S）：一处改动消除进程级 DoS，风险回报比最高。
- check.go 的 version.Must 全部改 version.NewVersion 并跳过脏数据（MISSING-LOGIC-02/BEST-PRACTICE-08，S）：消除无鉴权 /checkVersion 主链路的脏数据 panic。
- CheckPrivate 增加 owner 参数与过滤（SECURITY-08/MISSING-LOGIC-04，S）：小改动恢复'所有查询 owner-scoped'不变量，堵住多租户公私桶误判。
- StartServer 加 SetTrustedProxies（SECURITY-06，S）：一行配置消除 X-Forwarded-For 伪造绕过登录限流。
- List* 出错返回非 2xx（DEFECTS-05，S）：让前端与监控能感知后端故障，提升可观测性。
- 删除 download.go 被丢弃的 WithTimeout 与三处 GetAllApps 死代码（DEFECTS-08/CODE-SMELL-05，S）：清除误导性死代码，随 P0 一并完成。

### 若不处理的风险

- 不修 /download IDOR（SECURITY-01/MISSING-LOGIC-01）：只要 ENABLE_PRIVATE_APP_DOWNLOADING=true，任何拿到 /apps/latest 或 /checkVersion 响应的匿名者即可换取私有桶任意对象 15min 直链，跨租户下载全部私有制品——对更新分发服务等同私有制品全量泄露，且经 Caddy 公网短链暴露后可被直接利用。
- 不修 signup DoS（DEFECTS-01）：持有 API_KEY 的调用方一个畸形密码即可让进程 os.Exit(1)，整服务不可用需外部重启，客户端更新与下载全线中断。
- 不修 version.Must panic（MISSING-LOGIC-02）：一条历史遗留或直写的非 semver 版本文档就能让对应 app 的无鉴权查版本长期返回 500，该平台客户端持续收不到更新且难以定位。
- 不补 CI 质量门（BEST-PRACTICE-01）：丢 err、可疑断言、已知 CVE、context 未传播等问题会持续以人工 review 为唯一防线一路合入主分支，本轮修复的成果也可能被后续提交悄悄回归。
- 不处理两阶段非事务（DEFECTS-04/MISSING-LOGIC-03）：S3 孤儿对象随每次失败上传/删除持续累积，长期占用公私桶存储与成本，且部分发布的残缺版本会被客户端查到。
- 不给 TUF 明确去留（OVER-ENGINEERING-01）：约 2 万行死代码永久拖累依赖升级、Go 版本迁移与安全扫描，新贡献者被迫理解一套与真实更新流毫无耦合的密码学子系统；若运维误开 TUF_ENABLED 不开 Redis 还会直接 panic。
- 不修 JWT 吊销（SECURITY-02）：离职员工或泄露的 token 在 24h 内无法强制下线，改密后旧凭据仍可访问 authMiddleware-only 端点。

## 七、下一步

- 本报告为 proposal 阶段产物；建议按 P0 → P1 → P2 → P3 拆分为 `docs/task/` 下的独立任务（P0 两条已可直接对应 `SEC-*` / `DEFECTS-*` 任务）。
- P0 两项（`/download` IDOR、signup 进程级 DoS）建议优先立项修复并补回归测试。
- 落地任何一项前，按仓库规范先 investigate → proposal → implement，并跑 `go test ./...` 与新增用例。
