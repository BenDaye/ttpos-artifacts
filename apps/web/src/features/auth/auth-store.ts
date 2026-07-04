import { STORAGE_KEYS } from '@ttpos/shared'
import { create } from 'zustand'

interface AuthState {
  token: string | null
  setToken: (token: string | null) => void
  clear: () => void
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN)
  }
  catch {
    return null
  }
}

function persistToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
    }
    else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN)
    }
  }
  catch {
    /* swallow */
  }
}

export const useAuthStore = create<AuthState>(set => ({
  token: readStoredToken(),
  setToken: (token) => {
    persistToken(token)
    set({ token })
  },
  clear: () => {
    persistToken(null)
    set({ token: null })
  },
}))

export function isAuthenticated(): boolean {
  return Boolean(useAuthStore.getState().token)
}
