# @ttpos/mcp — Release Registry MCP Server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the
release registry REST API. It lets MCP-capable agents (Claude Desktop, Claude Code, etc.)
query applications, versions, channels, platforms, architectures and telemetry through
standard tool calls over stdio.

This package is a **thin external wrapper**: it talks to a running registry instance over
HTTP and never embeds or modifies the backend. Only query (read) operations are exposed.

## Tools

| Tool                 | Auth   | Description                                                                                              |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `health_check`       | public | Server health (database/cache connectivity)                                                              |
| `latest_version`     | public | Latest published version of an app on a channel                                                          |
| `list_apps`          | token  | List applications (`page`, `limit`)                                                                      |
| `search_versions`    | token  | Search versions (`app_name` required; `channel`/`platform`/`arch`/`published`/`critical`/`page`/`limit`) |
| `list_channels`      | token  | List channels                                                                                            |
| `list_platforms`     | token  | List platforms and updaters                                                                              |
| `list_architectures` | token  | List architectures                                                                                       |
| `get_telemetry`      | token  | Aggregate telemetry (`apps`/`channels`/`platforms`/`architectures`/`range`/`date`)                       |
| `whoami`             | token  | Current authenticated user and permissions                                                               |

## Configuration

Set environment variables (see [`.env.example`](./.env.example)):

- `API_BASE_URL` (required) — base URL of the registry API, e.g. `https://registry.example.com`.
- `API_TOKEN` — a pre-issued bearer token (JWT). Takes precedence when set.
- `API_USERNAME` + `API_PASSWORD` — used to log in once and cache a JWT, refreshed automatically on `401`.
- `API_TIMEOUT_MS` — optional request timeout in milliseconds (default `15000`).

With no credentials, only the public tools (`health_check`, `latest_version`) work; the
token-gated tools return an authentication error.

> Provision a **least-privilege, read-scoped** token or account. This server only ever
> issues read (GET) calls, but the credential itself carries whatever privileges the
> backend granted it — a read-scoped credential limits the blast radius of a leak.

## Run

From the workspace root:

```bash
bun install
bun run --filter @ttpos/mcp dev      # starts the stdio server
```

Or directly:

```bash
API_BASE_URL=https://registry.example.com API_TOKEN=… bun run apps/mcp/src/index.ts
```

## Connect from an MCP client

Example client configuration (e.g. `claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "release-registry": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/dashboard-next/apps/mcp/src/index.ts"],
      "env": {
        "API_BASE_URL": "https://registry.example.com",
        "API_TOKEN": "your-token"
      }
    }
  }
}
```

Diagnostics are written to stderr; stdout is reserved for the MCP protocol.

## Develop

```bash
bun run --filter @ttpos/mcp typecheck
bun run --filter @ttpos/mcp test
```
