# ---- Stage 1: Prune ----
# turbo prune 生成只含 @ttpos/web 及其依赖的剪枝目录：
# out/json = 所需 manifest 子集 + 剪枝 bun.lock，out/full = 源码子集。
# 新增 workspace 成员自动纳入，无需再维护逐成员 COPY 清单（ENH-018）。
FROM oven/bun:1.3.13-alpine AS pruner

WORKDIR /workspace

COPY . .
RUN bunx turbo@2.10.3 prune @ttpos/web --docker

# ---- Stage 2: Build ----
FROM oven/bun:1.3.13-alpine AS builder

WORKDIR /workspace

# Install deps (cache layer)——manifest 未变时该层缓存命中
COPY --from=pruner /workspace/out/json/ .
RUN bun install --frozen-lockfile

# Copy pruned source and build（根 tsconfig/eslint.config 不参与构建，extends 链走 @ttpos/config 包）
COPY --from=pruner /workspace/out/full/ .

# Build-time placeholder — replaced at container start by docker-entrypoint.sh
ENV VITE_API_URL=__VITE_API_URL_PLACEHOLDER__

# 版本元数据：.git 不在构建上下文、镜像也无 git，故 git short hash 由 CI 经 build-arg 注入；
# APP_VERSION 由 vite 读 apps/web/package.json，BUILD_TIME 在容器内构建时生成。
# 放在 install 层之后，避免每次构建都使依赖缓存层失效。
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
RUN bun run --filter @ttpos/web build

# ---- Stage 3: Serve ----
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
