import type { AppVersion, ArtifactEntry } from '@ttpos/shared'

export function getVersionTone(version: AppVersion): 'critical' | 'published' | 'draft' {
  if (version.Critical)
    return 'critical'
  if (version.Published)
    return 'published'
  return 'draft'
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
