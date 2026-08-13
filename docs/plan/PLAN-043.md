# PLAN-043 短链数据化：从反代配置表改为 app 的派生属性

- **status**: implemented（代码完成、本机质量门全绿；两步上线待授权执行，见「上线顺序」）
- **task**: ENH-020
- **createdAt**: 2026-08-12
- **关联**: REFACTOR-007 / PLAN-033（把 /dl 迁到 Caddy，本计划就 /dl 部分反向）、BUG-017 / PLAN-039（`resolve=artifact-latest`，语义保留不动）、ENH-019（`--check` 漂移门，本计划会让它的主要守护对象消失）、PLAN-037（Caddy 边界）

## 决策前提（本次会话确认，写在最前，因为它改变了取舍标准）

1. **项目定性为 TTPOS 专用发版应用，放弃平台化。** 通用平台方向不再作为设计约束；「换个客户部署会怎样」不再是判断依据。
2. **TTPOS 未来还会继续加 app**，因此短链必须能自助新增。
3. 用户原话动机：「我本身也很懒的去运维，久而久之也会忘了怎么去运维」。

第 3 条是本计划最重要的输入。它把目标从「减少运维步骤」抬高到「**不能存在需要记住的步骤**」——这两者会导出不同的设计，见下。

## 触发问题

`/dl` 的 15 条短链映射写在 `deploy/Caddyfile` 里，同一份表在 `caddy_config_test.go` 和 `apps/server/API.md` 各存一份副本。新增一个 app 的短链要：改 3 个文件 → 提 PR → 发版 → 登 2 台主机 splice + validate + reload。

这不是代码耦合，是**部署耦合**：该能力永远无法自助。2026-08-12 实探还发现，BUG-017 的生产 rollout 实际是**手工改 rewrite 行**完成的（生产文件缺仓库那两行注释），脚本存在但在最关键的一次变更上被绕过——流程越重越容易被绕过。

## 设计判断：不做「短链管理」功能，把短链变成 app 的一个字段

两种数据化形态：

| | 独立的短链配置表 | **派生式（本计划采用）** |
|---|---|---|
| 后台形态 | 新增「短链」页面，手动增删条目 | app 表单里一个「短链名」字段 |
| 新增 app 后 | 还要再去短链页面加 3 条 | **自动就有，无需任何动作** |
| 要记住的概念 | 「短链」是个独立功能，与 app 的关系要理解 | 没有独立概念，只是 app 的一个属性 |
| 重名 / 校验 | 要单独设计 | 复用 app 标识符同款唯一性校验 |
| 灵活度 | 可任意组合 app × 平台 × 渠道 | 固定派生，不可任意组合 |

选派生式的理由直接来自决策前提第 3 条：**「半年后回来还记得怎么用」的最优解是「没有东西需要记」**。独立管理页只能把步骤变少，消不掉「这是个要重新理解的功能」这件事。

放弃的灵活度（任意组合）当前没有需求支撑，且专用化之后也不太可能出现。

## 目标

- 新增 app 时填一个短链名（或留空用 app 标识符），**短链立即可用，无需发版、无需登主机**。
- app 详情页能直接看到并复制这几条短链。
- **现有 15 条 URL 字节不变**，已印出的二维码与物料全部继续有效。

## 非目标

- 不做 iOS 短链（用户确认无需求）。
- 不做渠道维度，**短链继续只服务 prod**（用户确认）。渠道保持服务端常量，不进 URL。
- 不做自定义域名、不做多客户隔离——已放弃平台化。
- 不碰 TUF。
- 不改 `resolve=artifact-latest` 的回退语义与 `/apps/latest` 的任何行为。

## 设计

### 1. 数据

`model.AppMeta` 新增 `ShortLink string \`bson:"short_link" json:"ShortLink"\``。

- 唯一性：与 app 标识符同款校验（同 owner 下唯一）。
- 允许字符：小写字母、数字、连字符；**禁止 `.`**（`.` 是短链里分隔扩展名的分隔符，允许会产生解析歧义）。
- 留空 → 回退用 app 标识符（`AppName`）作为短链名。

### 2. 服务端路由

`GET /dl/:target` 注册在 auth middleware **之前**（公开），与迁走之前同一位置。

解析：
- 按**最后一个** `.` 切分为 `<短链名>.<扩展名>`，两段都转小写（保持现有大小写不敏感行为）。
- 短链名 → 查 app（先匹配 `short_link`，未命中再匹配 `app_name`）。
- 扩展名 → 平台 + 默认架构 + 包类型，服务端常量：

  | 扩展名 | 平台 | 架构 | 包 |
  |---|---|---|---|
  | apk | android | arm64 | apk |
  | exe | windows | amd64 | exe |
  | dmg | macos | arm64 | dmg |

  这张表是**平台常识**（apk 就是安卓包），不是客户数据，留在代码里是合适的；架构是默认值，见「已知限制」。

