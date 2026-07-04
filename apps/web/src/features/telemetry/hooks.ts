import type { TelemetryParams } from './api'
import { useQuery } from '@tanstack/react-query'
import { telemetryApi } from './api'

export function useTelemetryQuery(params: TelemetryParams = {}) {
  return useQuery({
    queryKey: ['telemetry', params],
    queryFn: () => telemetryApi.get(params),
  })
}
