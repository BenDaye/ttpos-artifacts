# ---- Stage 1: Build ----
FROM oven/bun:1.3.13-alpine AS builder

WORKDIR /workspace

# Install deps (cache layer)
COPY package.json bun.lock ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# Copy source and build
COPY tsconfig.json eslint.config.js ./
COPY packages packages
COPY apps apps

# Build-time placeholder — replaced at container start by docker-entrypoint.sh
ENV VITE_API_URL=__VITE_API_URL_PLACEHOLDER__
RUN bun run --filter @ttpos/web build

# ---- Stage 2: Serve ----
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
