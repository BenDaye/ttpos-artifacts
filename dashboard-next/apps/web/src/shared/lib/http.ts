import { STORAGE_KEYS } from '@ttpos/shared'
import { env } from './env'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

type JsonBody = Record<string, unknown> | unknown[] | object

interface HttpRequestInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit | JsonBody | null
  query?: Record<string, string | number | boolean | undefined | null>
  skipAuth?: boolean
}

function buildUrl(path: string, query?: HttpRequestInit['query']): string {
  const base = env.API_URL || ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${normalized}`
  if (!query) {
    return url
  }
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${url}?${qs}` : url
}

function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN)
  }
  catch {
    return null
  }
}

function clearTokenAndRedirect() {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
  }
  catch {
    /* swallow */
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/signin')) {
    window.location.href = '/signin'
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (response.status === 204) {
    return null
  }
  if (contentType.includes('application/json')) {
    return response.json()
  }
  const text = await response.text()
  return text || null
}

export async function request<T>(path: string, init: HttpRequestInit = {}): Promise<T> {
  const { body, query, skipAuth, headers: extraHeaders, ...rest } = init
  const headers = new Headers(extraHeaders)

  let payload: BodyInit | undefined
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
      payload = body
    }
    else {
      payload = JSON.stringify(body)
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    }
  }

  if (!skipAuth) {
    const token = getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers,
    body: payload,
  })

  if (response.status === 401) {
    clearTokenAndRedirect()
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    let message = response.statusText || `Request failed with status ${response.status}`
    if (data && typeof data === 'object' && 'error' in data) {
      const errVal = (data as { error: unknown }).error
      if (typeof errVal === 'string') {
        message = errVal
      }
    }
    throw new HttpError(response.status, response.statusText, message, data)
  }

  return data as T
}

export const http = {
  get<T>(path: string, init?: Omit<HttpRequestInit, 'method' | 'body'>) {
    return request<T>(path, { ...init, method: 'GET' })
  },
  post<T>(path: string, body?: HttpRequestInit['body'], init?: Omit<HttpRequestInit, 'method' | 'body'>) {
    return request<T>(path, { ...init, method: 'POST', body })
  },
  put<T>(path: string, body?: HttpRequestInit['body'], init?: Omit<HttpRequestInit, 'method' | 'body'>) {
    return request<T>(path, { ...init, method: 'PUT', body })
  },
  patch<T>(path: string, body?: HttpRequestInit['body'], init?: Omit<HttpRequestInit, 'method' | 'body'>) {
    return request<T>(path, { ...init, method: 'PATCH', body })
  },
  delete<T>(path: string, init?: Omit<HttpRequestInit, 'method' | 'body'>) {
    return request<T>(path, { ...init, method: 'DELETE' })
  },
}
