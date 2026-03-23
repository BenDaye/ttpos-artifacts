# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Corepack honors package.json "packageManager" (e.g. yarn@4.5.1)
RUN corepack enable

# Install dependencies first (cache layer)
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

# Copy source and build
COPY . .

# Use a placeholder for API_URL so it can be replaced at runtime
ENV VITE_API_URL=__VITE_API_URL_PLACEHOLDER__
RUN yarn build

# ---- Stage 2: Serve ----
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
