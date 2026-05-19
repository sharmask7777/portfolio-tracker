# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN DATABASE_URL="postgresql://postgres:password@postgres:5432/portfolio_tracker?schema=public" npx prisma generate
COPY . .
RUN npm run build

# Stage 2: Production Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
# Remove unused Prisma engines to save space
RUN find node_modules -name "query-engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete && \
    find node_modules -name "libquery_engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete

# Stage 3: Final Runtime
FROM node:20-alpine
WORKDIR /app

# Install python and system dependencies for casparser
# We use Alpine's native py3-cryptography to avoid slow builds and ensure encrypted PDF support
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-cryptography \
    openssl \
    libc6-compat \
    libffi-dev && \
    pip install --no-cache-dir casparser --break-system-packages && \
    apk del py3-pip && \
    rm -rf /root/.cache && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV PYTHON_PATH=python3

# Copy production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Create uploads directory and set permissions
RUN mkdir -p uploads && chown node:node uploads

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
