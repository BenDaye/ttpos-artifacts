/**
 * 从 .github/workflows/build-*.yaml 的 matrix 生成「自助构建能力」清单(单一真相源)。
 *
 * 触发功能围绕 workflow:能构建哪些端、各端叫什么 FaynoSync 名、各支持哪些平台,
 * 全部由 build-<platform>.yaml 的 strategy.matrix(package 列表 + include 的
 * faynosync_name)推导,而不是在前后端各写一份。
 *
 * 输出 apps/server/server/handler/build/capabilities.json,由 server 用 go:embed
 * 打进镜像;前端从 /build/capabilities 拉取渲染。
 *
 * 用法:  bun run scripts/gen-build-capabilities.ts
 * CI 应跑此脚本 + `git diff --exit-code <输出文件>`,防止改了 workflow 却忘了重生成。
 *
 * 注:web(menu/mobile/member)Phase 1 不纳入自助(build-web 无 FaynoSync 上传)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dir, '..')
const PLATFORMS = ['android', 'ios', 'windows', 'macos'] as const
const OUT = path.join(ROOT, 'apps/server/server/handler/build/capabilities.json')

interface PkgAgg { appName: string, platforms: Set<string> }
const byPkg = new Map<string, PkgAgg>()

for (const plat of PLATFORMS) {
  const file = path.join(ROOT, `.github/workflows/build-${plat}.yaml`)
  const doc = Bun.YAML.parse(readFileSync(file, 'utf8')) as any
  const jobs = doc?.jobs ?? {}

  let matrix: any = null
  for (const job of Object.values(jobs)) {
    const m = (job as any)?.strategy?.matrix
    if (m?.package) {
      matrix = m
      break
    }
  }
  if (!matrix)
    throw new Error(`build-${plat}.yaml: 找不到 strategy.matrix.package`)

  const nameOf = new Map<string, string>()
  for (const inc of (matrix.include ?? []) as any[]) {
    if (inc?.package && inc?.faynosync_name)
      nameOf.set(inc.package, inc.faynosync_name)
  }

  for (const pkg of matrix.package as string[]) {
    const appName = nameOf.get(pkg)
    if (!appName)
      throw new Error(`build-${plat}.yaml: package ${pkg} 缺 faynosync_name`)
    const cur = byPkg.get(pkg)
    if (!cur) {
      byPkg.set(pkg, { appName, platforms: new Set([plat]) })
    }
    else {
      if (cur.appName !== appName)
        throw new Error(`package ${pkg} 的 faynosync_name 跨平台冲突: ${cur.appName} vs ${appName}`)
      cur.platforms.add(plat)
    }
  }
}

const packages = [...byPkg.entries()]
  .map(([pkg, v]) => ({
    package: pkg,
    app_name: v.appName,
    platforms: PLATFORMS.filter(p => v.platforms.has(p)),
  }))
  .sort((a, b) => a.package.localeCompare(b.package))

const output = { platforms: [...PLATFORMS], packages }
writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`)
console.info(`generated ${path.relative(ROOT, OUT)}: ${packages.length} packages, ${PLATFORMS.length} platforms`)
process.exit(0)
