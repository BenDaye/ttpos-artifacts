import type { CSSProperties, PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from '@/shared/components/theme-provider'
import { queryClient } from '@/shared/lib/query-client'

/**
 * sonner 自带的 `[data-sonner-toaster]` 规则硬编码了 sans-serif 字体，
 * 且整套配色（含 richColors）挂在 `[data-sonner-theme='light'|'dark']` 下，
 * theme 默认恒为 light。故必须把已解析的主题喂给它，并把 normal 变体
 * 重映射到本站令牌，否则暗色模式下会弹出浅色、非等宽的通知。
 */
const toasterStyle = {
  'fontFamily': 'var(--font-mono)',
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',
} as CSSProperties

function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      richColors
      closeButton
      position="top-right"
      style={toasterStyle}
    />
  )
}

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </QueryClientProvider>
  )
}
