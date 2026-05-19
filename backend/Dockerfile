# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# Stage 2: Production Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate
# Remove unused Prisma engines to save space
RUN find node_modules -name "query-engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete && \
    find node_modules -name "libquery_engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete && \
    find node_modules -name "introspection-engine-*" -delete

# Stage 3: Final Runtime
FROM node:20-alpine
WORKDIR /app

# Install python, casparser, and Prisma dependencies (openssl, libc6-compat)
RUN apk add --no-cache python3 py3-pip openssl libc6-compat && \
    pip install --no-cache-dir casparser --break-system-packages && \
    apk del py3-pip && \
    rm -rf /root/.cache && \
    rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV PYTHON_PATH=python3

# Copy production artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# Create uploads directory and set permissions
RUN mkdir -p uploads && chown node:node uploads

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
