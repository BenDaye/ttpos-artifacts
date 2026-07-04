import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegistryApi } from '../client'
import { guard } from './define'

export function fetchHealth(client: RegistryApi): Promise<unknown> {
  return client.get('/health', { auth: false })
}

export function fetchWhoami(client: RegistryApi): Promise<unknown> {
  return client.get('/whoami', { auth: true })
}

export function registerSystemTools(server: McpServer, client: RegistryApi): void {
  server.registerTool('health_check', {
    title: 'Health check',
    description: 'Check server health (database/cache connectivity). Public endpoint.',
  }, async () => guard(() => fetchHealth(client)))

  server.registerTool('whoami', {
    title: 'Who am I',
    description: 'Return the current authenticated user and permissions. Useful to verify credentials.',
  }, async () => guard(() => fetchWhoami(client)))
}
