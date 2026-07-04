import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegistryApi } from '../client'
import { registerAppTools } from './apps'
import { registerSystemTools } from './system'
import { registerTaxonomyTools } from './taxonomy'
import { registerTelemetryTools } from './telemetry'

/** Register the full read-only tool surface on the MCP server. */
export function registerTools(server: McpServer, client: RegistryApi): void {
  registerSystemTools(server, client)
  registerAppTools(server, client)
  registerTaxonomyTools(server, client)
  registerTelemetryTools(server, client)
}
