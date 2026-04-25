import type { AdminUpdatePayload, CreateTokenPayload } from './api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from './api'

const USERS_KEY = ['settings', 'users']
const TOKENS_KEY = ['settings', 'tokens']

export function useUsersListQuery() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => settingsApi.usersList(),
  })
}

export function useAdminUpdateMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AdminUpdatePayload) => settingsApi.adminUpdate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useTokensQuery() {
  return useQuery({
    queryKey: TOKENS_KEY,
    queryFn: () => settingsApi.tokensList(),
  })
}

export function useCreateTokenMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTokenPayload) => settingsApi.createToken(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: TOKENS_KEY }),
  })
}

export function useRevokeTokenMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => settingsApi.revokeToken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: TOKENS_KEY }),
  })
}