- 解析成功后，直接复用现有 `resolve=artifact-latest` 查询路径，**查询逻辑一行不改**。

响应码保持与今天逐字一致：

```
未知短链名 / 不支持的扩展名   400  + no-store
短链名有效但查不到制品        404  + no-store
命中                          302  + CDN public max-age=300 / 浏览器 no-cache
```

### 3. 缓存头 —— 撤回一条先前建议

迁回 API 后，成功 302 的缓存头必须由 API 打。`server/handler/info/latest.go` 里的 `CacheRedirectHeadersContextKey` 正是当年 Go 拥有 `/dl` 时留下的机制，本计划会**让它重新变成活代码**。

因此本次会话早前提出的「`CacheRedirectHeadersContextKey` 是死代码，建议删除」**作废**，不要删。

### 4. Caddy

删除 `update.*` 站点块里的 `map {path}`、`@known_short_latest`、整个 `handle /dl/*`。`/dl` 之后走通用 API fallback。

连带影响：`caddy_config_test.go` 的 `/dl` 断言全部删除，改为断言 Caddyfile 中**不再存在** `/dl` map（防回潮）。ENH-019 的 `--check` 漂移门保留，但它此后守的是路由顺序、upstream 与其余缓存头，不再守短链表。

### 5. Dashboard

- `app-form-dialog.tsx`：新增「短链名」字段（创建 + 编辑），带唯一性与字符校验、留空提示。
- `app-detail-page.tsx`：展示该 app 的短链（安卓 / Windows / Mac 三条），支持一键复制。这是「不用记」的关键——短链在它所属的 app 页面上自我呈现。
- i18n 文案按现有模式补齐，保持 brand-neutral 不再是硬约束，但也没有理由写死业务词。

## 上线顺序（两步，零停机，无需数据迁移脚本）

```
1. 部署新 API          此时 Caddy 仍拦着 /dl，新路由收不到流量
2. 后台填 5 个短链名    cashier / assistant / menu / kitchen / shop
3. 直连 API 验证        绕过 Caddy 打 9000，逐条比对 15 条 Location
4. 改 Caddy 删 map      备份 → validate → reload
5. 公网验证             15 条逐条比对
```

回滚 = Caddy 恢复备份（第 4 步之前任何时刻回滚都无影响，因为新路由此前收不到流量）。

现有 5 个 app 的短链名映射：

```
ttpos          → cashier
ttpos_go       → assistant
ttpos_menu     → menu
ttpos_kitchen  → kitchen
ttpos_shop     → shop
```

## 验收标准

1. **切换前后，15 条 URL 的 `Location` 必须逐条完全相同。** 2026-08-12 已取到切换前基线，全部指向 2.27.3，形如
   `https://storage.googleapis.com/ttpos-artifacts-public/<AppName>-ttpos/prod/<平台>/<架构>/<AppName>-2.27.3.<扩展名>`。
   切换时如版本已变，改为同时对比新旧两条路径的输出。
2. 大小写变体（`/dl/CASHIER.APK`）仍 302 到同一地址。
3. 未知短链名 / 不支持扩展名 → 400 + `no-store`；有效短链名但无制品 → 404 + `no-store`。
4. 成功 302 带 `Cloudflare-CDN-Cache-Control: public, max-age=300` 与 `Cache-Control: no-cache`（origin 侧断言；经 Cloudflare 会被 zone 设置改写成 `max-age=1800`，见「已知限制」）。
5. 后台新建一个 app 并填短链名后，**不发版、不登主机**，短链立即可用。
6. `/apps/latest` 行为逐字不变（回归断言）。
7. Go 单测覆盖：短链名解析、最后一个点切分、大小写、扩展名映射、短链名回退到 app 标识符、唯一性校验、未知短链名 400、无制品 404。

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| 未知短链名现在要回源（Caddy 不再直接 400） | 影响很小：失败态 `no-store`，Cloudflare `BYPASS` 不缓存；量级远低于正常下载流量 |
| 短链名与 app 标识符冲突 | 查找顺序固定（先 `short_link` 后 `app_name`）+ 唯一性校验；单测锁死 |
| 短链名含 `.` 导致解析歧义 | 字符白名单禁止 `.` |
| 切换窗口内短链不可用 | 两步上线，第 4 步之前新路由不接流量；回滚只需恢复 Caddy 备份 |
| 现有二维码失效 | 验收标准第 1 条逐条比对 Location |

## 已知限制（明确记录，不在本次解决）

