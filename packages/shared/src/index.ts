export const STORAGE_KEYS = {
  TOKEN: 'token',
  THEME_MODE: 'themeMode',
  LAYOUT_PREFERENCE: 'layoutPreference',
  LANGUAGE: 'i18nextLng',
} as const

export const API_PROXY_PREFIXES = [
  '/apps',
  '/app',
  '/user',
  '/users',
  '/whoami',
  '/channel',
  '/search',
  '/telemetry',
  '/platform',
  '/arch',
  '/admin',
  '/tuf',
  '/upload',
  '/artifact',
  '/token',
  '/download',
  '/login',
  '/signup',
] as const

export type LayoutMode = 'card' | 'list' | 'board'
export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export interface AppSummary {
  ID: string
  AppName: string
  Logo: string
  Description: string
  // 公开下载短链的名字，对应 /dl/<ShortLink>.<ext>；留空表示未设置
  ShortLink: string
  // 排序权重，后端按该值升序返回；拖拽排序后全量重写
  Sort: number
  Updated_at: string
}

export interface AppVersion {
  ID: string
  AppName: string
  Version: string
  Channel: string
  Published: boolean
  Critical: boolean
  Intermediate: boolean
  Artifacts: ArtifactEntry[]
  Changelog: ChangelogEntry[]
  Updated_at: string
}

export interface ArtifactEntry {
  link: string
  platform: string
  arch: string
  package: string
}

export interface ChangelogEntry {
  Version: string
  Changes: string
  Date: string
}

export interface Channel {
  ID: string
  ChannelName: string
  // 排序权重，后端按该值升序返回；拖拽排序后全量重写
  Sort: number
  Updated_at: string
}

export type UpdaterType
  = | 'manual'
    | 'squirrel_darwin'
    | 'squirrel_windows'
    | 'sparkle'
    | 'electron-builder'
    | 'tauri'
    | (string & {})

export interface Updater {
  type: UpdaterType
  default?: boolean
}

export interface Platform {
  ID: string
  PlatformName: string
  Updaters?: Updater[]
  // 排序权重，后端按该值升序返回；拖拽排序后全量重写
  Sort: number
  Updated_at: string
}

export interface Architecture {
  ID: string
  ArchID: string
  // 排序权重，后端按该值升序返回；拖拽排序后全量重写
  Sort: number
  Updated_at: string
}

export interface UserProfile {
  id: string
  username: string
  is_admin: boolean
  permissions?: Record<string, unknown>
}

export interface ApiToken {
  id: string
  name: string
  token_prefix: string
  allowed_apps: string[]
  created_at: string
  last_used_at?: string
  expires_at?: string
}

export interface TeamUserPermissionGroup {
  Create: boolean
  Delete: boolean
  Edit: boolean
  Allowed: string[]
}

export interface TeamUserAppsPermission extends TeamUserPermissionGroup {
  Download: boolean
  Upload: boolean
}

export interface TeamUserPermissions {
  Apps: TeamUserAppsPermission
  Channels: TeamUserPermissionGroup
  Platforms: TeamUserPermissionGroup
  Archs: TeamUserPermissionGroup
}

export interface TeamUser {
  id: string
  username: string
  permissions: TeamUserPermissions
  updated_at?: string
}
