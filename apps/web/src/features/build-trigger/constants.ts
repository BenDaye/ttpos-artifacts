// Presentation-only aliases for the self-serve build form. The buildable set
// and FaynoSync app names are NOT here; they come from the server's
// /build/capabilities, derived from the build-*.yaml workflow matrices.

export const MAX_BUILD_COUNT = 12

const PACKAGE_ALIASES: Record<string, string> = {
  pos: 'cashier',
  assistant: 'assistant',
  kds: 'kitchen',
  tablet: 'menu',
  shop: 'shop',
  qds: 'queue',
  kiosk: 'kiosk',
}

const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  windows: 'Windows',
  macos: 'macOS',
}

export function packageAlias(pkg: string): string {
  return PACKAGE_ALIASES[pkg] ?? pkg
}

export function appDisplayName(appName: string | undefined, pkg: string): string {
  return appName?.trim() || packageAlias(pkg)
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}
