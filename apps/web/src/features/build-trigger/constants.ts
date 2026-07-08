// Presentation-only labels for the self-serve build form. The buildable set
// (which packages, which platforms) is NOT here — it comes from the server's
// /build/capabilities (derived from the build-*.yaml workflow matrices). These
// maps are only Chinese display names; an unknown id falls back to the id.

export const MAX_BUILD_COUNT = 12

const PACKAGE_LABELS: Record<string, string> = {
  pos: '收银',
  assistant: '助手',
  kds: '厨显',
  tablet: '菜牌',
  shop: '商城',
  qds: '叫号',
  kiosk: '自助机',
}

const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  windows: 'Windows',
  macos: 'macOS',
}

export function packageLabel(pkg: string): string {
  return PACKAGE_LABELS[pkg] ?? pkg
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}
