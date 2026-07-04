import type { Architecture } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

interface ArchitectureListResponse {
  archs?: Architecture[]
}

export const architecturesApi = {
  async list(): Promise<Architecture[]> {
    const data = await http.get<ArchitectureListResponse | Architecture[]>('/arch/list')
    if (Array.isArray(data)) {
      return data
    }
    return data?.archs ?? []
  },
  create(arch: string) {
    return http.post('/arch/create', { arch })
  },
  update(payload: { id: string, arch: string }) {
    return http.post('/arch/update', payload)
  },
  remove(id: string) {
    return http.delete('/arch/delete', { query: { id } })
  },
  reorder(ids: string[]) {
    return http.post('/arch/reorder', { ids })
  },
}
