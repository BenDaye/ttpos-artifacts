# Release Registry MCP server — Streamable HTTP transport, run by Bun.
# Build context is the repository root (../../ from this file).

# ---- Stage 1: Prune ----
# turbo prune 生成只含 @ttpos/mcp 及其依赖的剪枝目录（json = manifest 子集 +
# 剪枝 bun.lock，full = 源码子集）。新增 workspace 成员自动纳入，
# 无需再维护逐成员 COPY 清单（ENH-018）。
FROM oven/bun:1.3.13-alpine AS pruner

WORKDIR /workspace

COPY . .
RUN bunx turbo@2.10.3 prune @ttpos/mcp --docker

# ---- Stage 2: Runtime ----
FROM oven/bun:1.3.13-alpine

WORKDIR /app

# Install deps (cache layer)——manifest 未变时该层缓存命中
COPY --from=pruner /workspace/out/json/ .
RUN bun install --frozen-lockfile --production

# MCP source (runtime imports only the SDK + zod + node builtins).
COPY --from=pruner /workspace/out/full/ .

ENV NODE_ENV=production
# HTTP transport defaults; host/port/token/allowlists are injected at runtime.
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3010

EXPOSE 3010
USER bun
CMD ["bun", "run", "apps/mcp/src/index.ts"]
