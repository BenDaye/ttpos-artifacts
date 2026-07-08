// Single source of truth for the self-serve build-trigger option sets.
// Both the trigger dialog and the status sheet import from here so the package
// label map cannot drift.
//
// NOTE: qds (叫号) is intentionally excluded — it is android-only in the build
// system (auto-build's iOS/Windows/macOS steps exclude qds), so a multi-platform
// self-serve build would silently time out. Keep this list in lockstep with the
// server's BUILD_PACKAGE_APP_MAP keys.

export interface PackageOption {
  value: string
  label: string
}

export const PACKAGE_OPTIONS: PackageOption[] = [
  { value: 'pos', label: '收银' },
  { value: 'assistant', label: '助手' },
  { value: 'kds', label: '厨显' },
  { value: 'tablet', label: '菜牌' },
  { value: 'shop', label: '商城' },
  { value: 'kiosk', label: '自助机' },
]

export const PLATFORM_OPTIONS: string[] = ['android', 'ios', 'windows', 'macos']

export const MAX_BUILD_COUNT = 12

const PACKAGE_LABELS: Record<string, string> = Object.fromEntries(
  PACKAGE_OPTIONS.map(p => [p.value, p.label]),
)

export function packageLabel(pkg: string): string {
  return PACKAGE_LABELS[pkg] ?? pkg
}
