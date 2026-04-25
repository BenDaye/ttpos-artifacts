import type { PlatformPayload } from './api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { platformsApi } from './api'

const KEY = ['platforms']

export function usePlatformsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => platformsApi.list(),
  })
}

export function useCreatePlatformMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PlatformPayload) => platformsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePlatformMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string } & PlatformPayload) =>
      platformsApi.update(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePlatformMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => platformsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
