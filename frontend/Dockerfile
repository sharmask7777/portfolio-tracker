# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable || npm install -g pnpm@12
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core-view/package.json ./packages/core-view/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter frontend...
COPY packages/core-view ./packages/core-view
RUN pnpm --filter @portfolio/core-view build
COPY frontend ./frontend
RUN pnpm --filter frontend build

# Stage 2: Production Runtime
FROM nginx:stable-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
