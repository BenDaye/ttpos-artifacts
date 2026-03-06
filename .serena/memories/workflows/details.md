# Workflow Files Details

## build-android.yaml
- Runner: `ubuntu-latest`
- Packages: pos, kds, shop, assistant, tablet, qds
- Output: APK files
- Artifact retention: 1 day
- Upload: GitHub Artifacts + GCS (`dc_apk/TTPOS/Prod|Test/`)
- SCP relay to download servers

## build-windows.yaml
- Runner: `windows-latest`
- Packages: pos, kds, assistant, tablet, shop
- Output: Inno Setup EXE installers
- Artifact retention: 1 day
- Upload: GitHub Artifacts + GCS
- SCP relay to download servers

## build-macos.yaml (~880 lines, most complex)
- Runner: `macos-latest`
- Packages: pos, assistant, kds, tablet, shop
- Output: Signed/notarized DMG files
- Special features:
  - Keychain creation + certificate import (`MAC_SIGNING_CERT_BASE64`)
  - Per-app provisioning profiles (`MAC_*_PROFILE_BASE64`)
  - Deep code signing (dylibs, frameworks, XPC services, Sparkle)
  - Apple notarization via `notarytool` + stapling
  - YAML anchors (`&mac_steps` / `*mac_steps`) to DRY between `build-single` and `build-all` jobs

## build-web.yaml
- Runner: `ubuntu-22.04`
- Packages: menu, mobile, member
- Output: Docker images
- Registry: `hub.hitosea.com`
- Image tag prefix: `test-` for non-release branches
- SCP for web test server deployment

## Common Secrets Required
- `PRIVATE_REPO_PAT` - access to `innet8/ttpos-flutter`
- `GOOGLE_STORAGE_CREDENTIALS` - GCS uploads
- `SCP_S_*` / `SCP_D_*` - relay/target SSH
- `SENTRYDSN_*` - per-app Sentry DSN
- macOS-specific: signing cert, provisioning profiles, Apple ID credentials
- Web-specific: Docker registry credentials, SSH keys for test servers