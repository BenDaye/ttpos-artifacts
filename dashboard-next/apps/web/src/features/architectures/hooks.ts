import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
