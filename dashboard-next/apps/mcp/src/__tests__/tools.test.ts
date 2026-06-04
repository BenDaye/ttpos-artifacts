import type { RegistryApi, RequestOptions } from '../client'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import { fetchAppList, fetchLatestVersion, fetchVersionSearch } from '../tools/apps'
import { fetchHealth, fetchWhoami } from '../tools/system'
import { fetchArchitectures, fetchChannels, fetchPlatforms } from '../tools/taxonomy'
import { fetchTelemetry, telemetryResult } from '../tools/telemetry'

interface RecordedCall {
  path: string
  options?: RequestOptions
}

function makeStub(result: unknown = { ok: true }): { client: RegistryApi, calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const client: RegistryApi = {
    get: async (path, options) => {
      calls.push({ path, options })
      return result
    },
  }
  return { client, calls }
}

describe('app tools', () => {
  it('list_apps queries /app/list with auth and pagination', async () => {
    const { client, calls } = makeStub()
    await fetchAppList(client, { page: 2, limit: 5 })
    expect(calls[0]?.path).toBe('/app/list')
    expect(calls[0]?.options?.auth).toBe(true)
    expect(calls[0]?.options?.query).toMatchObject({ page: 2, limit: 5 })
  })

  it('search_versions queries /search with the provided filters', async () => {
    const { client, calls } = makeStub()
    await fetchVersionSearch(client, { app_name: 'demo', channel: 'stable', published: true })
    expect(calls[0]?.path).toBe('/search')
    expect(calls[0]?.options?.auth).toBe(true)
    expect(calls[0]?.options?.query).toMatchObject({ app_name: 'demo', channel: 'stable', published: true })
  })

  it('latest_version queries the public /apps/latest endpoint', async () => {
    const { client, calls } = makeStub()
    await fetchLatestVersion(client, { app_name: 'demo', channel: 'stable' })
    expect(calls[0]?.path).toBe('/apps/latest')
    expect(calls[0]?.options?.auth).toBe(false)
  })
})

describe('taxonomy tools', () => {
  it('list_channels queries /channel/list with auth', async () => {
    const { client, calls } = makeStub()
    await fetchChannels(client)
    expect(calls[0]?.path).toBe('/channel/list')
    expect(calls[0]?.options?.auth).toBe(true)
  })

  it('list_platforms queries /platform/list with auth', async () => {
    const { client, calls } = makeStub()
    await fetchPlatforms(client)
    expect(calls[0]?.path).toBe('/platform/list')
    expect(calls[0]?.options?.auth).toBe(true)
  })

  it('list_architectures queries /arch/list with auth', async () => {
    const { client, calls } = makeStub()
    await fetchArchitectures(client)
    expect(calls[0]?.path).toBe('/arch/list')
    expect(calls[0]?.options?.auth).toBe(true)
  })
})

describe('system tools', () => {
  it('health_check queries the public /health endpoint', async () => {
    const { client, calls } = makeStub()
    await fetchHealth(client)
    expect(calls[0]?.path).toBe('/health')
    expect(calls[0]?.options?.auth).toBe(false)
  })

  it('whoami queries /whoami with auth', async () => {
    const { client, calls } = makeStub()
    await fetchWhoami(client)
    expect(calls[0]?.path).toBe('/whoami')
    expect(calls[0]?.options?.auth).toBe(true)
  })
})

describe('telemetry tool', () => {
  it('joins array filters into comma query values', async () => {
    const { client, calls } = makeStub()
    await fetchTelemetry(client, { apps: ['a', 'b'], range: 'week' })
    expect(calls[0]?.path).toBe('/telemetry')
    expect(calls[0]?.options?.query).toMatchObject({ apps: ['a', 'b'], range: 'week' })
  })

  it('maps a 403 into a clear "telemetry not enabled" result', async () => {
    const client: RegistryApi = {
      get: async () => {
        throw new ApiError(403, 'Telemetry is not enabled on this instance')
      },
    }
    const result = await telemetryResult(client, {})
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ type: 'text' })
    expect(JSON.stringify(result.content)).toContain('not enabled')
  })

  it('returns telemetry data on success', async () => {
    const { client } = makeStub({ summary: { total_requests: 42 } })
    const result = await telemetryResult(client, { range: 'month' })
    expect(result.isError).toBeUndefined()
    expect(JSON.stringify(result.content)).toContain('total_requests')
  })
})
