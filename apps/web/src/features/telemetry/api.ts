import { http } from '@/shared/lib/http'

export type TelemetryRange = 'today' | 'week' | 'month'

export interface TelemetryParams {
  apps?: string[]
  channels?: string[]
  platforms?: string[]
  architectures?: string[]
  range?: TelemetryRange
  date?: string
}

export interface TelemetrySummary {
  total_requests: number
  unique_clients: number
  clients_using_latest_version: number
  clients_outdated: number
  total_active_apps: number
}

export interface TelemetryDailyEntry {
  date: string
  total_requests: number
  unique_clients: number
  clients_using_latest_version: number
  clients_outdated: number
}

export interface VersionUsage {
  version: string
  client_count: number
}

export interface TelemetryVersions {
  used_versions_count: number
  known_versions: string[]
  usage: VersionUsage[]
}

export interface PlatformUsage {
  platform: string
  client_count: number
}

export interface ArchitectureUsage {
  arch: string
  client_count: number
}

export interface ChannelUsage {
  channel: string
  client_count: number
}

export interface TelemetryResponse {
  date: string
  date_range?: string[]
  admin: string
  summary: TelemetrySummary
  versions: TelemetryVersions
  platforms: PlatformUsage[]
  architectures: ArchitectureUsage[]
  channels: ChannelUsage[]
  daily_stats: TelemetryDailyEntry[]
}

export const telemetryApi = {
  get(params: TelemetryParams): Promise<TelemetryResponse> {
    const query: Record<string, string> = {}
    if (params.apps?.length) {
      query.apps = params.apps.join(',')
    }
    if (params.channels?.length) {
      query.channels = params.channels.join(',')
    }
    if (params.platforms?.length) {
      query.platforms = params.platforms.join(',')
    }
    if (params.architectures?.length) {
      query.architectures = params.architectures.join(',')
    }
    if (params.range) {
      query.range = params.range
    }
    if (params.date) {
      query.date = params.date
    }
    return http.get<TelemetryResponse>('/telemetry', { query })
  },
}
