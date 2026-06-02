import type { Architecture } from '@ttpos/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reorderById } from '@/shared/lib/reorder'
import { architecturesApi } from './api'

const KEY = ['architectures']

export function useArchitecturesQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => architecturesApi.list(),
  })
}

export function useCreateArchitectureMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (arch: string) => architecturesApi.create(arch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateArchitectureMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string, arch: string }) =>
      architecturesApi.update(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteArchitectureMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => architecturesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useReorderArchitecturesMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => architecturesApi.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY })
      const previous = qc.getQueryData<Architecture[]>(KEY)
      if (previous) {
        qc.setQueryData<Architecture[]>(KEY, reorderById(previous, ids, item => item.ID))
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
