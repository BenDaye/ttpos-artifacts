import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
