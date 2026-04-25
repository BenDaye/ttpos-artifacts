import type { AppSummary, AppVersion } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

export interface AppListParams {
  page?: number
  limit?: number
}

export interface SearchVersionsParams {
  app_name: string
  page?: number
  limit?: number
  channel?: string
  platform?: string
  arch?: string
  published?: boolean
  critical?: boolean
}

interface AppListResponse {
  apps?: AppSummary[]
  total?: number
}

interface SearchResponse {
  apps?: AppVersion[]
  total?: number
}

export interface UploadVersionPayload {
  app_name: string
  version: string
  channel: string
  platform: string
  arch: string
  publish: boolean
  critical: boolean
  intermediate?: boolean
  changelog?: string
  updater?: string
  signature?: string
  files: File[]
}

function appendData(form: FormData, data: Record<string, unknown>) {
  form.append('data', JSON.stringify(data))
}

export const appsApi = {
  async list(params: AppListParams = {}): Promise<{ apps: AppSummary[], total: number }> {
    const data = await http.get<AppListResponse>('/app/list', { query: { ...params } })
    return {
      apps: data?.apps ?? [],
      total: data?.total ?? 0,
    }
  },

  async search(params: SearchVersionsParams): Promise<{ versions: AppVersion[], total: number }> {
    const data = await http.get<SearchResponse>('/search', { query: { ...params } })
    return {
      versions: data?.apps ?? [],
      total: data?.total ?? 0,
    }
  },

  async upload(payload: UploadVersionPayload): Promise<unknown> {
    const { files, ...rest } = payload
    const form = new FormData()
    appendData(form, rest)
    files.forEach(file => form.append('file', file, file.name))
    return http.post('/upload', form)
  },

  async update(payload: { id: string, app_name?: string, logo?: string, description?: string }): Promise<unknown> {
    const form = new FormData()
    appendData(form, payload)
    return http.post('/apps/update', form)
  },

  remove(id: string) {
    return http.delete('/apps/delete', { query: { id } })
  },

  removeArtifact(id: string) {
    return http.post('/artifact/delete', null, { query: { id } })
  },
}
