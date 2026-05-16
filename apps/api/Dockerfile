# syntax=docker/dockerfile:1

# Stage 1: Install dependencies
FROM node:20-alpine AS deps

RUN corepack enable pnpm@8

WORKDIR /app

# Copy workspace files for pnpm to resolve workspace dependencies
COPY pnpm-workspace.yaml .
COPY package.json .
COPY packages/*/package.json packages/
COPY apps/*/package.json apps/

# Install all dependencies (workspace)
RUN pnpm install --frozen-lockfile

# Copy source for builder stage
COPY . .

# Stage 2: Build TypeScript
FROM node:20-alpine AS builder

RUN corepack enable pnpm@8

WORKDIR /app

# Copy workspace and node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app .
COPY --from=deps /app/pnpm-workspace.yaml .
COPY --from=deps /app/package.json .
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps

# Build the API
RUN pnpm --filter togi-api build

# Stage 3: Production runner
FROM node:20-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S togi -u 1001 -G nodejs

WORKDIR /home/togi/app

# Copy built artifacts from builder
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Copy env-check script
COPY --from=builder /app/apps/api/src/env-check.js ./env-check.js

# Set ownership
RUN chown -R togi:nodejs /home/togi/app

USER togi

EXPOSE 4310

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:4310/health || exit 1

# Validate environment and start server
CMD node env-check.js && node dist/server.js