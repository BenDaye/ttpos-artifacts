import type { AppSummary } from '@ttpos/shared'
import type {
  AppListParams,
  CreateAppPayload,
  DeleteArtifactPayload,
  SearchVersionsParams,
  UpdateAppPayload,
  UpdateVersionPayload,
  UploadVersionPayload,
} from './api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reorderById } from '@/shared/lib/reorder'
import { appsApi } from './api'

const APPS_KEY = 'apps'
export const SEARCH_KEY = 'app-search'

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

export function useUpdateVersionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateVersionPayload) => appsApi.updateVersion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEARCH_KEY] }),
  })
}

export function useDeleteVersionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appsApi.deleteVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEARCH_KEY] }),
  })
}

export function useDeleteArtifactMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DeleteArtifactPayload) => appsApi.deleteArtifact(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SEARCH_KEY] }),
  })
}

export function useCreateAppMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAppPayload) => appsApi.createApp(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APPS_KEY] }),
  })
}

export function useUpdateAppMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateAppPayload) => appsApi.updateApp(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APPS_KEY] }),
  })
}

export function useDeleteAppMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appsApi.deleteApp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [APPS_KEY] })
      void qc.invalidateQueries({ queryKey: [SEARCH_KEY] })
    },
  })
}

// apps 列表缓存形如 { apps, total }，且 query key 带分页参数，
// 因此用 partial key 复数形式批量乐观重排，避免与调用方参数耦合。
interface AppListData { apps: AppSummary[], total: number }

export function useReorderAppsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => appsApi.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: [APPS_KEY] })
      const previous = qc.getQueriesData<AppListData>({ queryKey: [APPS_KEY] })
      qc.setQueriesData<AppListData>({ queryKey: [APPS_KEY] }, (data) => {
        if (!data) {
          return data
        }
        return { ...data, apps: reorderById(data.apps, ids, item => item.ID) }
      })
      return { previous }
    },
    onError: (_err, _ids, context) => {
      context?.previous?.forEach(([key, data]) => {
        qc.setQueryData(key, data)
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [APPS_KEY] }),
  })
}
