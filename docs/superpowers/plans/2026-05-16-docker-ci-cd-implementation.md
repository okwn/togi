# Phase 04: Production Dockerfiles and CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize API, Worker, and Web services with production-grade Dockerfiles and GitHub Actions CI/CD pipeline.

**Architecture:**
- Multi-stage Docker builds for minimal final image size
- pnpm workspace for dependency management in Docker
- Non-root user for security
- Environment variable validation at startup
- Healthcheck endpoints for all services
- GitHub Actions workflows for CI/CD

**Tech Stack:** Docker, Docker Compose, GitHub Actions, pnpm workspaces

---

## File Structure

```
apps/api/Dockerfile                    # Multi-stage build for Fastify API
apps/worker/Dockerfile                 # Multi-stage build for BullMQ worker
apps/web/Dockerfile                    # Multi-stage build for Next.js web
docker-compose.local.yml               # Local development compose
docker-compose.prod.example.yml       # Production example compose
.github/
  workflows/
    ci.yml                             # Main CI pipeline
    security.yml                       # Security checks pipeline
docs/
  DEPLOYMENT.md                        # Deployment guide
  CI_CD.md                             # CI/CD documentation
RELEASE_CHECKLIST.md                   # Pre-release checklist
```

---

## Task 1: API Dockerfile

**Files:**
- Create: `apps/api/Dockerfile`

```dockerfile
# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages.config.json packages/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# ===== Stage 2: Build =====
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api ./apps/api

WORKDIR /app/apps/api

# Build TypeScript
RUN pnpm build

# ===== Stage 3: Production =====
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S togi -u 1001

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages ./packages

# Install production dependencies only
RUN npm install -g pnpm@8 && \
    pnpm config set store-dir /app/.pnpm-store && \
    pnpm install --frozen-lockfile --prod

# Copy package files for env validation
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json

# Change ownership
RUN chown -R togi:nodejs /app

USER togi

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4310/health || exit 1

# Expose port
EXPOSE 4310

# Validate env and start
ENV NODE_ENV=production

CMD ["sh", "-c", "node ./packages/config/src/env-check.js && node dist/server.js"]
```

**Files:**
- Create: `apps/api/src/env-check.js` (environment validation script)

```javascript
// apps/api/src/env-check.js
const z = require('zod');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  API_PORT: z.coerce.number().default(4310),
  API_HOST: z.string().default('0.0.0.0'),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  JWT_SECRET: z.string().min(32),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  result.error.errors.forEach((e) => console.error(`  ${e.path.join('.')}: ${e.message}`));
  process.exit(1);
}

console.log('Environment validation passed');
```

---

## Task 2: Worker Dockerfile

**Files:**
- Create: `apps/worker/Dockerfile`

```dockerfile
# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps

RUN npm install -g pnpm@8

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages.config.json packages/

RUN pnpm install --frozen-lockfile

COPY . .

# ===== Stage 2: Build =====
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/worker ./apps/worker

WORKDIR /app/apps/worker

RUN pnpm build

# ===== Stage 3: Production =====
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S togi -u 1001

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/packages ./packages

RUN npm install -g pnpm@8 && \
    pnpm config set store-dir /app/.pnpm-store && \
    pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/worker/package.json ./package.json
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json

RUN chown -R togi:nodejs /app

USER togi

# Health check - worker has metrics endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4390/health || exit 1

EXPOSE 4390

ENV NODE_ENV=production

CMD ["sh", "-c", "node ./packages/config/src/env-check.js && node dist/index.js"]
```

---

## Task 3: Web Dockerfile

**Files:**
- Create: `apps/web/Dockerfile`

```dockerfile
# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps

RUN npm install -g pnpm@8

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages.config.json packages/

RUN pnpm install --frozen-lockfile

COPY . .

# ===== Stage 2: Build =====
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web ./apps/web

WORKDIR /app/apps/web

# Build Next.js (no TypeScript compilation needed for Next)
RUN pnpm build

# ===== Stage 3: Production =====
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S togi -u 1001

# Copy built Next.js output
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json

# Install production dependencies only
RUN npm install -g pnpm@8 && \
    pnpm config set store-dir /app/.pnpm-store && \
    pnpm install --frozen-lockfile --prod

# Create standalone output directory
RUN mv .next /app/.next && mkdir -p /app

RUN chown -R togi:nodejs /app

USER togi

# Next.js handles its own health check via start command
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4320/health || exit 1

EXPOSE 4320

ENV NODE_ENV=production
ENV PORT=4320

CMD ["pnpm", "start"]
```

