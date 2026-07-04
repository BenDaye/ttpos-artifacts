# ---- Stage 1: Build ----
FROM oven/bun:1.3.13-alpine AS builder

WORKDIR /workspace

# Install deps (cache layer)
COPY package.json bun.lock ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
# 工作区新增成员的 manifest 必须齐全，否则 --frozen-lockfile 因 workspace 缺失而失败
COPY apps/mcp/package.json apps/mcp/
COPY apps/server/package.json apps/server/
RUN bun install --frozen-lockfile

# Copy source and build
COPY tsconfig.json eslint.config.js ./
COPY packages packages
COPY apps apps

# Build-time placeholder — replaced at container start by docker-entrypoint.sh
ENV VITE_API_URL=__VITE_API_URL_PLACEHOLDER__

# 版本元数据：.git 不在构建上下文、镜像也无 git，故 git short hash 由 CI 经 build-arg 注入；
# APP_VERSION 由 vite 读 apps/web/package.json，BUILD_TIME 在容器内构建时生成。
# 放在 install 层之后，避免每次构建都使依赖缓存层失效。
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
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
