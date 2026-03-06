# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CI/CD build workflows for the TTPOS Flutter POS system. This repo contains **only GitHub Actions workflows** — no application source code. The actual Flutter code lives in the private repo `innet8/ttpos-flutter`, which workflows check out at build time via `PRIVATE_REPO_PAT`.

## Repository Structure

```
.github/workflows/
  build-android.yaml   # APK builds (ubuntu-latest)
  build-windows.yaml   # Inno Setup installer (windows-latest)
  build-macos.yaml     # DMG with code signing + notarization (macos-latest)
  build-web.yaml       # Docker images (ubuntu-22.04)
```

No build/test/lint commands exist locally — all execution happens in GitHub Actions runners.

## Architecture

### Shared Build Pipeline Pattern

All four workflows follow the same structure:
1. **Matrix strategy** to build multiple app packages in parallel (`fail-fast: false`)
2. Checkout `innet8/ttpos-flutter` at a user-specified branch
3. Flutter 3.27.3 + Melos bootstrap (`melos bs`) + env setup
4. Generate `.env.{production|test|development}.local` files with API/WS URLs
5. Inject Sentry DSN (release branch only)
6. Build via Dart scripts (`scripts/build_android.dart`, `scripts/build_win_innosetup.dart`, `scripts/build_mac.dart`, `scripts/build_web.dart`)
7. Upload artifacts → GitHub Artifacts + Google Cloud Storage
8. Optional SCP relay to download servers

### App Packages Built

| Workflow | Packages | Output |
|----------|----------|--------|
| Android | pos, kds, shop, assistant, tablet, qds | APK |
| Windows | pos, kds, assistant, tablet, shop | Inno Setup EXE |
| macOS | pos, assistant, kds, tablet, shop | Signed/notarized DMG |
| Web | menu, mobile, member | Docker images |

### Environment System

Workflows accept `env` input (`prod`/`test`/`dev`) mapped to file suffixes:
- `dev` → `.env.development.local`
- `test` → `.env.test.local`
- `prod` → `.env.production.local`

### Distribution Paths

Artifacts route to two destinations based on branch:
- **release branch** → `Prod/` paths (GCS: `dc_apk/TTPOS/Prod/...`, SCP: `/hitosea/ttpos-*/Prod/...`)
- **other branches** → `Test/` paths

### macOS-Specific Complexity

`build-macos.yaml` is the most complex workflow (~880 lines) with:
- Keychain creation + certificate import (`MAC_SIGNING_CERT_BASE64`)
- Per-app provisioning profiles (`MAC_*_PROFILE_BASE64`)
- Deep code signing (dylibs, frameworks, XPC services, Sparkle)
- Apple notarization via `notarytool` + stapling
- YAML anchor (`&mac_steps` / `*mac_steps`) to share steps between `build-single` and `build-all` jobs

## Key Conventions

- All workflow UIs use Chinese (中文) for step names and descriptions
- Chinese pub mirrors used: `PUB_HOSTED_URL=https://pub.flutter-io.cn`
- SCP uses a two-hop relay pattern: runner → relay server (`SCP_S_*`) → target server (`SCP_D_*`)
- Latest symlinks created on target servers (e.g., `TTPOS-Cashier-latest.apk`)
- Artifact retention is 1 day for Android/Windows builds
- Web builds push Docker images to `hub.hitosea.com` registry with `test-` prefix for non-release branches

## Editing Workflows

When modifying these workflows:
- Maintain `fail-fast: false` on all matrix strategies
- Keep the `should_run` check pattern that allows building "all" or a single package
- Preserve the env suffix mapping logic (`dev→development`, `test→test`, `prod→production`)
- macOS: never break the YAML anchor relationship between `build-single` and `build-all`
- Test URL options and SCP paths must stay in sync across related fields
