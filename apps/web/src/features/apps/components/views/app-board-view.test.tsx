import type { AppSummary } from '@ttpos/shared'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppBoardView } from './app-board-view'

// 隔离 i18n 加载：t(key, { defaultValue }) 直接返回 defaultValue。
vi.mock('react-i18next', () => ({
  // eslint-disable-next-line react/component-hook-factories -- 测试桩需导出 useTranslation hook
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))

// board 列头不依赖版本数据即可渲染拖拽手柄；mock search 返回空集，避免真实网络。
vi.mock('../../api', () => ({
  appsApi: {
    search: vi.fn().mockResolvedValue({ versions: [], total: 0, page: 1, limit: 0 }),
  },
}))

function makeApp(id: string, name: string): AppSummary {
  return { ID: id, AppName: name, Logo: '', Description: '', ShortLink: '', Sort: 0, Updated_at: '2025-01-01T00:00:00Z' }
}

const apps = [makeApp('a', 'App A'), makeApp('b', 'App B')]
function noop() {}

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('appBoardView 拖拽接线', () => {
  it('canReorder=true 且有 onReorder 时，每个列头渲染一个拖拽手柄', () => {
    render(
      <AppBoardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} onReorder={noop} canReorder />,
      { wrapper: Wrapper },
    )
    expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(apps.length)
  })

  it('canReorder=false 时不渲染拖拽手柄', () => {
    render(
      <AppBoardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} onReorder={noop} canReorder={false} />,
      { wrapper: Wrapper },
    )
    expect(screen.queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)
  })

  it('缺少 onReorder 时不渲染拖拽手柄', () => {
    render(
      <AppBoardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} canReorder />,
      { wrapper: Wrapper },
    )
    expect(screen.queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)
  })
})
