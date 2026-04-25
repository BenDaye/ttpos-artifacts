import type {
  AppListParams,
  SearchVersionsParams,
  UploadVersionPayload,
} from './api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appsApi } from './api'

const APPS_KEY = 'apps'
const SEARCH_KEY = 'app-search'

export function useAppsListQuery(params: AppListParams = {}) {
  return useQuery({
    queryKey: [APPS_KEY, params],
    queryFn: () => appsApi.list(params),
    placeholderData: prev => prev,
  })
}

export function useAppVersionsQuery(params: SearchVersionsParams) {
  return useQuery({
    queryKey: [SEARCH_KEY, params],
    queryFn: () => appsApi.search(params),
    enabled: Boolean(params.app_name),
    placeholderData: prev => prev,
  })
}

export function useUploadVersionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UploadVersionPayload) => appsApi.upload(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [APPS_KEY] })
      void qc.invalidateQueries({ queryKey: [SEARCH_KEY] })
    },
  })
}

export function useDeleteAppMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APPS_KEY] }),
  })
}

export function useDeleteArtifactMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appsApi.removeArtifact(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [APPS_KEY] })
      void qc.invalidateQueries({ queryKey: [SEARCH_KEY] })
    },
  })
}
