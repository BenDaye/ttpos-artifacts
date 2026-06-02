import type { Channel } from '@ttpos/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reorderById } from '@/shared/lib/reorder'
import { channelsApi } from './api'

const KEY = ['channels']

export function useChannelsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => channelsApi.list(),
  })
}

export function useCreateChannelMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (channel: string) => channelsApi.create(channel),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateChannelMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string, channel: string }) =>
      channelsApi.update(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteChannelMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => channelsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useReorderChannelsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => channelsApi.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const previous = qc.getQueryData<Channel[]>(KEY)
      if (previous) {
        qc.setQueryData<Channel[]>(KEY, reorderById(previous, ids, item => item.ID))
      }
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        qc.setQueryData(KEY, context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
