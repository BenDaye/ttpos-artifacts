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

| Secret | Description |
|--------|-------------|
| `PRIVATE_REPO_PAT` | Fine-grained PAT for `innet8/ttpos-flutter` (contents:read) |
| `GOOGLE_STORAGE_CREDENTIALS` | GCS upload credentials |
| `SCP_S_HOST` / `SCP_S_USER` / `SCP_S_RIVATEKEY` | Relay server SSH credentials |
| `SCP_D_HOST` / `SCP_D_USER` | Target server credentials |
| `SENTRYDSN_*` | Sentry DSN per application |
| `MAC_SIGNING_CERT_BASE64` / `MAC_SIGNING_CERT_PASSWORD` | macOS signing certificate |
| `MAC_*_PROFILE_BASE64` | macOS provisioning profiles per app |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | Apple notarization |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker registry credentials |
| `SSH_MOBILE_MENU_TEST_HOST` / `SSH_USER_*` / `SSH_RIVATEKEY_*` | Web test server SSH |
