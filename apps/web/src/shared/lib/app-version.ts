/**
 * Dashboard 自身的版本信息。
 *
 * 三个值在构建时由 vite.config.ts 的 `define` 注入：
 * - `version`：apps/web/package.json 的 version（单一事实来源）。
 * - `commit`：git short hash，本地构建取本机 git，容器构建经 CI build-arg 注入。
 * - `builtAt`：构建发生的时刻（ISO 字符串）。
 *
 * 注入缺失时回退为 `'unknown'`，UI 与格式化逻辑据此优雅降级。
 */
export interface BuildInfo {
  version: string
  commit: string
  builtAt: string
}

const UNKNOWN = 'unknown'

export const buildInfo: BuildInfo = {
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  builtAt: __BUILD_TIME__,
}

/** 把裸版本号规范成带前缀的展示文案，已带 `v` 时不重复添加。 */
export function formatVersionLabel(version: string): string {
  const value = version?.trim()
  if (!value || value === UNKNOWN) {
    return `v${UNKNOWN}`
  }
  return value.startsWith('v') ? value : `v${value}`
}

/**
 * 组合 hover 提示：版本号 · commit · 构建时间，缺省项自动省略。
 * 纯函数（入参驱动，不读全局），便于确定性测试。
 */
export function formatBuildTooltip(info: BuildInfo): string {
  const parts = [formatVersionLabel(info.version)]
  if (info.commit && info.commit !== UNKNOWN) {
    parts.push(info.commit)
  }
  if (info.builtAt && info.builtAt !== UNKNOWN) {
    const date = new Date(info.builtAt)
    parts.push(Number.isNaN(date.getTime()) ? info.builtAt : date.toLocaleString())
  }
  return parts.join(' · ')
}
