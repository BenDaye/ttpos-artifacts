import type { FetchLike } from '../client'
import type { AuthMode, RegistryConfig } from '../config'
import { describe, expect, it } from 'vitest'
import { ApiError, RegistryClient } from '../client'

function makeConfig(authMode: AuthMode, token?: string): RegistryConfig {
  return {
    baseUrl: 'https://api.example.com',
    token,
    username: 'user',
    password: 'pass',
    timeoutMs: 1000,
    authMode,
  }
}

interface ResponseInit {
  status?: number
  contentType?: string | null
  location?: string
}

function makeResponse(body: unknown, init: ResponseInit = {}): Response {
  const { status = 200, contentType = 'application/json', location } = init
  const headers = new Headers()
  if (contentType) {
    headers.set('content-type', contentType)
  }
  if (location) {
    headers.set('location', location)
  }
  const payload = body === null ? null : typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(payload, { status, headers })
}

describe('registryClient.buildUrl', () => {
  it('serializes query values and joins arrays with commas', async () => {
    let captured = ''
    const fetchFn: FetchLike = async (url) => {
      captured = String(url)
      return makeResponse({ ok: true })
    }
    const client = new RegistryClient(makeConfig('none'), fetchFn)
    await client.get('/app/list', {
      query: { page: 2, limit: 10, flag: true, list: ['a', 'b'], skip: undefined, empty: '' },
    })
    expect(captured).toContain('https://api.example.com/app/list?')
    expect(captured).toContain('page=2')
    expect(captured).toContain('limit=10')
    expect(captured).toContain('flag=true')
    expect(captured).toContain('list=a%2Cb')
    expect(captured).not.toContain('skip')
    expect(captured).not.toContain('empty')
  })
})

describe('registryClient auth', () => {
  it('attaches a static bearer token when auth is requested', async () => {
    let authHeader: string | null = null
    const fetchFn: FetchLike = async (_url, init) => {
      authHeader = new Headers(init?.headers).get('authorization')
      return makeResponse({ ok: true })
    }
    const client = new RegistryClient(makeConfig('token', 'tok-123'), fetchFn)
    await client.get('/whoami', { auth: true })
    expect(authHeader).toBe('Bearer tok-123')
  })

  it('does not attach a token when auth is not requested', async () => {
    let authHeader: string | null = 'unset'
    const fetchFn: FetchLike = async (_url, init) => {
      authHeader = new Headers(init?.headers).get('authorization')
      return makeResponse({ status: 'healthy' })
    }
    const client = new RegistryClient(makeConfig('token', 'tok-123'), fetchFn)
    await client.get('/health', { auth: false })
    expect(authHeader).toBeNull()
  })

  it('logs in once, caches the JWT, and sends it on the data request', async () => {
    const calls: string[] = []
    let dataAuthHeader: string | null = null
    const fetchFn: FetchLike = async (url, init) => {
      const target = String(url)
      calls.push(target)
      if (target.endsWith('/login')) {
        return makeResponse({ token: 'jwt-1' })
      }
      dataAuthHeader = new Headers(init?.headers).get('authorization')
      return makeResponse({ ok: true })
    }
    const client = new RegistryClient(makeConfig('login'), fetchFn)
    await client.get('/app/list', { auth: true })
    await client.get('/channel/list', { auth: true })
    expect(calls[0]).toContain('/login')
    expect(calls[1]).toContain('/app/list')
    expect(calls[2]).toContain('/channel/list')
    expect(calls.filter(c => c.endsWith('/login'))).toHaveLength(1)
    expect(dataAuthHeader).toBe('Bearer jwt-1')
  })

  it('refreshes the token once after a 401', async () => {
    let loginCalls = 0
    let dataCalls = 0
    const fetchFn: FetchLike = async (url) => {
      const target = String(url)
      if (target.endsWith('/login')) {
        loginCalls += 1
        return makeResponse({ token: `jwt-${loginCalls}` })
      }
      dataCalls += 1
      if (dataCalls === 1) {
        return makeResponse({ error: 'unauthorized' }, { status: 401 })
      }
      return makeResponse({ ok: true })
    }
    const client = new RegistryClient(makeConfig('login'), fetchFn)
    const result = await client.get('/whoami', { auth: true })
    expect(loginCalls).toBe(2)
    expect(dataCalls).toBe(2)
    expect(result).toEqual({ ok: true })
  })

  it('does not attempt a login refresh on a 401 in token mode', async () => {
    let loginCalls = 0
    let dataCalls = 0
    const fetchFn: FetchLike = async (url) => {
      if (String(url).endsWith('/login')) {
        loginCalls += 1
        return makeResponse({ token: 'should-not-happen' })
      }
      dataCalls += 1
      return makeResponse({ error: 'unauthorized' }, { status: 401 })
    }
    const client = new RegistryClient(makeConfig('token', 'tok-123'), fetchFn)
    await expect(client.get('/whoami', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(loginCalls).toBe(0)
    expect(dataCalls).toBe(1)
  })

  it('stops after one refresh when 401 persists in login mode', async () => {
    let loginCalls = 0
    let dataCalls = 0
    const fetchFn: FetchLike = async (url) => {
      if (String(url).endsWith('/login')) {
        loginCalls += 1
        return makeResponse({ token: `jwt-${loginCalls}` })
      }
      dataCalls += 1
      return makeResponse({ error: 'unauthorized' }, { status: 401 })
    }
    const client = new RegistryClient(makeConfig('login'), fetchFn)
    await expect(client.get('/whoami', { auth: true })).rejects.toBeInstanceOf(ApiError)
    expect(loginCalls).toBe(2)
    expect(dataCalls).toBe(2)
  })
})

describe('registryClient responses', () => {
  it('throws an ApiError carrying the server error message for 4xx', async () => {
    const fetchFn: FetchLike = async () => makeResponse({ error: 'boom' }, { status: 404 })
    const client = new RegistryClient(makeConfig('none'), fetchFn)
    await expect(client.get('/app/list', { auth: false })).rejects.toBeInstanceOf(ApiError)
    await expect(client.get('/app/list', { auth: false })).rejects.toThrow('boom')
  })

  it('generalizes 5xx errors instead of relaying the upstream body', async () => {
    const fetchFn: FetchLike = async () => makeResponse({ error: 'internal stack trace detail' }, { status: 500 })
    const client = new RegistryClient(makeConfig('none'), fetchFn)
    await expect(client.get('/app/list', { auth: false })).rejects.toThrow('Upstream error (status 500)')
    await expect(client.get('/app/list', { auth: false })).rejects.not.toThrow('stack trace')
  })

  it('surfaces a redirect target instead of following it', async () => {
    const fetchFn: FetchLike = async () =>
      makeResponse(null, { status: 302, contentType: null, location: 'https://downloads.example.com/file' })
    const client = new RegistryClient(makeConfig('none'), fetchFn)
    const result = await client.get('/apps/latest', { query: { app_name: 'a', channel: 'stable' }, auth: false })
    expect(result).toEqual({ redirect: 'https://downloads.example.com/file', status: 302 })
  })
})
