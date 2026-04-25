import type { ApiToken, UserProfile } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

interface UsersListResponse {
  users?: UserProfile[]
}

interface TokenListResponse {
  tokens?: ApiToken[]
}

export interface CreateTokenPayload {
  name: string
  expires_in_days?: number
}

export interface CreateTokenResponse {
  token: string
  details?: ApiToken
}

export interface AdminUpdatePayload {
  id: string
  username?: string
  password?: string
}

export const settingsApi = {
  async usersList(): Promise<UserProfile[]> {
    const data = await http.get<UsersListResponse>('/users/list')
    return data?.users ?? []
  },
  adminUpdate(payload: AdminUpdatePayload) {
    return http.post('/admin/update', payload)
  },
  async tokensList(): Promise<ApiToken[]> {
    const data = await http.get<TokenListResponse>('/token/list')
    return data?.tokens ?? []
  },
  createToken(payload: CreateTokenPayload) {
    return http.post<CreateTokenResponse>('/token/create', payload)
  },
  revokeToken(id: string) {
    return http.delete('/token/delete', { query: { id } })
  },
}
