import type { Platform, Updater } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

interface PlatformListResponse {
  platforms?: Platform[]
}

export interface PlatformPayload {
  platform: string
  updaters: Updater[]
}

export const platformsApi = {
  async list(): Promise<Platform[]> {
    const data = await http.get<PlatformListResponse | Platform[]>('/platform/list')
    if (Array.isArray(data)) {
      return data
    }
    return data?.platforms ?? []
  },
  create(payload: PlatformPayload) {
    return http.post('/platform/create', payload)
  },
  update(payload: { id: string } & PlatformPayload) {
    return http.post('/platform/update', payload)
  },
  remove(id: string) {
    return http.delete('/platform/delete', { query: { id } })
  },
  reorder(ids: string[]) {
    return http.post('/platform/reorder', { ids })
  },
}
