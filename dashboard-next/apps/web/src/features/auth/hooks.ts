import type { ChangePasswordPayload, LoginPayload, SignUpPayload } from './api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi } from './api'
import { useAuthStore } from './auth-store'

export function useLoginMutation() {
  const setToken = useAuthStore(s => s.setToken)
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data) => {
      setToken(data.token)
    },
  })
}

export function useSignUpMutation() {
  const setToken = useAuthStore(s => s.setToken)
  return useMutation({
    mutationFn: (payload: SignUpPayload) => authApi.signUp(payload),
    onSuccess: (data) => {
      if (data?.token) {
        setToken(data.token)
      }
    },
  })
}

export function useWhoamiQuery() {
  const token = useAuthStore(s => s.token)
  return useQuery({
    queryKey: ['whoami'],
    queryFn: () => authApi.whoami(),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10,
  })
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authApi.changeOwnPassword(payload),
  })
}
