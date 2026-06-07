# @ttpos/mcp — Release Registry MCP Server

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the
release registry REST API. It lets MCP-capable agents (Claude Desktop, Claude Code, etc.)
query applications, versions, channels, platforms, architectures and telemetry through
standard tool calls over **stdio** (local) or **Streamable HTTP** (remote, the modern SSE
successor — server→client messages stream over SSE).

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

## Transports

`MCP_TRANSPORT` selects the transport (default `stdio`):

| Var                   | Default     | Notes                                                                                      |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `MCP_TRANSPORT`       | `stdio`     | `stdio` (local spawn) or `http` (Streamable HTTP)                                          |
| `MCP_HTTP_HOST`       | `127.0.0.1` | bind address (http mode)                                                                   |
| `MCP_HTTP_PORT`       | `3010`      | listen port (http mode)                                                                    |
| `MCP_HTTP_AUTH_TOKEN` | —           | **required in http mode**; clients must send `Authorization: Bearer <value>`               |
| `MCP_ALLOWED_HOSTS`   | _(empty)_   | comma list; when set, the `Host` header must match                                         |
| `MCP_ALLOWED_ORIGINS` | _(empty)_   | comma list; any request carrying a non-listed `Origin` is rejected (DNS-rebinding defense) |

The HTTP server exposes `POST/GET /mcp` (MCP, bearer-protected) and `GET /healthz` (liveness, unauthenticated).
Note the two distinct credentials: `MCP_HTTP_AUTH_TOKEN` authenticates _clients → this server_, while
`API_TOKEN` authenticates _this server → the registry API_.

## Run

stdio (local):

```bash
bun install
API_BASE_URL=https://registry.example.com API_TOKEN=… bun run apps/mcp/src/index.ts
```

Streamable HTTP (remote):

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3010 MCP_HTTP_AUTH_TOKEN=$(openssl rand -hex 32) \
API_BASE_URL=https://registry.example.com API_TOKEN=… \
bun run apps/mcp/src/index.ts
```

## Connect from an MCP client

stdio — `claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "release-registry": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/dashboard-next/apps/mcp/src/index.ts"],
      "env": { "API_BASE_URL": "https://registry.example.com", "API_TOKEN": "your-token" }
    }
  }
}
```

Streamable HTTP — point the client at the URL and send the bearer:

```jsonc
{
  "mcpServers": {
    "release-registry": {
      "url": "https://registry.example.com/mcp",
      "headers": { "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>" }
    }
  }
}
```

Diagnostics are written to stderr; stdout is reserved for the (stdio) MCP protocol.

## Deploy (Docker / Compose / Caddy)

The HTTP form ships as a container (`apps/mcp/Dockerfile`, image `faynosync-mcp`, built by
`.github/workflows/build-mcp.yaml` on a `mcp-v*` tag). `deploy/docker-compose.yml` defines the
`mcp` service (talks to the API over the internal network at `http://api:9000`), and
`deploy/Caddyfile` exposes it under the existing API domain at `/mcp`
(`handle /mcp*` → `faynosync-mcp:3010`, buffering disabled for SSE) — no extra subdomain.
Set `MCP_HTTP_AUTH_TOKEN` and `API_TOKEN` in the host `.env` (see [`deploy/.env.example`](../../../deploy/.env.example)).

## Develop

```bash
bun run --filter @ttpos/mcp typecheck
bun run --filter @ttpos/mcp test
```
