import type { RegistryConfig } from './config'

export type QueryValue = string | number | boolean | string[] | undefined | null

export interface QueryParams {
  [key: string]: QueryValue
}

export interface RequestOptions {
  query?: QueryParams
  /** Attach the bearer token (for endpoints behind the auth middleware). */
  auth?: boolean
}

/** Minimal fetch shape so tests can inject a stub without the DOM lib. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

/** Read-only surface consumed by the tool modules; eases stubbing in tests. */
export interface RegistryApi {
  get: (path: string, options?: RequestOptions) => Promise<unknown>
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      return await response.json()
    }
    catch {
      return null
    }
  }
  const text = await response.text()
  return text === '' ? null : text
}

function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error: unknown }).error
    if (typeof error === 'string' && error !== '') {
      return error
    }
  }
  if (typeof data === 'string' && data !== '') {
    return data
  }
  return fallback
}

/**
 * Thin HTTP client for the release registry REST API. Handles query building,
 * bearer auth (static token or login + cached JWT with one-shot 401 refresh),
 * and normalizes errors into {@link ApiError}. Redirects are surfaced as data
 * instead of being followed, so `latest_version` never downloads a binary.
 */
export class RegistryClient implements RegistryApi {
  private cachedToken: string | undefined

  constructor(
    private readonly config: RegistryConfig,
    private readonly fetchFn: FetchLike = fetch,
  ) {
    this.cachedToken = config.token
  }

  async get(path: string, options: RequestOptions = {}): Promise<unknown> {
    return this.request('GET', path, options)
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const base = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    if (!query) {
      return base
    }
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue
      }
      const serialized = Array.isArray(value) ? value.join(',') : String(value)
      if (serialized !== '') {
        search.set(key, serialized)
      }
    }
    const qs = search.toString()
    return qs === '' ? base : `${base}?${qs}`
  }

  private async ensureToken(): Promise<string | undefined> {
    if (this.config.authMode === 'token') {
      return this.config.token
    }
    if (this.config.authMode === 'login') {
      this.cachedToken ??= await this.login()
      return this.cachedToken
    }
    return undefined
  }

  private async login(): Promise<string> {
    const response = await this.fetchFn(this.buildUrl('/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.config.username, password: this.config.password }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    const data = await parseBody(response)
    if (!response.ok) {
      throw new ApiError(response.status, extractError(data, 'Login failed'), data)
    }
    const token = (data as { token?: unknown } | null)?.token
    if (typeof token !== 'string' || token === '') {
      throw new ApiError(response.status, 'Login response did not contain a token', data)
    }
    return token
  }

  private async request(
    method: string,
    path: string,
    options: RequestOptions,
    isRetry = false,
  ): Promise<unknown> {
    const headers: Record<string, string> = {}
    if (options.auth) {
      const token = await this.ensureToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    }

    const response = await this.fetchFn(this.buildUrl(path, options.query), {
      method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })

    // Manual redirect: report the Location target instead of downloading it.
    if (response.status >= 300 && response.status < 400) {
      return { redirect: response.headers.get('location'), status: response.status }
    }

    // Expired/invalid cached JWT: drop it and retry login exactly once.
    if (response.status === 401 && options.auth && this.config.authMode === 'login' && !isRetry) {
      this.cachedToken = undefined
      return this.request(method, path, options, true)
    }

    const data = await parseBody(response)
    if (!response.ok) {
      const detail = extractError(data, `Request failed with status ${response.status}`)
      // Don't relay upstream 5xx bodies to the agent — they may carry internal
      // detail. Keep the detail on stderr and return a generic message.
      if (response.status >= 500) {
        console.error(`[release-registry] upstream ${response.status} for ${method} ${path}: ${detail}`)
        throw new ApiError(response.status, `Upstream error (status ${response.status})`)
      }
      throw new ApiError(response.status, detail, data)
    }
    return data
  }
}
