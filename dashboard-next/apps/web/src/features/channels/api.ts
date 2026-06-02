import type { Channel } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

interface ChannelListResponse {
  channels?: Channel[]
}

export const channelsApi = {
  async list(): Promise<Channel[]> {
    const data = await http.get<ChannelListResponse | Channel[]>('/channel/list')
    if (Array.isArray(data)) {
      return data
    }
    return data?.channels ?? []
  },
  create(channel: string) {
    return http.post('/channel/create', { channel })
  },
  update(payload: { id: string, channel: string }) {
    return http.post('/channel/update', payload)
  },
  remove(id: string) {
    return http.delete('/channel/delete', { query: { id } })
  },
  reorder(ids: string[]) {
    return http.post('/channel/reorder', { ids })
  },
}
