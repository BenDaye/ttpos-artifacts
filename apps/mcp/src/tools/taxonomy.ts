import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegistryApi } from '../client'
import { guard } from './define'

export function fetchChannels(client: RegistryApi): Promise<unknown> {
  return client.get('/channel/list', { auth: true })
}

export function fetchPlatforms(client: RegistryApi): Promise<unknown> {
  return client.get('/platform/list', { auth: true })
}

export function fetchArchitectures(client: RegistryApi): Promise<unknown> {
  return client.get('/arch/list', { auth: true })
}

export function registerTaxonomyTools(server: McpServer, client: RegistryApi): void {
  server.registerTool('list_channels', {
    title: 'List channels',
    description: 'List deployment channels.',
  }, async () => guard(() => fetchChannels(client)))

  server.registerTool('list_platforms', {
    title: 'List platforms',
    description: 'List platforms and their configured updaters.',
  }, async () => guard(() => fetchPlatforms(client)))

  server.registerTool('list_architectures', {
    title: 'List architectures',
    description: 'List architectures.',
  }, async () => guard(() => fetchArchitectures(client)))
}