- **架构是代码里的默认常量**（apk→arm64、exe→amd64、dmg→arm64），不随数据变化。TTPOS 当前每个平台+包类型只有一个架构，行为等价。若将来要同时发 x86 与 arm 安卓包，需要另行设计。
- **Cloudflare 把浏览器 `Cache-Control` 覆盖成 `max-age=1800`**（2026-08-12 实测）。用户已确认这是全域名统一设置、暂不处理。因此本计划的缓存头断言只在 origin 侧成立。
- **回退发旧包仍然没有告警**。与本计划正交，另行决定。

## 工作量

中等。服务端一个新路由 + 一个字段 + 校验（查询逻辑零改动）；前端一个表单字段 + 一处展示；Caddy 删一块 + 契约测试改写；两步上线。

## 实现记录（2026-08-12）

落点与设计时一致，两处实现期修订：

1. **`/dl` 逻辑抽成 `serveShortLatestDownload` + 窄接口 `shortLinkRepository`**（`server/handler/shortlink.go`），沿用 `info.latestTargetRepository` 的既有写法。原因：`ShortLatestDownload` 直接挂在 `appHandler` 上时，测它要造整个 `AppRepository`；抽出接缝后用一个两方法的桩就能覆盖全部分支，新代码不至于裸奔上线。
2. **短链名解析先查 `short_link`、再回退走 `resolveLatestAppMeta`**。回退是白捡的：该函数本就支持「精确 app_name → 归一化标识符」两级匹配（ENH-002），所以没配短链名的 app 也自动有一条可用短链，不需要额外代码。

3. **自审补救：`UpdateApp` 的 shortLink 参数改为 `*string`。** 初版无条件写入 `short_link`，意味着任何**没带该字段**的局部更新都会静默清空短链——而短链是已印在二维码上的公开 URL。查证当前只有 dashboard 表单一个调用方（CI workflow 不调 `/app/create`/`/app/update`），所以初版不会立刻出事，但这是个会咬人的雷。改为 `nil`=没提供、保持原值；非 nil（含空串）=显式设置，空串即清空。语义由纯函数 `shortLinkUpdate` 承载并单测锁死（缺 key → nil / 空串 → 指向空串 / `"  Cashier "` → `"cashier"`）。

其余落点：`model.App.ShortLink`；`CreateApp`/`UpdateApp` 仓储签名与 handler 校验（`utils.NormalizeShortLink` + `IsValidShortLink` + `ShortLinkTakenBy` 唯一性）；迁移 `20260812000000_add_unique_short_link_index`（`apps_meta` 上 `owner+short_link` 的 partial unique index，过滤条件为非空字符串，故留空的 app 不互相冲突）；`deploy/Caddyfile` 删除整个 `/dl` 块；契约测试改为 `TestCaddyRouteContract` + `TestCaddyHasNoShortLinkTable`（防回潮）；dashboard 表单字段 + 详情页短链卡片 + 中英文案。

**顺带修的**：`server/tuf/bootstrap/generate_test.go` 的 mock 因仓储接口变更编译不过，只补了签名与两个空实现，未触碰 TUF 逻辑。`server/model/model_test.go` 的 `App` JSON key 契约追加 `ShortLink`（dashboard 要据它渲染短链，必须进 wire）。三个前端视图测试的 `AppSummary` fixture 补 `ShortLink`。

### 本机质量门（每门单独跑、看真实退出码）

| 门 | 结果 |
|---|---|
| `go build ./...` | EXIT=0 |
| `go vet ./...` | EXIT=0 |
| `go test ./server/ownership/... ./server/utils/...`（CI 口径） | EXIT=0 |
| `go test ./server/... ./mongod/...` | EXIT=0，21 个包全过 |
| `turbo typecheck --filter @ttpos/web --filter @ttpos/shared` | EXIT=0 |
| `bun run lint` | EXIT=0（6 条既有 warning，非本次引入） |
| `turbo test --filter @ttpos/web` | EXIT=0，13 文件 48 用例 |

新增测试：`server/handler/shortlink_test.go`（解析表驱动 10 例 + 路由 7 例：302 与缓存头覆盖、大小写、未知扩展名 400、未知短链名 400、歧义 400、有效名无制品 404、仓储故障 500）；`server/utils/validate_test.go` 补短链名字符白名单与归一化。

本机无 Go 以外的外部依赖，根包集成套件仍需 Mongo/Redis/S3（QUAL-004 口径），未跑。Caddyfile 未做 `caddy validate`（本机无 caddy 二进制与 docker），留到上线第 4 步在目标主机容器内做。

### 顺带验证了 ENH-019 的漂移门

用新的 `--check` 对 2026-08-12 拉下来的**真实生产 Caddyfile** 跑，`EXIT=2` 并逐行列出被删除的 `/dl` map —— 既证明门能检出真实变更，也正好是本次上线第 4 步的前置状态。
