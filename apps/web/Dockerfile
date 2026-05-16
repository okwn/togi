# Stage 1: Install dependencies
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

RUN corepack enable pnpm && corepack prepare pnpm@8 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

COPY packages/*/package.json packages/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

RUN corepack enable pnpm && corepack prepare pnpm@8 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm --filter togi-web build

# Stage 3: Runner
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 togi

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=togi:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=togi:nodejs /app/apps/web/.next/static ./.next/static

USER togi

EXPOSE 4320

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:4320 || exit 1

ENV PORT=4320
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]