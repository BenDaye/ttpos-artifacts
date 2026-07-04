import type { RegistryConfig } from './config'
import process from 'node:process'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RegistryClient } from './client'
import { parseConfig } from './config'
import { startHttpServer } from './http'
import { createServer } from './server'

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

  if (config.transport === 'http') {
    startHttpServer(config, client)
    return
  }

  const server = createServer(client)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[release-registry] MCP server running on stdio (auth mode: ${config.authMode})`)
}

main().catch((error) => {
  console.error('[release-registry] fatal error:', error)
  process.exit(1)
})
