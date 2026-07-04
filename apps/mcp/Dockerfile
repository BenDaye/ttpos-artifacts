# Release Registry MCP server — Streamable HTTP transport, run by Bun.
# Build context is the repository root (../../ from this file).
FROM oven/bun:1.3.13-alpine

WORKDIR /app

# Workspace manifests for all members so --frozen-lockfile matches the lockfile.
COPY package.json bun.lock ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile --production

# MCP source (runtime imports only the SDK + zod + node builtins).
COPY apps/mcp/tsconfig.json apps/mcp/
COPY apps/mcp/src apps/mcp/src

ENV NODE_ENV=production
# HTTP transport defaults; host/port/token/allowlists are injected at runtime.
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3010

EXPOSE 3010
USER bun
CMD ["bun", "run", "apps/mcp/src/index.ts"]
