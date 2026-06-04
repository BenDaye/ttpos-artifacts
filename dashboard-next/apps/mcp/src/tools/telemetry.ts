import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { RegistryApi } from '../client'
import { z } from 'zod'
import { ApiError } from '../client'
import { toErrorResult, toTextResult } from './define'

export interface TelemetryArgs {
  apps?: string[]
  channels?: string[]
  platforms?: string[]
  architectures?: string[]
  range?: 'today' | 'week' | 'month'
  date?: string
}

export function fetchTelemetry(client: RegistryApi, args: TelemetryArgs): Promise<unknown> {
  return client.get('/telemetry', {
    query: {
      apps: args.apps,
      channels: args.channels,
      platforms: args.platforms,
      architectures: args.architectures,
      range: args.range,
      date: args.date,
    },
    auth: true,
  })
}

/**
 * Aggregate telemetry, mapping the "telemetry disabled" 403 into a clear
 * message so the model does not treat it as a transient failure.
 */
export async function telemetryResult(client: RegistryApi, args: TelemetryArgs): Promise<CallToolResult> {
  try {
    return toTextResult(await fetchTelemetry(client, args))
  }
  catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return toErrorResult(new Error('Telemetry is not enabled on this server instance.'))
    }
    return toErrorResult(error)
  }
}

export function registerTelemetryTools(server: McpServer, client: RegistryApi): void {
  server.registerTool('get_telemetry', {
    title: 'Get telemetry',
    description: 'Aggregate client telemetry. Optional filters: apps, channels, platforms, architectures, range (today/week/month) and date (YYYY-MM-DD). Requires telemetry to be enabled on the instance.',
    inputSchema: {
      apps: z.array(z.string()).optional(),
      channels: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
      architectures: z.array(z.string()).optional(),
      range: z.enum(['today', 'week', 'month']).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format').optional(),
    },
  }, async args => telemetryResult(client, args))
}
