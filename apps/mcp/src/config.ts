import process from 'node:process'
import { z } from 'zod'

const EnvSchema = z.object({
  API_BASE_URL: z.url(),
  API_TOKEN: z.string().trim().min(1).optional(),
  API_USERNAME: z.string().trim().min(1).optional(),
  // intentionally no .trim() — passwords may contain leading/trailing spaces
  API_PASSWORD: z.string().min(1).optional(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).optional(),
  MCP_HTTP_HOST: z.string().optional(),
  MCP_HTTP_PORT: z.coerce.number().int().positive().optional(),
  MCP_HTTP_AUTH_TOKEN: z.string().min(1).optional(),
  MCP_ALLOWED_HOSTS: z.string().optional(),
  MCP_ALLOWED_ORIGINS: z.string().optional(),
})

export type AuthMode = 'token' | 'login' | 'none'
export type TransportMode = 'stdio' | 'http'

/** HTTP (Streamable HTTP) transport config; present only when transport === 'http'. */
export interface HttpConfig {
  host: string
  port: number
  /** Bearer token clients must present on the MCP endpoint (mandatory in http mode). */
  authToken: string
  /** Allowed `Host` header values; empty disables host checking. */
  allowedHosts: string[]
  /** Allowed `Origin` header values; a request carrying any other Origin is rejected. */
  allowedOrigins: string[]
}

export interface RegistryConfig {
  baseUrl: string
  token?: string
  username?: string
  password?: string
  timeoutMs: number
  authMode: AuthMode
  transport: TransportMode
  http?: HttpConfig
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_HTTP_HOST = '127.0.0.1'
const DEFAULT_HTTP_PORT = 3010

/**
 * Treat empty / whitespace-only env vars as absent. Real-world `.env` files and
 * MCP client `env` blocks routinely carry blank values (e.g. `API_TOKEN=`); a
 * blank optional var must mean "not set", not a fatal validation error.
 */
function presentOrUndefined(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value : undefined
}

/** Parse a comma-separated env list into a trimmed, non-empty array. */
function parseList(value: string | undefined): string[] {
  const present = presentOrUndefined(value)
  if (!present) {
    return []
  }
  return present.split(',').map(item => item.trim()).filter(item => item !== '')
}

/**
 * Read and validate the server configuration from environment variables.
 * `API_TOKEN` takes precedence over username/password. With neither, only the
 * public tools (health_check / latest_version) are usable. `MCP_TRANSPORT`
 * selects stdio (default) or http (Streamable HTTP).
 */
export function parseConfig(env: NodeJS.ProcessEnv = process.env): RegistryConfig {
  const parsed = EnvSchema.parse({
    API_BASE_URL: env.API_BASE_URL,
    API_TOKEN: presentOrUndefined(env.API_TOKEN),
    API_USERNAME: presentOrUndefined(env.API_USERNAME),
    API_PASSWORD: presentOrUndefined(env.API_PASSWORD),
    API_TIMEOUT_MS: presentOrUndefined(env.API_TIMEOUT_MS),
    MCP_TRANSPORT: presentOrUndefined(env.MCP_TRANSPORT),
    MCP_HTTP_HOST: presentOrUndefined(env.MCP_HTTP_HOST),
    MCP_HTTP_PORT: presentOrUndefined(env.MCP_HTTP_PORT),
    MCP_HTTP_AUTH_TOKEN: presentOrUndefined(env.MCP_HTTP_AUTH_TOKEN),
    MCP_ALLOWED_HOSTS: presentOrUndefined(env.MCP_ALLOWED_HOSTS),
    MCP_ALLOWED_ORIGINS: presentOrUndefined(env.MCP_ALLOWED_ORIGINS),
  })

  let authMode: AuthMode = 'none'
  if (parsed.API_TOKEN) {
    authMode = 'token'
  }
  else if (parsed.API_USERNAME && parsed.API_PASSWORD) {
    authMode = 'login'
  }
  else if (Boolean(parsed.API_USERNAME) !== Boolean(parsed.API_PASSWORD)) {
    // Only half the login credentials were provided — warn (to stderr) instead
    // of silently falling back to unauthenticated mode, which would surface as
    // confusing auth errors on every token-gated tool.
    console.error('[release-registry] API_USERNAME and API_PASSWORD must both be set for login auth; falling back to unauthenticated mode.')
  }

  const transport: TransportMode = parsed.MCP_TRANSPORT ?? 'stdio'

  let http: HttpConfig | undefined
  if (transport === 'http') {
    if (!parsed.MCP_HTTP_AUTH_TOKEN) {
      // The HTTP transport is network-reachable; refuse to start without a
      // client-facing bearer token rather than expose the API token anonymously.
      throw new Error('MCP_HTTP_AUTH_TOKEN is required when MCP_TRANSPORT=http')
    }
    http = {
      host: parsed.MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST,
      port: parsed.MCP_HTTP_PORT ?? DEFAULT_HTTP_PORT,
      authToken: parsed.MCP_HTTP_AUTH_TOKEN,
      allowedHosts: parseList(parsed.MCP_ALLOWED_HOSTS),
      allowedOrigins: parseList(parsed.MCP_ALLOWED_ORIGINS),
    }
  }

  return {
    baseUrl: parsed.API_BASE_URL.replace(/\/+$/, ''),
    token: parsed.API_TOKEN,
    username: parsed.API_USERNAME,
    password: parsed.API_PASSWORD,
    timeoutMs: parsed.API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    authMode,
    transport,
    http,
  }
}
