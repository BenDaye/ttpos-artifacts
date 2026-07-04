import type { AppSummary } from '@ttpos/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppCardView } from './app-card-view'

// 隔离 i18n 加载：让 t(key, { defaultValue }) 直接返回 defaultValue，
// 使 grip 的 aria-label 在测试中稳定为 'Drag to reorder'。
vi.mock('react-i18next', () => ({
  // eslint-disable-next-line react/component-hook-factories -- 测试桩需导出 useTranslation hook
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))

function makeApp(id: string, name: string): AppSummary {
  return { ID: id, AppName: name, Logo: '', Description: '', Sort: 0, Updated_at: '2025-01-01T00:00:00Z' }
}

const apps = [makeApp('a', 'App A'), makeApp('b', 'App B'), makeApp('c', 'App C')]
function noop() {}

describe('appCardView 拖拽接线', () => {
  it('canReorder=true 且有 onReorder 时，每张卡片渲染一个拖拽手柄', () => {
    render(
      <AppCardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} onReorder={noop} canReorder />,
    )
    expect(screen.getAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(apps.length)
  })

  it('canReorder=false 时不渲染拖拽手柄', () => {
    render(
      <AppCardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} onReorder={noop} canReorder={false} />,
    )
    expect(screen.queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)
  })

  it('缺少 onReorder 时不渲染拖拽手柄', () => {
    render(
      <AppCardView apps={apps} onSelect={noop} onEdit={noop} onDelete={noop} canReorder />,
    )
    expect(screen.queryAllByRole('button', { name: 'Drag to reorder' })).toHaveLength(0)
  })
})
