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
  Updated_at: string
}

export interface AppVersion {
  ID: string
  AppName: string
  Version: string
  Channel: string
  Platform: string
  Arch: string
  Package: string
  Critical: boolean
  Published: boolean
  Changelog: string
  Updated_at: string
  Artifacts: ArtifactEntry[]
}

export interface ArtifactEntry {
  link: string
  package: string
  arch: string
  platform: string
}

export interface Channel {
  ID: string
  ChannelName: string
  Updated_at: string
}

export interface Platform {
  ID: string
  PlatformName: string
  Updated_at: string
}

export interface Architecture {
  ID: string
  ArchID: string
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
