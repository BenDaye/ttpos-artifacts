# TTPOS Build Workflows

Build workflows for TTPOS Flutter applications.

## Workflows

| Workflow | Platform | Runner | Trigger |
|----------|----------|--------|---------|
| `build-windows.yaml` | Windows (Inno Setup) | `windows-latest` | `workflow_dispatch` |
| `build-android.yaml` | Android (APK) | `ubuntu-latest` | `workflow_dispatch` |
| `build-macos.yaml` | macOS (DMG) | `macos-latest` | `workflow_dispatch` |
| `build-web.yaml` | Web (Docker) | `ubuntu-22.04` | `workflow_dispatch` |

## Required Secrets

### 通用

| Secret | Description |
|--------|-------------|
| `PRIVATE_REPO_PAT` | Fine-grained PAT for `innet8/ttpos-flutter` (contents:read) |
| `GOOGLE_STORAGE_CREDENTIALS` | GCS upload credentials |
| `SCP_S_HOST` / `SCP_S_USER` / `SCP_S_RIVATEKEY` | Relay server SSH credentials |
| `SCP_D_HOST` / `SCP_D_USER` | Target server credentials |
| `SENTRYDSN_POS` / `KDS` / `ASSISTANT` / `TABLET` / `SHOP` / `QDS` | Sentry DSN per application |
| `FAYNOSYNC_URL` / `FAYNOSYNC_TOKEN` | FaynoSync upload credentials |

### macOS 签名与公证

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

### Web / Docker

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker registry credentials |
| `SSH_MOBILE_MENU_TEST_HOST` / `SSH_USER_*` / `SSH_RIVATEKEY_*` | Web test server SSH |
