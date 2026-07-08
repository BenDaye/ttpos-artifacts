import type { BuildTarget, TriggerBuildRequest } from './api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appsApi } from '@/features/apps/api'
import { SEARCH_KEY } from '@/features/apps/hooks'
import { HttpError } from '@/shared/lib/http'
import { buildTriggerApi } from './api'

export function useTriggerBuild() {
  return useMutation({
    mutationFn: (req: TriggerBuildRequest) => buildTriggerApi.trigger(req),
    onError: (err) => {
      const message
        = err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Build trigger failed'
      toast.error(message)
    },
  })
}

export type TargetStatus = 'building' | 'done' | 'timeout'

export interface TargetResult {
  target: BuildTarget
  status: TargetStatus
}

export const BUILD_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const POLL_INTERVAL_MS = 8_000

// useBuildCompletion uses a single combined query over all unique app_names.
// Since the existing /search API only supports one app_name at a time, we
// aggregate by querying a *joined* key but still fetching one app at a time
// via a Promise-based query function.
//
// NOTE ON PLATFORM GRANULARITY: The existing /search API supports `platform`
// filtering but that filters *versions* by which have at least one artifact
// on that platform — it cannot tell us whether a *specific* (app_name,
// platform) target has an artifact for this exact correlationId. We therefore
// degrade: once a version containing `+b${correlationId}` appears for an
// app_name, ALL targets for that app_name are marked done. Per-platform
// completion detection is deferred to Track 2-b when the API supports it.
export function useBuildCompletion(
  correlationId: string,
  targets: BuildTarget[],
  enabled: boolean,
  // Whether the overall 30-minute timeout has elapsed. Computed by the caller
  // (e.g., via a state variable updated in an effect) to avoid calling
  // Date.now() during render inside this hook.
  isTimedOut: boolean,
) {
  const suffixTag = `+b${correlationId}`
  const appNames = [...new Set(targets.map(t => t.app_name))]

  // Single query fetching all unique app_names in one go via Promise.all.
  // This satisfies rules-of-hooks (one call per render) while covering all
  // unique app_names in the target list.
  const combinedQuery = useQuery({
    queryKey: [SEARCH_KEY, { _buildPoll: correlationId, _apps: appNames }],
    queryFn: async () => {
      const results = await Promise.all(
        appNames.map(appName =>
          appsApi.search({ app_name: appName, limit: 50 }).then(res => ({
            appName,
            versions: res.versions ?? [],
          })),
        ),
      )
      return results
    },
    enabled: enabled && Boolean(correlationId) && appNames.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data ?? []
      const allDone = appNames.every((appName) => {
        const entry = data.find(d => d.appName === appName)
        return (entry?.versions ?? []).some(v => v.Version.includes(suffixTag))
      })
      return allDone ? false : POLL_INTERVAL_MS
    },
    placeholderData: prev => prev,
  })

  const appDoneMap = new Map<string, boolean>()
  const combinedData = combinedQuery.data ?? []
  appNames.forEach((appName) => {
    const entry = combinedData.find(d => d.appName === appName)
    const found = (entry?.versions ?? []).some(v => v.Version.includes(suffixTag))
    appDoneMap.set(appName, found)
  })

  const results: TargetResult[] = targets.map((target) => {
    const isDone = appDoneMap.get(target.app_name) ?? false
    if (isDone) {
      return { target, status: 'done' as TargetStatus }
    }
    if (isTimedOut) {
      return { target, status: 'timeout' as TargetStatus }
    }
    return { target, status: 'building' as TargetStatus }
  })

  const allSettled = results.every(r => r.status === 'done' || r.status === 'timeout')
  const doneCount = results.filter(r => r.status === 'done').length

  return { results, allSettled, doneCount }
}