---

## Task 4: Local Docker Compose

**Files:**
- Create: `docker-compose.local.yml`

```yaml
version: '3.8'

services:
  postgres:
    container_name: togi-postgres
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-togi}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-togi_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-togi}
    ports:
      - "${POSTGRES_PORT:-5543}:5432"
    volumes:
      - togi_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-togi}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    container_name: togi-redis
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:-togi_dev_password}
    ports:
      - "${REDIS_PORT:-6388}:6379"
    volumes:
      - togi_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-togi_dev_password}", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    container_name: togi-api
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: runner
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      API_PORT: ${API_PORT:-4310}
      API_HOST: ${API_HOST:-0.0.0.0}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER:-togi}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-togi_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-togi}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-togi_dev_password}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_WEBHOOK_SECRET: ${TELEGRAM_WEBHOOK_SECRET}
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      DEBUG_LOG_RAW_TEXT: ${DEBUG_LOG_RAW_TEXT:-false}
      ENABLE_DEV_AUTH: ${ENABLE_DEV_AUTH:-false}
    ports:
      - "${API_PORT:-4310}:4310"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4310/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  web:
    container_name: togi-web
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: runner
    depends_on:
      - api
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      VITE_API_URL: http://localhost:${API_PORT:-4310}
      VITE_WS_URL: ws://localhost:${API_PORT:-4310}
    ports:
      - "${WEB_PORT:-4320}:4320"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4320/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  worker:
    container_name: togi-worker
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
      target: runner
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      WORKER_METRICS_PORT: ${WORKER_METRICS_PORT:-4390}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER:-togi}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-togi_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-togi}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-togi_dev_password}
    ports:
      - "${WORKER_METRICS_PORT:-4390}:4390"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4390/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

volumes:
  togi_postgres_data:
  togi_redis_data:
```

---

## Task 5: Production Docker Compose Example

**Files:**
- Create: `docker-compose.prod.example.yml`

```yaml
version: '3.8'

# Production deployment example
# Copy to docker-compose.yml and customize

services:
  postgres:
    container_name: togi-postgres
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - togi_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  redis:
    container_name: togi-redis
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - togi_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  api:
    container_name: togi-api
    image: togi-api:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      API_PORT: ${API_PORT:-4310}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_WEBHOOK_SECRET: ${TELEGRAM_WEBHOOK_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4310/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  web:
    container_name: togi-web
    image: togi-web:latest
    depends_on:
      - api
    environment:
      NODE_ENV: production
      VITE_API_URL: ${VITE_API_URL}
      VITE_WS_URL: ${VITE_WS_URL}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4320/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  worker:
    container_name: togi-worker
    image: togi-worker:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      WORKER_METRICS_PORT: ${WORKER_METRICS_PORT:-4390}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4390/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

volumes:
  togi_postgres_data:
  togi_redis_data:
```

---

## Task 6: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}/

