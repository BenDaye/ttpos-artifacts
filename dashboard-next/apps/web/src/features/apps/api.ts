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
  items?: AppVersion[]
  total?: number
  page?: number
  limit?: number
}

interface DownloadUrlResponse {
  download_url?: string
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

export interface UpdateVersionPayload {
  id: string
  app_name: string
  version: string
  channel: string
  publish: boolean
  critical: boolean
  intermediate?: boolean
  platform?: string
  arch?: string
  changelog?: string
  updater?: string
  signature?: string
  files?: File[]
}

export interface CreateAppPayload {
  app: string
  description?: string
  private?: boolean
  tuf?: boolean
  logo?: File | null
}

export interface UpdateAppPayload {
  id: string
  app?: string
  description?: string
  logo?: File | null
}

export interface DeleteArtifactPayload {
  id: string
  app_name: string
  version: string
  artifacts_to_delete: string[]
}

function attachData(form: FormData, data: object) {
  form.append('data', JSON.stringify(data))
}

function getDownloadKey(link: string): string | null {
  try {
    const url = new URL(link, window.location.origin)
    if (url.pathname !== '/download') {
      return null
    }
    return url.searchParams.get('key')
  }
  catch {
    return null
  }
}

export const appsApi = {
  async list(params: AppListParams = {}): Promise<{ apps: AppSummary[], total: number }> {
    const data = await http.get<AppListResponse>('/app/list', { query: { ...params } })
    return {
      apps: data?.apps ?? [],
      total: data?.total ?? 0,
    }
  },

  async search(params: SearchVersionsParams): Promise<{ versions: AppVersion[], total: number, page: number, limit: number }> {
    const data = await http.get<SearchResponse>('/search', { query: { ...params } })
    return {
      versions: data?.items ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      limit: data?.limit ?? 0,
    }
  },

  async upload(payload: UploadVersionPayload): Promise<unknown> {
    const { files, ...rest } = payload
    const form = new FormData()
    attachData(form, rest)
    files.forEach(file => form.append('file', file, file.name))
    return http.post('/upload', form)
  },

  async updateVersion(payload: UpdateVersionPayload): Promise<unknown> {
    const { files, ...rest } = payload
    const form = new FormData()
    attachData(form, rest)
    files?.forEach(file => form.append('file', file, file.name))
    return http.post('/apps/update', form)
  },

  async deleteVersion(id: string): Promise<unknown> {
    return http.delete('/apps/delete', { query: { id } })
  },

  async deleteArtifact(payload: DeleteArtifactPayload): Promise<unknown> {
    const form = new FormData()
    attachData(form, payload)
    return http.post('/artifact/delete', form)
  },

  async resolveDownloadUrl(link: string): Promise<string> {
    const key = getDownloadKey(link)
    if (!key) {
      return link
    }
    const data = await http.get<DownloadUrlResponse | string>('/download', { query: { key } })
    if (data && typeof data === 'object' && 'download_url' in data && data.download_url) {
      return data.download_url
    }
    return link
  },

  async createApp(payload: CreateAppPayload): Promise<unknown> {
    const { logo, ...rest } = payload
    const form = new FormData()
    attachData(form, rest)
    if (logo) {
      form.append('file', logo, logo.name)
    }
    return http.post('/app/create', form)
  },

  async updateApp(payload: UpdateAppPayload): Promise<unknown> {
    const { logo, ...rest } = payload
    const form = new FormData()
    attachData(form, rest)
    if (logo) {
      form.append('file', logo, logo.name)
    }
    return http.post('/app/update', form)
  },

  async deleteApp(id: string): Promise<unknown> {
    return http.delete('/app/delete', { query: { id } })
  },
}
