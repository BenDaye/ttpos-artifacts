import type { AppSummary } from '@ttpos/shared'
import type { PropsWithChildren, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppBoardView } from './app-board-view'

// 隔离 i18n：t(key, { defaultValue }) 直接返回 defaultValue，便于按可见文案断言。
vi.mock('react-i18next', () => ({
  // eslint-disable-next-line react/component-hook-factories -- 测试桩需导出 useTranslation hook
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))

// 详情弹层底部用 <Link> 跳转 app 详情，需脱离 RouterProvider 渲染：桩成普通 <a>。
vi.mock('@tanstack/react-router', () => ({
  // eslint-disable-next-line react/component-hook-factories -- 测试桩需在 mock 工厂内导出 Link 组件
  Link: ({ children, className }: { children?: ReactNode, className?: string, to?: string, params?: unknown }) => (
    <a className={className}>{children}</a>
  ),
}))

// vi.mock 工厂会被提升到 import 之前，可变 fixture 必须用 vi.hoisted 一并提升，
// 否则工厂引用模块级 let 会触发「Cannot access before initialization」。
const fixture = vi.hoisted(() => {
  const artifactA = { link: 'a.apk', platform: 'android', arch: 'arm64', package: 'alpha-1.0.0.apk' }
  const artifactB = { link: 'b.apk', platform: 'android', arch: 'x86', package: 'beta-1.0.0.apk' }
  return { artifactA, artifactB, state: { artifacts: [artifactA, artifactB] } }
})

// search 每次读取最新 fixture；deleteArtifact 按 link 从 fixture 移除并解析，
// 模拟「mutation 成功 -> 失效查询 -> refetch 取到更新后的版本数据」。
vi.mock('../../api', () => ({
  appsApi: {
    search: vi.fn(async () => ({
      versions: [{
        ID: 'v1',
        AppName: 'App A',
        Version: '1.0.0',
        Channel: 'stable',
        Published: true,
        Critical: false,
        Intermediate: false,
        Artifacts: fixture.state.artifacts,
        Changelog: [],
        Updated_at: '2025-01-01T00:00:00Z',
      }],
      total: 1,
      page: 1,
      limit: 100,
    })),
    deleteArtifact: vi.fn(async (payload: { link: string }) => {
      fixture.state.artifacts = fixture.state.artifacts.filter(a => a.link !== payload.link)
      return {}
    }),
    resolveDownloadUrl: vi.fn(async (link: string) => link),
  },
  buildDeleteArtifactPayload: (_id: string, _app: string, _version: string, link: string) => ({ link }),
}))

function noop() {}

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 0 } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const app: AppSummary = {
  ID: 'a',
  AppName: 'App A',
  Logo: '',
  Description: '',
  ShortLink: '',
  Sort: 0,
  Updated_at: '2025-01-01T00:00:00Z',
}

describe('appBoardView 详情弹层随 mutation 即时刷新', () => {
  it('打开版本详情弹层后删除一个 artifact，弹层即时反映删除而无需关闭重开', async () => {
    fixture.state.artifacts = [fixture.artifactA, fixture.artifactB]

    render(
      <AppBoardView apps={[app]} onSelect={noop} onEdit={noop} onDelete={noop} />,
      { wrapper: Wrapper },
    )

    // 打开版本详情弹层
    fireEvent.click(await screen.findByTestId('board-version-card'))
    const dialog = await screen.findByTestId('version-detail-dialog')

    // 初始两个 artifact 都在弹层中（artifact 文件名只出现在弹层，可用 screen 级唯一断言）
    expect(within(dialog).getByText('alpha-1.0.0.apk')).toBeInTheDocument()
    expect(within(dialog).getByText('beta-1.0.0.apk')).toBeInTheDocument()

    // 删除第一个 artifact（alpha），并在确认弹层中确认
    const [firstDeleteButton] = within(dialog).getAllByRole('button', { name: 'Delete artifact?' })
    if (!firstDeleteButton) {
      throw new Error('expected at least one delete-artifact button in dialog')
    }
    fireEvent.click(firstDeleteButton)
    // ConfirmDialog 基于 shadcn AlertDialog，role 为 alertdialog（破坏性操作语义）
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete artifact?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'common:actions.delete' }))

    // 详情弹层仍打开：alpha 消失、beta 保留 —— 证明读视图随 refetch 即时刷新（非冻结快照）
    await waitFor(() => {
      expect(screen.queryByText('alpha-1.0.0.apk')).not.toBeInTheDocument()
    })
    expect(screen.getByText('beta-1.0.0.apk')).toBeInTheDocument()
    expect(screen.getByTestId('version-detail-dialog')).toBeInTheDocument()
  })
})
