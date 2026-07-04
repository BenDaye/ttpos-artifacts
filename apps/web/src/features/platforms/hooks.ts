import type { Platform } from '@ttpos/shared'
import type { PlatformPayload } from './api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reorderById } from '@/shared/lib/reorder'
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

export function useReorderPlatformsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => platformsApi.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const previous = qc.getQueryData<Platform[]>(KEY)
      if (previous) {
        qc.setQueryData<Platform[]>(KEY, reorderById(previous, ids, item => item.ID))
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
