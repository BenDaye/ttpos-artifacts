import type { RegistryConfig } from './config'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RegistryClient } from './client'
import { parseConfig } from './config'
import { registerTools } from './tools/register'

const SERVER_NAME = 'release-registry'
const SERVER_VERSION = '0.1.0'

async function main(): Promise<void> {
  let config: RegistryConfig
  try {
    config = parseConfig()
  }
  catch (error) {
    // stdout is the protocol channel; diagnostics must go to stderr.
    console.error('[release-registry] invalid configuration:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  const client = new RegistryClient(config)
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })
  registerTools(server, client)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[release-registry] MCP server running on stdio (auth mode: ${config.authMode})`)
}

main().catch((error) => {
  console.error('[release-registry] fatal error:', error)
  process.exit(1)
})
