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

// Capabilities are derived from the build-*.yaml workflow matrices (single
// source of truth) and served by the server; the form renders from them.
export interface PackageCapability {
  package: string
  app_name: string
  platforms: string[]
}

export interface BuildCapabilities {
  platforms: string[]
  packages: PackageCapability[]
}

export const buildTriggerApi = {
  trigger(req: TriggerBuildRequest): Promise<TriggerBuildResponse> {
    return http.post<TriggerBuildResponse>('/build/trigger', req)
  },
  capabilities(): Promise<BuildCapabilities> {
    return http.get<BuildCapabilities>('/build/capabilities')
  },
}
