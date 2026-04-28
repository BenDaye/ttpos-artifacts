import type { Platform, Updater, UpdaterType } from '@ttpos/shared'

export interface UpdaterOption {
  type: UpdaterType
  label: string
  description: string
}

export const UPDATER_OPTIONS: UpdaterOption[] = [
  { type: 'manual', label: 'Manual', description: 'Generic artifact download flow' },
  { type: 'squirrel_darwin', label: 'Squirrel Darwin', description: 'Squirrel update metadata for macOS' },
  { type: 'squirrel_windows', label: 'Squirrel Windows', description: 'Squirrel update metadata for Windows' },
  { type: 'sparkle', label: 'Sparkle', description: 'Sparkle appcast-compatible artifacts' },
  { type: 'electron-builder', label: 'Electron Builder', description: 'Electron Builder update channels' },
  { type: 'tauri', label: 'Tauri', description: 'Tauri signed update manifest' },
]

export const DEFAULT_UPDATERS: Updater[] = [{ type: 'manual', default: true }]

type UpdaterSource = Updater[] | Pick<Platform, 'Updaters'> | null | undefined

function readUpdaters(source?: UpdaterSource): Updater[] {
  if (Array.isArray(source)) {
    return source
  }
  return source?.Updaters ?? []
}

export function normalizeUpdaters(source?: UpdaterSource): Updater[] {
  const seen = new Set<string>()
  const next = readUpdaters(source)
    .filter(updater => updater.type)
    .filter((updater) => {
      if (seen.has(updater.type)) {
        return false
      }
      seen.add(updater.type)
      return true
    })
    .map(updater => ({
      type: updater.type,
      default: Boolean(updater.default),
    }))

  if (!next.some(updater => updater.type === 'manual')) {
    next.push({ type: 'manual', default: !next.some(updater => updater.default) })
  }

  if (next.length === 0) {
    return [...DEFAULT_UPDATERS]
  }

  const defaultIndex = next.findIndex(updater => updater.default)
  const resolvedDefaultIndex = defaultIndex >= 0
    ? defaultIndex
    : Math.max(0, next.findIndex(updater => updater.type === 'manual'))

  return next.map((updater, index) => ({
    ...updater,
    default: index === resolvedDefaultIndex,
  }))
}

export function getDefaultUpdaterType(source?: UpdaterSource): string {
  return normalizeUpdaters(source).find(updater => updater.default)?.type ?? 'manual'
}

export function getUpdaterLabel(type: string): string {
  return UPDATER_OPTIONS.find(option => option.type === type)?.label ?? type
}

export function isTauriUpdater(updater?: string): boolean {
  return updater === 'tauri'
}
