/**
 * dashboard-next 版本号发布脚本。
 *
 * 用法：
 *   bun run version:patch          # 0.1.0 -> 0.1.1
 *   bun run version:minor          # 0.1.0 -> 0.2.0
 *   bun run version:major          # 0.1.0 -> 1.0.0
 *   bun run scripts/bump-version.ts 2.3.4   # 显式指定版本号
 *
 * 行为：
 *   1. 以 apps/web/package.json 的 version 为单一事实来源计算新版本号；
 *   2. 同步写回根 package.json 与 apps/web/package.json；
 *   3. 把 CHANGELOG.md 的 [Unreleased] 段归档为 [新版本] - 日期，并留下空的 [Unreleased]；
 *   4. 打印建议的 git commit / tag 命令（不自动提交、不自动打标签）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const rootPkgPath = path.join(repoRoot, 'package.json')
const webPkgPath = path.join(repoRoot, 'apps/web/package.json')
const changelogPath = path.join(repoRoot, 'CHANGELOG.md')

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

function archiveChangelog(version: string, date: string): boolean {
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

function main(): void {
  const release = process.argv[2]
  if (!release) {
    console.error('请提供发布类型：patch | minor | major | x.y.z')
    process.exit(1)
  }

  const webPkg = readJson(webPkgPath)
  const current = String(webPkg.version ?? '')
  const version = nextVersion(current, release)
  const date = new Date().toISOString().slice(0, 10)

  webPkg.version = version
  writeJson(webPkgPath, webPkg)

  const rootPkg = readJson(rootPkgPath)
  rootPkg.version = version
  writeJson(rootPkgPath, rootPkg)

  const changelogUpdated = archiveChangelog(version, date)

  console.info(`版本号 ${current} -> ${version}`)
  console.info(`已更新：package.json、apps/web/package.json${changelogUpdated ? '、CHANGELOG.md' : ''}`)
  console.info('')
  console.info('下一步（按需手动执行）：')
  console.info(`  git add package.json apps/web/package.json CHANGELOG.md`)
  console.info(`  git commit -m "chore: 发布 dashboard-next v${version}"`)
  console.info(`  git tag dashboard-next-v${version}`)
}

main()
