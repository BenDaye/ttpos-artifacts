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

export interface TelemetryDailyEntry {
  date: string
  total: number
}

export interface TelemetryBucket {
  name: string
  total: number
}

export interface TelemetryResponse {
  summary?: {
    total_downloads?: number
    unique_apps?: number
    unique_versions?: number
    unique_users?: number
  }
  daily_stats?: TelemetryDailyEntry[]
  versions?: TelemetryBucket[]
  platforms?: TelemetryBucket[]
  architectures?: TelemetryBucket[]
  channels?: TelemetryBucket[]
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
