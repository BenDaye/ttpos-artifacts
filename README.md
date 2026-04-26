# TTPOS Artifacts

Monorepo containing the **FaynoSync Server** (Go backend, forked), **FaynoSync Dashboard** (React SPA), and **TTPOS build workflows** (GitHub Actions).

---

## TTPOS Build Workflows

Build workflows for TTPOS Flutter applications.

### Workflows

| Workflow               | Platform             | Runner           | Trigger                                   |
| ---------------------- | -------------------- | ---------------- | ----------------------------------------- |
| `build-windows.yaml`   | Windows (Inno Setup) | `windows-latest` | `workflow_dispatch`                       |
| `build-android.yaml`   | Android (APK)        | `ubuntu-latest`  | `workflow_dispatch`                       |
| `build-macos.yaml`     | macOS (DMG)          | `macos-latest`   | `workflow_dispatch`                       |
| `build-web.yaml`       | Web (Docker)         | `ubuntu-22.04`   | `workflow_dispatch`                       |
| `build-dashboard-next.yaml` | Dashboard (Docker)   | `ubuntu-latest`  | `workflow_dispatch`, push to main/release |
| `build-dashboard.yaml`      | Dashboard 旧版 (回滚锚点) | `ubuntu-latest`  | `workflow_dispatch`, push to release      |
| `build-server.yaml`         | Server (Docker)      | `ubuntu-latest`  | `workflow_dispatch`, push to main/release |

### Required Secrets

#### 通用

| Secret                                                            | Description                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `PRIVATE_REPO_PAT`                                                | Fine-grained PAT for `innet8/ttpos-flutter` (contents:read) |
| `GOOGLE_STORAGE_CREDENTIALS`                                      | GCS upload credentials                                      |
| `SCP_S_HOST` / `SCP_S_USER` / `SCP_S_RIVATEKEY`                   | Relay server SSH credentials                                |
| `SCP_D_HOST` / `SCP_D_USER`                                       | Target server credentials                                   |
| `SENTRYDSN_POS` / `KDS` / `ASSISTANT` / `TABLET` / `SHOP` / `QDS` | Sentry DSN per application                                  |
| `FAYNOSYNC_URL` / `FAYNOSYNC_TOKEN`                               | FaynoSync upload credentials                                |

#### macOS 签名与公证

详细获取方法见 **[macOS 签名配置指南](docs/macos-signing.md)**。

| Secret                         | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `MAC_SIGNING_CERT_BASE64`      | Developer ID Application 证书 (.p12, base64) |
| `MAC_SIGNING_CERT_PASSWORD`    | .p12 证书的导出密码                          |
| `MAC_SIGNING_TEAM_ID`          | Apple 开发者团队 ID                          |
| `MAC_POS_PROFILE_BASE64`       | TTPOS Cashier 描述文件 (base64)              |
| `MAC_ASSISTANT_PROFILE_BASE64` | TTPOS Go 描述文件 (base64)                   |
| `MAC_KDS_PROFILE_BASE64`       | TTPOS Kitchen 描述文件 (base64)              |
| `MAC_TABLET_PROFILE_BASE64`    | TTPOS Menu 描述文件 (base64)                 |
| `MAC_SHOP_PROFILE_BASE64`      | TTPOS Shop 描述文件 (base64)                 |
| `APPLE_ID`                     | Apple ID 邮箱（公证用）                      |
| `APPLE_APP_SPECIFIC_PASSWORD`  | App 专用密码（公证用）                       |
| `APPLE_TEAM_ID`                | Apple 开发者团队 ID（公证用）                |

#### Web / Docker

| Secret                                                         | Description                 |
| -------------------------------------------------------------- | --------------------------- |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD`                          | Docker registry credentials |
| `SSH_MOBILE_MENU_TEST_HOST` / `SSH_USER_*` / `SSH_RIVATEKEY_*` | Web test server SSH         |

---

## FaynoSync Dashboard

线上前端为 `dashboard-next/`（React 19 + Vite 8 + TanStack Router + Tailwind v4，Bun workspaces）。
旧版 `dashboard/`（React 18 + Yarn 4）仅作为回滚锚点保留，不再随主线代码自动构建。

### CI/CD 构建

通过 `build-dashboard-next.yaml` 自动构建并推送 Docker 镜像到 **GitHub Container Registry (ghcr.io)**：

- **触发**：手动触发 (`workflow_dispatch`) 或 push 到 `main`/`release` 分支
- **质量门禁**：typecheck → lint → 单元测试 → 生产构建 → Playwright e2e
- **镜像**：`ghcr.io/<owner>/<repo>/faynosync-dashboard-next`
- **标签**：`latest`、短 commit SHA、分支名

旧版 `build-dashboard.yaml` 已标记 deprecated，仅保留 `release` 分支与手动触发，用于必要时的回滚镜像构建。

### Conventional Commits

本仓库要求 **Commit 信息符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范**。PR 合并前会通过 `commitlint.yaml` 自动校验。提交说明、PR 标题与描述均使用中文。

格式示例：`feat: 添加统计页面`、`fix: 修复登录跳转`

---

### Description 📄

This frontend works with the FaynoSync API (included in `server/`), providing seamless service updates.

### Installing Dependencies 📦

```bash
cd dashboard-next
bun install --frozen-lockfile
```

### Running in Development Mode 🛠️

```bash
cd dashboard-next
bun dev
```

Vite 默认监听 `http://localhost:3000`，对应 `apps/web/` 子项目。

### Running in Production Mode 🚀

```bash
cd dashboard-next
bun run build      # 生成 apps/web/dist/
bun run preview    # 本地预览生产产物
```

### Environment Variables ⚙️

`dashboard-next/apps/web/` 支持以下变量（一般通过 `.env.local` 或 Docker 环境注入）：

```
VITE_API_URL=http://localhost:9000   # FaynoSync API 基址
VITE_PORT=3000                        # 开发服务器端口
VITE_DEV_PROXY_TARGET=                # 开发代理目标（可选，置空即不代理）
```

镜像启动时若设置 `VITE_API_URL`，`docker-entrypoint.sh` 会替换构建产物中的占位符 `__VITE_API_URL_PLACEHOLDER__`，无需重新构建即可切换后端。
