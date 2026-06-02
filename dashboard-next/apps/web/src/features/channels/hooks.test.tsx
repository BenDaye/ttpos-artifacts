import type { Channel } from '@ttpos/shared'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { channelsApi } from './api'
import { useReorderChannelsMutation } from './hooks'

// 模拟 api 层，避免真实网络请求
vi.mock('./api', () => ({
  channelsApi: {
    reorder: vi.fn(),
  },
}))

const KEY = ['channels']

// 每个测试创建独立 QueryClient，挂在模块级供顶层 Wrapper 组件读取
let client: QueryClient

function makeChannel(id: string, sort: number): Channel {
  return { ID: id, ChannelName: `channel-${id}`, Sort: sort, Updated_at: '2024-01-01' }
}

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useReorderChannelsMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({
      defaultOptions: { mutations: { retry: 0 } },
    })
  })

  it('乐观重排：成功时缓存按新顺序排列', async () => {
    const initial = [makeChannel('a', 0), makeChannel('b', 1), makeChannel('c', 2)]
    client.setQueryData(KEY, initial)
    vi.mocked(channelsApi.reorder).mockResolvedValue(undefined)

    const { result } = renderHook(() => useReorderChannelsMutation(), { wrapper: Wrapper })

    // 将顺序改为 c, a, b
    await result.current.mutateAsync(['c', 'a', 'b'])

    const cached = client.getQueryData<Channel[]>(KEY)
    expect(cached?.map(channel => channel.ID)).toEqual(['c', 'a', 'b'])
    expect(channelsApi.reorder).toHaveBeenCalledWith(['c', 'a', 'b'])
  })

  it('onError 回滚：失败时缓存恢复为原始顺序', async () => {
    const initial = [makeChannel('a', 0), makeChannel('b', 1), makeChannel('c', 2)]
    client.setQueryData(KEY, initial)
    vi.mocked(channelsApi.reorder).mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useReorderChannelsMutation(), { wrapper: Wrapper })

    await expect(result.current.mutateAsync(['c', 'a', 'b'])).rejects.toThrow('boom')

    await waitFor(() => {
      const cached = client.getQueryData<Channel[]>(KEY)
      expect(cached?.map(channel => channel.ID)).toEqual(['a', 'b', 'c'])
    })
  })
})