jobs:
  install:
    name: Install Dependencies
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

  lint:
    name: Lint
    runs-on: ubuntu-latest
    needs: [install]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run lint
        run: pnpm lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    needs: [install]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run typecheck
        run: pnpm typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: [install]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    strategy:
      matrix:
        service:
          - api
          - worker
          - web
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build ${{ matrix.service }}
        run: pnpm --filter togi-${{ matrix.service }} build

  docker-api:
    name: Docker Build (API)
    runs-on: ubuntu-latest
    needs: [build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/togi-api
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          target: runner
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  docker-worker:
    name: Docker Build (Worker)
    runs-on: ubuntu-latest
    needs: [build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/togi-worker
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push Worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/worker/Dockerfile
          target: runner
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  docker-web:
    name: Docker Build (Web)
    runs-on: ubuntu-latest
    needs: [build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ github.repository }}/togi-web
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push Web
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/web/Dockerfile
          target: runner
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Task 7: GitHub Actions Security Workflow

**Files:**
- Create: `.github/workflows/security.yml`

```yaml
name: Security

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  pull_request:
    branches: [main]

jobs:
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level=high

  docker-build-check:
    name: Docker Build Check
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - api
          - worker
          - web
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build ${{ matrix.service }} (no push)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/${{ matrix.service }}/Dockerfile
          target: runner
          load: true
          push: false

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'togi-${{ matrix.service }}:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  secret-scanning:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Scan for secrets
        run: |
          # Basic check - rely on GitHub's built-in secret scanning
          # This is a placeholder for additional secret scanning if needed
          echo "Relying on GitHub's built-in secret scanning"
          echo "Ensure GITHUB_TOKEN has appropriate permissions"

  static-analysis:
    name: Static Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run TypeScript with strict mode
        run: pnpm typecheck
```

---

## Task 8: Root-level Docker Scripts

**Files:**
- Create: `scripts/docker-build.sh`
- Create: `scripts/docker-push.sh`
- Modify: `package.json` (add docker scripts)

```bash
#!/bin/bash
# scripts/docker-build.sh
set -e

echo "Building Docker images..."

echo "Building API..."
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .

echo "Building Worker..."
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:latest .

echo "Building Web..."
docker build -f apps/web/Dockerfile --target runner -t togi-web:latest .

echo "All images built successfully"
```

```bash
#!/bin/bash
# scripts/docker-push.sh
set -e

REGISTRY=${REGISTRY:-ghcr.io}
IMAGE_PREFIX=${IMAGE_PREFIX:-${{ github.repository }}/}

echo "Pushing Docker images..."

docker push $REGISTRY/$IMAGE_PREFIX/togi-api:latest
docker push $REGISTRY/$IMAGE_PREFIX/togi-worker:latest
docker push $REGISTRY/$IMAGE_PREFIX/togi-web:latest

echo "All images pushed successfully"
```

Add to `package.json`:
```json
{
  "scripts": {
    "docker:build": "bash scripts/docker-build.sh",
    "docker:push": "bash scripts/docker-push.sh",
    "docker:up": "docker compose -f docker-compose.local.yml up -d",
    "docker:down": "docker compose -f docker-compose.local.yml down",
    "docker:logs": "docker compose -f docker-compose.local.yml logs -f",
    "validate:local": "bash scripts/validate-local.sh"
  }
}
```

---

## Task 9: RELEASE_CHECKLIST.md

**Files:**
- Create: `RELEASE_CHECKLIST.md`

```markdown
# TOGI Release Checklist

## Pre-Release Validation

### Tests
- [ ] All unit tests pass: `pnpm test`
- [ ] All integration tests pass
- [ ] API route tests pass: `pnpm --filter togi-api test`
- [ ] Worker tests pass: `pnpm --filter togi-worker test`
- [ ] Web tests pass: `pnpm --filter togi-web test`

### Security
- [ ] Dependency audit passes: `pnpm audit`
- [ ] No critical vulnerabilities in Docker images
- [ ] No hardcoded secrets in code
- [ ] Environment variables documented

### Code Quality
- [ ] Lint passes: `pnpm lint`
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build`

## Docker Build Verification

- [ ] API Docker image builds: `docker build -f apps/api/Dockerfile --target runner -t togi-api:test .`
- [ ] Worker Docker image builds: `docker build -f apps/worker/Dockerfile --target runner -t togi-worker:test .`
- [ ] Web Docker image builds: `docker build -f apps/web/Dockerfile --target runner -t togi-web:test .`
- [ ] All containers start successfully
- [ ] Health checks respond correctly

## Environment Validation

- [ ] API starts with production env vars
- [ ] Worker starts with production env vars
- [ ] Web starts with production env vars
- [ ] Database migrations run successfully
- [ ] Redis connection works

## Database

- [ ] Migration files created for schema changes
- [ ] Migration tested in staging environment
- [ ] Rollback plan documented
- [ ] Backup verified before migration

## Deployment

- [ ] Staging deployment successful
- [ ] Smoke tests pass on staging
- [ ] Production deployment plan reviewed
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

## Rollback Plan

1. Revert Docker images to previous version
2. Run database rollback migration if needed
3. Verify all services healthy
4. Monitor error rates for 15 minutes

## Sign-off

- [ ] Security review complete
- [ ] QA sign-off obtained
- [ ] DevOps sign-off obtained
- [ ] Product sign-off obtained

---

## Quick Commands

```bash
# Full validation
pnpm lint && pnpm typecheck && pnpm test && pnpm docker:build

# Deploy to staging
docker compose -f docker-compose.prod.yml up -d

# Rollback
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d togi-api togi-worker togi-web
```
```

---

## Task 10: Documentation

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Create: `docs/CI_CD.md`
- Modify: `README.md` (update Docker sections)

### docs/DEPLOYMENT.md

```markdown
# TOGI Deployment Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for local development)
- pnpm 8+

## Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                         │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   togi-api  │  togi-web   │ togi-worker │   Infrastructure │
│   port 4310 │  port 4320  │  port 4390  │                  │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│   Fastify   │   Next.js   │   BullMQ    │                  │
│   + pino    │  + Radix UI │  + ioredis  │                  │
└─────────────┴─────────────┴─────────────┴──────────────────┘
        │              │              │
        ▼              ▼              ▼
   togi-postgres    togi-redis
      port 5543       port 6388
```

## Local Development

```bash
# Start infrastructure
docker compose up -d postgres redis

# Start all services
docker compose -f docker-compose.local.yml up -d

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop
docker compose -f docker-compose.local.yml down
```

## Production Deployment

### 1. Build Images

```bash
# Build all images
pnpm docker:build

# Or build individually
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:latest .
docker build -f apps/web/Dockerfile --target runner -t togi-web:latest .
```

### 2. Configure Environment

```bash
# Copy example env
cp .env.example .env.production

# Edit with real values
vim .env.production
```

### 3. Deploy

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Verify health
curl http://localhost:4310/health
curl http://localhost:4320/health
curl http://localhost:4390/health
```

## Health Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| API | `/health` | Liveness check |
| API | `/ready` | Readiness check (DB + Redis) |
| Worker | `/health` | Liveness check |
| Web | `/health` | Liveness check |
| Postgres | `pg_isready` | Database health |
| Redis | `redis-cli ping` | Cache health |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTGRES_HOST` | PostgreSQL host | Yes |
| `POSTGRES_PORT` | PostgreSQL port | Yes |
| `POSTGRES_USER` | PostgreSQL user | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | Yes |
| `REDIS_PASSWORD` | Redis password | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Yes |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook secret | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `API_PORT` | API listen port | No (default: 4310) |
| `WEB_PORT` | Web listen port | No (default: 4320) |
| `WORKER_METRICS_PORT` | Worker metrics port | No (default: 4390) |

## Troubleshooting

### API won't start
```bash
# Check logs
docker compose logs togi-api

# Verify env vars
docker compose exec togi-api env | grep -E 'POSTGRES|REDIS|JWT'

# Check connectivity
docker compose exec togi-api wget -qO- http://localhost:4310/health
```

### Database migration failed
```bash
# Run migrations manually
docker compose exec togi-api node packages/db/dist/migrate.js
```

### Worker queue is empty
```bash
# Check Redis connection
docker compose exec togi-redis redis-cli -a togi_dev_password ping

# Check worker logs
docker compose logs togi-worker
```
```

### docs/CI_CD.md

```markdown
# CI/CD Documentation

## GitHub Actions Workflows

### CI Pipeline (ci.yml)

Triggered on: push to main, pull requests

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Install │──▶│  Lint    │──▶│ Typecheck│──▶│  Test   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                   │
                                                   ▼
                     ┌────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │   Build     │
              └─────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌────────┐ ┌─────────┐ ┌────────┐
   │Docker  │ │Docker   │ │Docker │
   │  API   │ │ Worker  │ │  Web  │
   └────────┘ └─────────┘ └────────┘
```

Jobs:
1. **install** - Install pnpm dependencies
2. **lint** - Run ESLint
3. **typecheck** - Run TypeScript compiler
4. **test** - Run test suite
5. **build** - Build all three services
6. **docker-api** - Build and push API image (main branch only)
7. **docker-worker** - Build and push Worker image (main branch only)
8. **docker-web** - Build and push Web image (main branch only)

### Security Pipeline (security.yml)

Triggered on: push to main, weekly schedule, pull requests

```
┌──────────────────┐
│ Dependency Audit │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Docker Build    │
│  + Trivy Scan    │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Secret Scanning  │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Static Analysis  │
└──────────────────┘
```

Jobs:
1. **dependency-audit** - Check for vulnerable dependencies
2. **docker-build-check** - Build Docker images and scan with Trivy
3. **secret-scanning** - Placeholder for additional secret scanning
4. **static-analysis** - ESLint and TypeScript checks

## Docker Image Tags

Images are tagged with:
- `sha-{commit_sha}` - Every commit gets a SHA tag
- `latest` - Points to latest main branch
- `v{version}` - Semver tags for releases

Example:
```
ghcr.io/owner/togi-api:sha-abc123
ghcr.io/owner/togi-api:latest
ghcr.io/owner/togi-api:v0.1.0
```

## Local Docker Commands

```bash
# Build all images
pnpm docker:build

# Start local environment
pnpm docker:up

# View logs
pnpm docker:logs

# Stop
pnpm docker:down

# Build specific service
docker build -f apps/api/Dockerfile --target runner -t togi-api:test .
```

## CI Limitations

1. **No deployment to production** - CI only builds and pushes images. Actual deployment requires manual approval or separate deployment workflow.

2. **No staging environment** - The CI pipeline doesn't deploy to a staging environment. Consider adding a staging deployment job.

3. **Limited security scanning** - The security workflow uses basic tools. Consider adding:
   - SAST tools (e.g., CodeQL)
   - Container signing
   - Dependency fingerprinting

4. **No performance testing** - CI doesn't run performance benchmarks. Consider adding load testing job.

5. **No database migration testing** - CI builds images but doesn't test migrations. Consider adding migration test job.
```

---

## Task 11: Update README.md

**Files:**
- Modify: `README.md` (add Docker section)

Add before the final section of README.md:

```markdown
## Docker

### Local Development

```bash
# Start all services
docker compose -f docker-compose.local.yml up -d

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop
docker compose -f docker-compose.local.yml down
```

### Build Docker Images

```bash
# Build all images
pnpm docker:build

# Build specific service
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .
```

### Health Checks

All services expose `/health` endpoint:

```bash
# API health
curl http://localhost:4310/health

# Worker health
curl http://localhost:4390/health

# Web health
curl http://localhost:4320/health
```

### Production Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed production guide.
```

---

## Task 12: Validate Dockerfiles

**Files:**
- None (validation task)

- [ ] **Step 1: Build API Dockerfile**

Run: `docker build -f apps/api/Dockerfile --target runner -t togi-api:test .`
Expected: Build completes without errors

- [ ] **Step 2: Build Worker Dockerfile**

Run: `docker build -f apps/worker/Dockerfile --target runner -t togi-worker:test .`
Expected: Build completes without errors

- [ ] **Step 3: Build Web Dockerfile**

Run: `docker build -f apps/web/Dockerfile --target runner -t togi-web:test .`
Expected: Build completes without errors

- [ ] **Step 4: Test docker-compose.local.yml**

Run: `docker compose -f docker-compose.local.yml up -d`
Expected: All services start and health checks pass

- [ ] **Step 5: Verify health endpoints**

Run:
```bash
curl http://localhost:4310/health
curl http://localhost:4320/health
curl http://localhost:4390/health
```
Expected: All return 200

---

## Validation Commands

```bash
# Build all Dockerfiles
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:latest .
docker build -f apps/web/Dockerfile --target runner -t togi-web:latest .

# Test docker-compose
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml logs -f

# CI simulation
pnpm lint && pnpm typecheck && pnpm test
```

---

## CI/CD Limitations

1. **No auto-deployment** - CI builds and pushes images but doesn't deploy to any environment
2. **No staging verification** - No automated staging deployment in pipeline
3. **No database migration CI test** - Migrations not tested in CI
4. **No E2E tests in CI** - Only unit/integration tests run in CI
5. **No performance benchmarks** - No load testing in CI
6. **Container signing not implemented** - Images are not signed
7. **Security scanning limited** - Trivy is basic; consider commercial scanners for production

---

## PASS/FAIL Checklist

| Item | Status |
|------|--------|
| API Dockerfile created | ⬜ |
| Worker Dockerfile created | ⬜ |
| Web Dockerfile created | ⬜ |
| Multi-stage builds | ⬜ |
| Non-root user | ⬜ |
| Production deps only in final | ⬜ |
| Healthcheck support | ⬜ |
| Env validation at startup | ⬜ |
| docker-compose.local.yml | ⬜ |
| docker-compose.prod.example.yml | ⬜ |
| Container names correct | ⬜ |
| CI workflow (ci.yml) | ⬜ |
| Security workflow (security.yml) | ⬜ |
| Docker build in CI | ⬜ |
| Root docker scripts | ⬜ |
| RELEASE_CHECKLIST.md | ⬜ |
| docs/DEPLOYMENT.md | ⬜ |
| docs/CI_CD.md | ⬜ |
| README.md updated | ⬜ |
| All Dockerfiles build | ⬜ |
| All containers start | ⬜ |
| Health endpoints respond | ⬜ |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-docker-ci-cd-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**