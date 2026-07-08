import { http } from '@/shared/lib/http'

export interface TriggerBuildRequest {
  packages: string[]
  platforms: string[]
  branch: string
}

export interface BuildTarget {
  package: string
  app_name: string
  platform: string
}

export interface TriggerBuildResponse {
  correlation_id: string
  env: 'test'
  build_count: number
  run_url?: string
  status: string
  targets: BuildTarget[]
}

export const buildTriggerApi = {
  trigger(req: TriggerBuildRequest): Promise<TriggerBuildResponse> {
    return http.post<TriggerBuildResponse>('/build/trigger', req)
  },
}
