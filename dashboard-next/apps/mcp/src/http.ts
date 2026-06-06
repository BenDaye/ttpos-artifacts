import type { RegistryApi } from './client'
import type { HttpConfig, RegistryConfig } from './config'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createServer } from './server'

/**
 * Minimal local typing for the Bun runtime global. We only use `serve`, so we
 * avoid pulling `bun-types` (which would clash with `@types/node` globals).
 */
interface BunServer {
  stop: (closeActiveConnections?: boolean) => void
  /** Override the idle timeout (seconds) for a specific in-flight request. */
  timeout: (request: Request, seconds: number) => void
  port: number
  hostname: string
}
interface BunServeOptions {
  hostname?: string
  port?: number
  fetch: (request: Request, server: BunServer) => Response | Promise<Response>
  error?: (error: Error) => Response | Promise<Response>
}
declare const Bun: { serve: (options: BunServeOptions) => BunServer }

const MCP_PATH = '/mcp'
const HEALTH_PATH = '/healthz'

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * DNS-rebinding defense: a browser always sends `Origin`, so any request whose
 * Origin is not explicitly allowed is rejected. Requests without an Origin
 * (non-browser MCP clients) pass. Host is checked only when an allowlist is set.
 */
export function isOriginAllowed(headers: Headers, allowedOrigins: string[], allowedHosts: string[]): boolean {
  const origin = headers.get('origin')
  if (origin !== null && !allowedOrigins.includes(origin)) {
    return false
  }
  if (allowedHosts.length > 0) {
    const host = headers.get('host')
    if (host === null || !allowedHosts.includes(host)) {
      return false
    }
  }
  return true
}

/** Validate the client bearer token against the configured one (constant time). */
export function isBearerValid(headers: Headers, token: string): boolean {
  const header = headers.get('authorization')
  if (header === null) {
    return false
  }
  return constantTimeEquals(header, `Bearer ${token}`)
}

/**
 * Handle one authenticated MCP request. Stateless mode requires a FRESH server +
 * transport per request — the SDK throws if a stateless transport is reused
 * (it would cause JSON-RPC id collisions across clients). Registering the 9
 * read-only tools per request is cheap; the transport self-closes when its
 * response stream completes.
 */
async function handleMcpRequest(req: Request, client: RegistryApi): Promise<Response> {
  const server = createServer(client)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return transport.handleRequest(req)
}

/**
 * Start the Streamable HTTP transport via Bun.serve.
 * Order per request: /healthz → origin/host check → path → bearer → MCP.
 */
export function startHttpServer(config: RegistryConfig, client: RegistryApi): BunServer {
  const http: HttpConfig = config.http!
  // Keep streaming responses alive past Bun's 10s default idle timeout: a slow
  // upstream call may emit no SSE bytes for up to the client timeout window.
  const streamTimeoutSeconds = Math.ceil(config.timeoutMs / 1000) + 15

  const instance = Bun.serve({
    hostname: http.host,
    port: http.port,
    fetch: async (req, server) => {
      const url = new URL(req.url)

      if (req.method === 'GET' && url.pathname === HEALTH_PATH) {
        return Response.json({ status: 'ok' })
      }

      if (!isOriginAllowed(req.headers, http.allowedOrigins, http.allowedHosts)) {
        return new Response('forbidden', { status: 403 })
      }

      if (url.pathname !== MCP_PATH) {
        return new Response('not found', { status: 404 })
      }

      if (!isBearerValid(req.headers, http.authToken)) {
        return new Response('unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        })
      }

      server.timeout(req, streamTimeoutSeconds)
      return handleMcpRequest(req, client)
    },
    error: (error) => {
      console.error('[release-registry] http server error:', error.message)
      return new Response('internal server error', { status: 500 })
    },
  })

  console.error(`[release-registry] MCP server (Streamable HTTP) on http://${http.host}:${http.port}${MCP_PATH} (auth mode: ${config.authMode})`)
  return instance
}
