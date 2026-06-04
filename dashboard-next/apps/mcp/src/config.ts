import process from 'node:process'
import { z } from 'zod'

const EnvSchema = z.object({
  API_BASE_URL: z.url(),
  API_TOKEN: z.string().trim().min(1).optional(),
  API_USERNAME: z.string().trim().min(1).optional(),
  API_PASSWORD: z.string().min(1).optional(),
  API_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
})

export type AuthMode = 'token' | 'login' | 'none'

export interface RegistryConfig {
  baseUrl: string
  token?: string
  username?: string
  password?: string
  timeoutMs: number
  authMode: AuthMode
}

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Read and validate the server configuration from environment variables.
 * `API_TOKEN` takes precedence over username/password. With neither, only the
 * public tools (health_check / latest_version) are usable.
 */
export function parseConfig(env: NodeJS.ProcessEnv = process.env): RegistryConfig {
  const parsed = EnvSchema.parse({
    API_BASE_URL: env.API_BASE_URL,
    API_TOKEN: env.API_TOKEN,
    API_USERNAME: env.API_USERNAME,
    API_PASSWORD: env.API_PASSWORD,
    API_TIMEOUT_MS: env.API_TIMEOUT_MS,
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

  return {
    baseUrl: parsed.API_BASE_URL.replace(/\/+$/, ''),
    token: parsed.API_TOKEN,
    username: parsed.API_USERNAME,
    password: parsed.API_PASSWORD,
    timeoutMs: parsed.API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    authMode,
  }
}
