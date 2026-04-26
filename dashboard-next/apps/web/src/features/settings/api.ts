import type { ApiToken, TeamUser, TeamUserPermissions, UserProfile } from '@ttpos/shared'
import { http } from '@/shared/lib/http'

interface TeamUsersListResponse {
  users?: TeamUser[]
}

interface TokenListResponse {
  tokens?: ApiToken[]
}

export interface CreateTokenPayload {
  name: string
  allowed_apps?: string[]
  expires_at?: string
}

export interface CreateTokenResponse extends ApiToken {
  token: string
}

export interface AdminUpdatePayload {
  id: string
  username: string
  password: string
}

export interface CreateTeamUserPayload {
  username: string
  password: string
  permissions: TeamUserPermissions
}

export interface UpdateTeamUserPayload {
  id: string
  username?: string
  password?: string
  permissions: TeamUserPermissions
}

export const settingsApi = {
  whoami() {
    return http.get<UserProfile>('/whoami')
  },
  async usersList(): Promise<TeamUser[]> {
    const data = await http.get<TeamUsersListResponse>('/users/list')
    return data?.users ?? []
  },
  createUser(payload: CreateTeamUserPayload) {
    return http.post('/user/create', payload)
  },
  updateUser(payload: UpdateTeamUserPayload) {
    return http.post('/user/update', payload)
  },
  deleteUser(id: string) {
    return http.delete('/user/delete', { body: { id } })
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
