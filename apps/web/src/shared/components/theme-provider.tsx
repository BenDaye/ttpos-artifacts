import type { ResolvedTheme, ThemeMode } from '@ttpos/shared'
import type { PropsWithChildren } from 'react'
import { STORAGE_KEYS } from '@ttpos/shared'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const NIGHT_START_HOUR = 20
const NIGHT_END_HOUR = 6

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.THEME_MODE)
    if (value === 'light' || value === 'dark' || value === 'auto') {
      return value
    }
  }
  catch {
    /* swallow */
  }
  return 'auto'
}

function resolveAuto(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const hour = new Date().getHours()
  if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) {
    return 'dark'
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === 'auto' ? resolveAuto() : mode
}

function applyResolved(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode())
  const [autoTick, setAutoTick] = useState(0)

  const resolved = useMemo<ResolvedTheme>(() => {
    void autoTick
    return resolveMode(mode)
  }, [mode, autoTick])

  useEffect(() => {
    applyResolved(resolved)
  }, [resolved])

  useEffect(() => {
    if (mode !== 'auto') {
      return undefined
    }
    const tick = () => setAutoTick(t => t + 1)
    const interval = window.setInterval(tick, 60_000)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', tick)
    return () => {
      window.clearInterval(interval)
      media.removeEventListener('change', tick)
    }
  }, [mode])

  const updateMode = useCallback((next: ThemeMode) => {
    setMode(next)
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, next)
    }
    catch {
      /* swallow */
    }
  }, [])

  const cycle = useCallback(() => {
    updateMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light')
  }, [mode, updateMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode: updateMode, cycle }),
    [mode, resolved, updateMode, cycle],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
