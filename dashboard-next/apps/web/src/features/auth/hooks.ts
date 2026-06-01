import type { LoginPayload, SignUpPayload } from './api'
import { useMutation } from '@tanstack/react-query'
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
