/**
 * per-app 版本号发布脚本（PLAN-036 顶层 monorepo 化后）。
 *
 * 用法：
 *   bun run version:patch -- --app web      # apps/web 0.2.2 -> 0.2.3
 *   bun run version:minor -- --app web      # apps/web 0.2.2 -> 0.3.0
 *   bun run version:major -- --app mcp      # apps/mcp 0.1.0 -> 1.0.0
 *   bun run scripts/bump-version.ts 2.3.4 --app web   # 显式指定版本号
 *
 * 行为：
 *   1. 以 apps/<app>/package.json 的 version 为单一事实来源计算新版本号（根 package.json 不参与版本，恒为 0.0.0）；
 *   2. 写回 apps/<app>/package.json；
 *   3. 把 apps/<app>/CHANGELOG.md 的 [Unreleased] 段归档为 [新版本] - 日期（无 CHANGELOG 时跳过）；
 *   4. 打印建议的 git commit / tag 命令（不自动提交、不自动打标签）。
 *
 * server 不纳入本脚本：Go 无 npm 版本语义，发版直接手动打 server-v* tag。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')

const APPS = {
  web: { dir: 'apps/web', tagPrefix: 'web-v', label: 'dashboard web' },
  mcp: { dir: 'apps/mcp', tagPrefix: 'mcp-v', label: 'mcp server' },
} as const

type AppName = keyof typeof APPS
type ReleaseType = 'patch' | 'minor' | 'major'

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
}

function writeJson(filePath: string, value: Record<string, unknown>): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function nextVersion(current: string, release: string): string {
  // 显式 x.y.z 优先，不依赖当前版本号是否可解析。
  if (/^\d+\.\d+\.\d+$/.test(release)) {
    return release
  }

  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`无法解析当前版本号：${current}`)
  }
  const [major, minor, patch] = match.slice(1).map(Number)

  switch (release as ReleaseType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`无效的发布类型：${release}（应为 patch|minor|major 或 x.y.z）`)
  }
}

function archiveChangelog(changelogPath: string, version: string, date: string): boolean {
  let content: string
  try {
    content = readFileSync(changelogPath, 'utf-8')
  }
  catch {
    console.warn(`未找到 ${changelogPath}，跳过 changelog 归档。`)
    return false
  }

  const marker = '## [Unreleased]'
  const markerIdx = content.indexOf(marker)
  if (markerIdx === -1) {
    console.warn('CHANGELOG.md 缺少 "## [Unreleased]" 段，跳过 changelog 归档。')
    return false
  }

  const afterMarker = markerIdx + marker.length
  const nextHeadingIdx = content.indexOf('\n## [', afterMarker)
  const bodyEnd = nextHeadingIdx === -1 ? content.length : nextHeadingIdx
  const body = content.slice(afterMarker, bodyEnd)

  const archived = `${marker}\n\n## [${version}] - ${date}${body}`
  const updated = content.slice(0, markerIdx) + archived + content.slice(bodyEnd)
  writeFileSync(changelogPath, updated)
  return true
}

function parseArgs(argv: string[]): { release: string, app: AppName } {
  const args = [...argv]
  let app: string | undefined
  const appIdx = args.indexOf('--app')
  if (appIdx !== -1) {
    app = args[appIdx + 1]
    args.splice(appIdx, 2)
  }
  const release = args[0]

  if (!release) {
    console.error('请提供发布类型：patch | minor | major | x.y.z')
    process.exit(1)
  }
  if (!app || !(app in APPS)) {
    console.error(`请用 --app 指定应用：${Object.keys(APPS).join(' | ')}（server 发版直接手动打 server-v* tag）`)
    process.exit(1)
  }
  return { release, app: app as AppName }
}

function main(): void {
  const { release, app } = parseArgs(process.argv.slice(2))
  const { dir, tagPrefix, label } = APPS[app]

  const pkgPath = path.join(repoRoot, dir, 'package.json')
  const changelogPath = path.join(repoRoot, dir, 'CHANGELOG.md')

  const pkg = readJson(pkgPath)
  const current = String(pkg.version ?? '')
  const version = nextVersion(current, release)
  const date = new Date().toISOString().slice(0, 10)

  pkg.version = version
  writeJson(pkgPath, pkg)

  const changelogUpdated = archiveChangelog(changelogPath, version, date)

  console.info(`[${label}] 版本号 ${current} -> ${version}`)
  console.info(`已更新：${dir}/package.json${changelogUpdated ? `、${dir}/CHANGELOG.md` : ''}`)
  console.info('')
  console.info('下一步（按需手动执行）：')
  console.info(`  git add ${dir}/package.json${changelogUpdated ? ` ${dir}/CHANGELOG.md` : ''}`)
  console.info(`  git commit -m "chore: 发布 ${app} v${version}"`)
  console.info(`  git tag ${tagPrefix}${version}`)
}

main()
