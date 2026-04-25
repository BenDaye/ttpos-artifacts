import { http } from '@/shared/lib/http'

export interface LoginPayload {
  username: string
  password: string
}

export interface SignUpPayload extends LoginPayload {
  api_key: string
}

export interface LoginResponse {
  token: string
}

export interface WhoamiResponse {
  username: string
  is_admin: boolean
  permissions?: Record<string, unknown>
}

export const authApi = {
  login(payload: LoginPayload) {
    return http.post<LoginResponse>('/login', payload, { skipAuth: true })
  },
  signUp(payload: SignUpPayload) {
    return http.post<LoginResponse>('/signup', payload, { skipAuth: true })
  },
  whoami() {
    return http.get<WhoamiResponse>('/whoami')
  },
}
