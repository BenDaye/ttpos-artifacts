# PLAN-031 FaynoSync CI 重传覆盖语义修复

- **status**: completed
- **createdAt**: 2026-06-24 08:16
- **approvedAt**: 2026-06-24 08:57
- **completedAt**: 2026-06-24 10:00
- **relatedTask**: BUG-015

## 现状

调查链路：

1. Android、Windows、macOS、iOS workflow 都把 `FS_ENDPOINT` 默认设为 `/upload`，只有 `inputs.faynosync == force` 且 `/checkVersion` 返回 `update_available=false` 时才切到 `/apps/update`。
2. `/checkVersion` 不是版本存在性接口。服务端 `CheckLatestVersion` 查询 `published=true` 的最新版本并比较 semver：请求版本等于最新时返回 `update_available=false`，请求版本低于最新时返回 `true`，请求版本高于最新时也不是“存在”。因此它不能判断某个版本记录是否已经存在。
3. `/checkVersion` 的查询还限定 `published=true`，而 workflow 的 `FAYNOSYNC_PUBLISH` 只有 `branch == new-test && env == test` 时为 true；未发布的已有版本不会被这个预检查可靠发现。
4. `/upload` handler 的顺序是先算 hash，再 `UploadToS3`，然后才 `repository.Upload` 写 Mongo。重复 artifact 检查在 `mongod/create.go` 中发生，命中后返回 `app with this name, version, platform, architecture and extension already exists`。所以对象存储已覆盖、HTTP 返回 500 是当前代码的自然结果。
5. `/apps/update` 要求 `data.id`，API 文档与 handler 都依赖版本 ObjectID；当前 workflow 的 force 分支切到 `/apps/update` 时没有传 id。
6. CI 使用 `FAYNOSYNC_TOKEN` 作为 FaynoSync 凭证。`CheckPermission` 会限制 API token 的实际权限，所以 `/apps/update` 不是 CI force 覆盖的正确目标接口；若要执行 `force` 覆盖，`FAYNOSYNC_TOKEN` 对应身份必须具备 `apps.edit`，否则 `/upload/check` 会在构建前 403。

关键文件：

- `.github/workflows/build-android.yaml`
- `.github/workflows/build-windows.yaml`
- `.github/workflows/build-macos.yaml`
- `.github/workflows/build-ios.yaml`
- `server/server/handler/create/upload.go`
- `server/mongod/create.go`
- `server/server/handler/update/update.go`
- `server/mongod/check.go`

## 方案

1. 服务端先修语义：给 `/upload` 增加显式 overwrite 参数（例如 `data.overwrite=true`，命名实现前再统一），并在对象写入前完成同 app/version/channel/platform/arch/extension 的重复 artifact 判定。
2. 普通 `/upload`：命中重复 artifact 且未请求 overwrite 时，直接返回 `409 Conflict`，不调用 `UploadToS3`，避免对象存储被先覆盖。
3. 强制 `/upload`：命中重复 artifact 且 `overwrite=true` 时，除 upload 权限外额外要求 `apps.edit`，上传对象后替换该 artifact 的 link/hash/length/signature，并同步 changelog/published/critical/intermediate 等本次上传元数据。
4. Workflow 不再把 `force` 切到 `/apps/update`。四个平台都继续调用 `/upload` 并使用 `FAYNOSYNC_TOKEN`；仅在 `faynosync=force` 时把 overwrite 参数写入 `data`，权限由服务端 `apps.edit` 校验。
5. `faynosync=on` 不再使用 `/checkVersion` 做存在性判断。新增无副作用 `/upload/check` 做 exact tuple preflight：构建前返回 409/403，避免昂贵构建后才失败；服务端 `/upload` 的 409 仍是最终正确性边界。
6. 为避免并发普通上传同时通过只读检查后都写对象存储，服务端在写存储前用内部 `upload_claims` 集合按 owner/app/version/channel/platform/arch/package 获取 tuple claim；claim duplicate 映射为 409。
7. 已有版本的 artifact commit 不再全量 `$set` artifacts 数组；新增 artifact 使用带 tuple 排除条件的 `$push`，覆盖 artifact 使用 array filter 只替换匹配项，避免不同 tuple 并发追加互相覆盖。
8. claim 释放不绑定请求 context，避免客户端取消导致 claim 删除被一起取消；释放失败仍会记录日志，过期 claim 在同 key 下次尝试时被清理。
9. 补测试：
   - API token 权限测试：`fns_` token 可以走普通 `/upload`，但不能走 `/upload overwrite=true` 或 `/apps/update`。
   - 普通重复上传返回 409，且不会触发对象存储上传路径。
   - force 重复上传返回 200，并更新 artifact 元数据。
   - workflow YAML/脚本语法检查覆盖四个平台。

## 风险

- workflow 中四个平台有相似但不完全相同的上传变量，复制修改容易漏平台或漏扩展名。
- `/upload overwrite=true` 会改变既有 API 语义，必须只在显式参数下启用，且必须绑定 `apps.edit`，默认重复上传仍应是冲突。
- `/search` 当前在 auth 后但未挂 `CheckPermission`，API token 可通过 owner 读取版本列表；若用于 CI 预检查，应确认是否需要补 API token app scope 约束，避免把已有权限缺口扩大成产品依赖。
- 服务端重复判定和写入需要避免并发竞态；至少要保留数据库唯一约束/冲突处理作为最终防线。

## 工作量

中等偏上。预计修改 workflow 4 个文件、服务端 3-5 个文件，并补充 API token、普通重复、force 覆盖三类聚焦测试。

## 备选方案

1. 只修 workflow：最快止血，但 `/upload` 仍然存在“对象先覆盖、DB 后失败”的非原子缺陷。
2. 让 CI 改用 admin JWT + `/apps/update`：改动少，但扩大 CI 凭证权限，不符合最小权限；如确需 force，应给 CI 使用具备 `apps.edit` 的受限身份而不是复用 upload-only token。
3. 新增专用 `/apps/upsert-artifact` 接口：语义干净，但需要新增权限、文档和调用面；当前可以先把 overwrite 收敛在 `/upload`。

## 批注

- 2026-06-24 08:57：经 `$ralplan` 审核通过后进入 `$ultragoal` 持久执行；并行拆为 server 语义、测试、workflow、验证四条线。
- 2026-06-24 10:00：实现经最终验证收口：`/upload` 增加 overwrite 语义与写存储前 tuple claim，CI 四个平台统一走 `/upload`，普通重复上传返回 409。
- 2026-06-25：生产级复核后调整安全与 CI 设计：`overwrite=true` 额外要求 `apps.edit`；四个平台在构建前调用无副作用 `/upload/check`，但最终冲突仍由 `/upload` 权威判定。
