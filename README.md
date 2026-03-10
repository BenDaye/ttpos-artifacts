# TTPOS Artifacts

This repository contains **TTPOS build workflows** (GitHub Actions) and the **FaynoSync Dashboard** frontend.

---

## TTPOS Build Workflows

Build workflows for TTPOS Flutter applications.

### Workflows

| Workflow | Platform | Runner | Trigger |
|----------|----------|--------|---------|
| `build-windows.yaml` | Windows (Inno Setup) | `windows-latest` | `workflow_dispatch` |
| `build-android.yaml` | Android (APK) | `ubuntu-latest` | `workflow_dispatch` |
| `build-macos.yaml` | macOS (DMG) | `macos-latest` | `workflow_dispatch` |
| `build-web.yaml` | Web (Docker) | `ubuntu-22.04` | `workflow_dispatch` |
| `build-dashboard.yaml` | Dashboard (Docker) | `ubuntu-latest` | `workflow_dispatch`, push to main/release |

### Required Secrets

#### 通用

| Secret | Description |
|--------|-------------|
| `PRIVATE_REPO_PAT` | Fine-grained PAT for `innet8/ttpos-flutter` (contents:read) |
| `GOOGLE_STORAGE_CREDENTIALS` | GCS upload credentials |
| `SCP_S_HOST` / `SCP_S_USER` / `SCP_S_RIVATEKEY` | Relay server SSH credentials |
| `SCP_D_HOST` / `SCP_D_USER` | Target server credentials |
| `SENTRYDSN_POS` / `KDS` / `ASSISTANT` / `TABLET` / `SHOP` / `QDS` | Sentry DSN per application |
| `FAYNOSYNC_URL` / `FAYNOSYNC_TOKEN` | FaynoSync upload credentials |

#### macOS 签名与公证

详细获取方法见 **[macOS 签名配置指南](docs/macos-signing.md)**。

| Secret | Description |
|--------|-------------|
| `MAC_SIGNING_CERT_BASE64` | Developer ID Application 证书 (.p12, base64) |
| `MAC_SIGNING_CERT_PASSWORD` | .p12 证书的导出密码 |
| `MAC_SIGNING_TEAM_ID` | Apple 开发者团队 ID |
| `MAC_POS_PROFILE_BASE64` | TTPOS Cashier 描述文件 (base64) |
| `MAC_ASSISTANT_PROFILE_BASE64` | TTPOS Go 描述文件 (base64) |
| `MAC_KDS_PROFILE_BASE64` | TTPOS Kitchen 描述文件 (base64) |
| `MAC_TABLET_PROFILE_BASE64` | TTPOS Menu 描述文件 (base64) |
| `MAC_SHOP_PROFILE_BASE64` | TTPOS Shop 描述文件 (base64) |
| `APPLE_ID` | Apple ID 邮箱（公证用） |
| `APPLE_APP_SPECIFIC_PASSWORD` | App 专用密码（公证用） |
| `APPLE_TEAM_ID` | Apple 开发者团队 ID（公证用） |

#### Web / Docker

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker registry credentials |
| `SSH_MOBILE_MENU_TEST_HOST` / `SSH_USER_*` / `SSH_RIVATEKEY_*` | Web test server SSH |

---

## FaynoSync Dashboard

### CI/CD 构建

Dashboard 通过 `build-dashboard.yaml` 自动构建并推送 Docker 镜像到 **GitHub Container Registry (ghcr.io)**：

- **触发**：手动触发 (`workflow_dispatch`) 或 push 到 `main`/`release` 分支
- **镜像**：`ghcr.io/<owner>/<repo>/faynosync-dashboard`
- **标签**：`latest`、短 commit SHA、分支名

### Conventional Commits

本仓库要求 **Commit 信息符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范**。PR 合并前会通过 `commitlint.yaml` 自动校验。

格式示例：`feat(dashboard): 添加统计页面`、`fix: 修复登录跳转`

本地校验：`yarn commitlint`（需配合 `git commit` 使用）

---

![demo](https://github.com/user-attachments/assets/21b0bd02-484c-49fc-ad48-b1201f6e5d75)

### 🧠 Built with CursorAI

The entire UI was created with the help of [CursorAI](https://www.cursor.sh/) — an AI assistant in VSCode that made this possible, since I'm a **DevOps engineer**, not a frontend developer 😅

I did my best, but if you see anything that can be improved — **any suggestions, feedback, or corrections are more than welcome!** 🙌

### Description 📄

This frontend is designed to work with the [FaynoSync API](https://github.com/ku9nov/faynoSync), providing seamless service updates.

### Installing Dependencies 📦

```bash
yarn install
```

### Running in Development Mode 🛠️

```bash
yarn dev
```

This will launch a local server, usually on port 3000. Open it in your browser at `http://localhost:3000`.

### Running in Production Mode 🚀

```bash
yarn build
```

### Environment File Setup ⚙️

Create a `.env` file in the root directory and add:

```
VITE_API_URL=http://localhost:9000
VITE_PORT=3000
```

Or copy the example:

```bash
cp .env.example .env
```

Then add or modify the necessary environment variables if needed.
