import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegistryApi } from '../client'
import { z } from 'zod'
import { guard } from './define'

export interface AppListArgs {
  page?: number
  limit?: number
}

export interface SearchArgs {
  app_name: string
  channel?: string
  platform?: string
  arch?: string
  published?: boolean
  critical?: boolean
  page?: number
  limit?: number
}

export interface LatestArgs {
  app_name: string
  channel: string
  platform?: string
  arch?: string
  package?: string
  owner?: string
}

export function fetchAppList(client: RegistryApi, args: AppListArgs): Promise<unknown> {
  return client.get('/app/list', { query: { page: args.page, limit: args.limit }, auth: true })
}

export function fetchVersionSearch(client: RegistryApi, args: SearchArgs): Promise<unknown> {
  return client.get('/search', { query: { ...args }, auth: true })
}

export function fetchLatestVersion(client: RegistryApi, args: LatestArgs): Promise<unknown> {
  return client.get('/apps/latest', { query: { ...args }, auth: false })
}

export function registerAppTools(server: McpServer, client: RegistryApi): void {
  server.registerTool('list_apps', {
    title: 'List applications',
    description: 'List registered applications with optional pagination (page, limit).',
    inputSchema: {
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().optional(),
    },
  }, async args => guard(() => fetchAppList(client, args)))

  server.registerTool('search_versions', {
    title: 'Search application versions',
    description: 'Search versions of an application by name, with optional channel, platform, arch, published and critical filters.',
    inputSchema: {
      app_name: z.string().min(1),
      channel: z.string().optional(),
      platform: z.string().optional(),
      arch: z.string().optional(),
      published: z.boolean().optional(),
      critical: z.boolean().optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().optional(),
    },
  }, async args => guard(() => fetchVersionSearch(client, args)))

  server.registerTool('latest_version', {
    title: 'Latest application version',
    description: 'Fetch the latest published version of an application on a channel (public endpoint). Returns download targets or a redirect location.',
    inputSchema: {
      app_name: z.string().min(1),
      channel: z.string().min(1),
      platform: z.string().optional(),
      arch: z.string().optional(),
      package: z.string().optional(),
      owner: z.string().optional(),
    },
  }, async args => guard(() => fetchLatestVersion(client, args)))
}
