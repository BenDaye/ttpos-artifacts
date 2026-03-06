# Style & Conventions

## Language
- All workflow UI labels (step names, descriptions, input descriptions) use **Chinese (中文)**
- Code comments and technical identifiers remain in English

## YAML Style
- Workflow files use `.yaml` extension (not `.yml`)
- Indentation: 2 spaces
- Strings: generally unquoted unless special characters present
- Environment variables: SCREAMING_SNAKE_CASE
- Step IDs: kebab-case
- Job IDs: kebab-case (e.g., `build-single`, `build-all`)

## Workflow Patterns
- All matrix strategies use `fail-fast: false`
- `should_run` pattern: allows building "all" or a single package via matrix include/exclude
- Env suffix mapping: `dev→development`, `test→test`, `prod→production`
- macOS workflow uses YAML anchors (`&mac_steps` / `*mac_steps`) to share steps between `build-single` and `build-all` jobs

## Infrastructure Conventions
- Chinese pub mirrors: `PUB_HOSTED_URL=https://pub.flutter-io.cn`
- SCP uses two-hop relay pattern: runner → relay server (`SCP_S_*`) → target server (`SCP_D_*`)
- Latest symlinks on target servers (e.g., `TTPOS-Cashier-latest.apk`)
- Artifact retention: 1 day for Android/Windows builds
- Web builds: Docker images to `hub.hitosea.com`, `test-` prefix for non-release branches

## Editing Rules
- Maintain `fail-fast: false` on all matrix strategies
- Keep the `should_run` check pattern
- Preserve the env suffix mapping logic
- macOS: never break the YAML anchor relationship between `build-single` and `build-all`
- Test URL options and SCP paths must stay in sync across related fields