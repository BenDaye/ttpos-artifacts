import type { RegistryApi } from './client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from './tools/register'

export const SERVER_NAME = 'release-registry'
export const SERVER_VERSION = '0.1.0'

/** Build an MCP server instance with the full read-only tool surface registered. */
export function createServer(client: RegistryApi): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
  registerTools(server, client)
  return server
}
