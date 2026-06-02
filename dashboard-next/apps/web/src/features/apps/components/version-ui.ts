import type { AppVersion, ArtifactEntry } from '@ttpos/shared'

export function getVersionTone(version: AppVersion): 'critical' | 'published' | 'draft' {
  if (version.Critical)
    return 'critical'
  if (version.Published)
    return 'published'
  return 'draft'
}

/**
 * 在保留后端版本号降序的前提下，对同一 version 号内的多条 channel 记录做稳定二级排序。
 *
 * - 主序：每个 version 号在输入中首次出现的位置，完整保留后端按版本号降序返回的顺序。
 * - 次序：channel 在 channel 列表中的位次（channelOrder）升序，与左侧 channel 列表顺序一致。
 *   位次取自后端按 `{sort:1,_id:1}` 返回的 channel 数组下标：未拖拽时即创建序、拖拽后即
 *   dense sort 序，两种状态都和 channel 列表所见一致。
 * - 末序：位次相同 / channel 不在列表中时，按 channel 名稳定收敛。
 *
 * 不修改入参，返回新数组。
 */
export function sortVersionsByChannel(
  versions: AppVersion[],
  channelOrder: ReadonlyMap<string, number>,
): AppVersion[] {
  const versionOrder = new Map<string, number>()
  versions.forEach((v, i) => {
    if (!versionOrder.has(v.Version))
      versionOrder.set(v.Version, i)
  })
  const rankOf = (channel: string) => channelOrder.get(channel) ?? Number.MAX_SAFE_INTEGER
  return versions.slice().sort((a, b) => {
    const versionDelta = versionOrder.get(a.Version)! - versionOrder.get(b.Version)!
    if (versionDelta !== 0)
      return versionDelta
    const rankDelta = rankOf(a.Channel) - rankOf(b.Channel)
    if (rankDelta !== 0)
      return rankDelta
    return a.Channel.localeCompare(b.Channel)
  })
}

function isExtensionOnly(value: string): boolean {
  return /^\.[a-z0-9]+$/i.test(value.trim())
}

export function getArtifactFileName(artifact: ArtifactEntry): string {
  const packageName = artifact.package?.trim()
  if (packageName && !isExtensionOnly(packageName)) {
    return packageName
  }

  try {
    const url = new URL(artifact.link, 'http://local')
    const key = url.searchParams.get('key') ?? artifact.link
    const decoded = decodeURIComponent(key)
    const fileName = decoded.split('/').filter(Boolean).at(-1)
    if (fileName && !isExtensionOnly(fileName)) {
      return fileName
    }
  }
  catch {
    const fileName = artifact.link.split('/').filter(Boolean).at(-1)
    if (fileName && !isExtensionOnly(fileName)) {
      return fileName
    }
  }

  if (packageName && isExtensionOnly(packageName)) {
    return `${packageName.slice(1).toUpperCase()} artifact`
  }

  return 'Artifact file'
}
