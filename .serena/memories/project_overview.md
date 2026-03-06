# TTPOS Artifacts - Project Overview

## Purpose
CI/CD build workflows for the TTPOS Flutter POS system. This repo contains **only GitHub Actions workflows** — no application source code. The actual Flutter code lives in the private repo `innet8/ttpos-flutter`, which workflows check out at build time via `PRIVATE_REPO_PAT`.

## Tech Stack
- **GitHub Actions** (YAML workflow definitions)
- **Flutter 3.27.3** + **Melos** (bootstrapped at build time)
- **Dart** build scripts (in the Flutter repo)
- **Google Cloud Storage** for artifact hosting
- **Docker** for web builds (pushed to `hub.hitosea.com` registry)
- **Inno Setup** for Windows installers
- **Apple codesigning + notarization** for macOS DMGs
- **SCP relay** for artifact distribution

## Repository Structure
```
.github/workflows/
  build-android.yaml   # APK builds (ubuntu-latest)
  build-windows.yaml   # Inno Setup installer (windows-latest)
  build-macos.yaml     # DMG with code signing + notarization (macos-latest)
  build-web.yaml       # Docker images (ubuntu-22.04)
CLAUDE.md              # AI assistant guidance
README.md              # Project documentation
```

## App Packages Built
| Workflow | Packages | Output |
|----------|----------|--------|
| Android  | pos, kds, shop, assistant, tablet, qds | APK |
| Windows  | pos, kds, assistant, tablet, shop | Inno Setup EXE |
| macOS    | pos, assistant, kds, tablet, shop | Signed/notarized DMG |
| Web      | menu, mobile, member | Docker images |

## Shared Build Pipeline Pattern
1. Matrix strategy with `fail-fast: false`
2. Checkout `innet8/ttpos-flutter` at user-specified branch
3. Flutter + Melos bootstrap + env setup
4. Generate `.env.{production|test|development}.local` files
5. Inject Sentry DSN (release branch only)
6. Build via Dart scripts
7. Upload artifacts → GitHub Artifacts + GCS
8. Optional SCP relay to download servers

## Environment System
- `dev` → `.env.development.local`
- `test` → `.env.test.local`
- `prod` → `.env.production.local`

## Distribution Paths
- **release branch** → `Prod/` paths
- **other branches** → `Test/` paths