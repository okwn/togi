# Deployment Guide

This document covers local development and production deployment for TOGI.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 20.10+ | Required for containerization |
| Docker Compose | 2.0+ | Required for multi-container setup |
| Node.js | 20+ | Required for local development |
| pnpm | 8+ | Package manager |
| PostgreSQL | 16+ | Via Docker (managed externally) |
| Redis | 7+ | Via Docker (managed externally) |

---

## Container Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOGI Stack                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │    API      │   │   Worker    │   │    Web      │          │
│  │   :4310     │   │   :4390     │   │   :4320     │          │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │                   │
│         └────────┬────────┴────────┬────────┘                 │
│                  │                 │                            │
│         ┌────────┴─────────────────┴────────┐                 │
│         ▼                                  ▼                    │
│  ┌─────────────┐                    ┌─────────────┐           │
│  │  PostgreSQL  │                    │    Redis    │           │
│  │    :5543     │                    │    :6388    │           │
│  └─────────────┘                    └─────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Port Mapping

| Service | Container Port | Host Port | Description |
|---------|---------------|-----------|-------------|
| API | 8000 | 4310 | Fastify REST API |
| Worker | 8000 | 4390 | BullMQ worker (health only) |
| Web | 3000 | 4320 | Next.js dashboard |
| PostgreSQL | 5432 | 5543 | Database |
| Redis | 6379 | 6388 | Message queue & cache |

---

## Local Development Commands

### Start Infrastructure
```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Check status
docker compose ps
```

### Start Services
```bash
# Run API in development mode
pnpm dev:api

# Run Worker in development mode (separate terminal)
pnpm dev:worker

# Run Web in development mode (separate terminal)
pnpm dev:web
```

### One-Command Setup
```bash
# Start everything at once
pnpm docker:up

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Database Setup
```bash
# Run migrations
pnpm db:migrate

# Seed development data (optional)
pnpm db:seed

# Reset database (development only)
pnpm db:reset
```

---

## Production Deployment Steps

### 1. Prepare Environment

```bash
# Clone repository
git clone https://github.com/okwn/togi.git
cd togi

# Copy environment template
cp .env.example .env

# Edit production values
nano .env
```

### 2. Build Images

```bash
# Build all service images
pnpm docker:build

# Or build individually
docker build -f apps/api/Dockerfile --target runner -t togi-api:latest .
docker build -f apps/worker/Dockerfile --target runner -t togi-worker:latest .
docker build -f apps/web/Dockerfile --target runner -t togi-web:latest .
```

### 3. Deploy Stack

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Verify deployment
docker compose ps

# Check logs
docker compose logs -f api
```

### 4. Run Migrations

```bash
# Run database migrations
docker compose exec api pnpm db:migrate

# Verify database is ready
docker compose exec api node -e "require('./dist/db/index').test()"
```

### 5. Verify Deployment

```bash
# API health check
curl -s http://localhost:4310/health

# API readiness check
curl -s http://localhost:4310/ready

# Web dashboard check
curl -s http://localhost:4320 | head -20
```

---

## Health Endpoints

| Service | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| API | `/health` | GET | Liveness check - returns 200 if service is running |
| API | `/ready` | GET | Readiness check - returns 200 if service can accept requests |
| Worker | `/health` | GET | Liveness check - returns 200 if worker is running |
| Web | `/health` | GET | Liveness check - returns 200 if web is running |

### Health Response Example

```json
// GET /health
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00Z"
}

// GET /ready
{
  "ready": true,
  "database": "connected",
  "redis": "connected"
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | development | Environment mode |
| `TELEGRAM_BOT_TOKEN` | Yes | - | Telegram bot token from @BotFather |
| `POSTGRES_HOST` | Yes | localhost | PostgreSQL host |
| `POSTGRES_PORT` | Yes | 5432 | PostgreSQL port |
| `POSTGRES_USER` | Yes | togi | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | - | PostgreSQL password |
| `POSTGRES_DB` | Yes | togi | PostgreSQL database name |
| `REDIS_HOST` | Yes | localhost | Redis host |
| `REDIS_PORT` | Yes | 6379 | Redis port |
| `REDIS_PASSWORD` | Yes | - | Redis password |
| `API_PORT` | No | 4310 | API server port |
| `WORKER_METRICS_PORT` | No | 4390 | Worker metrics port |
| `AI_PROVIDER` | No | none | AI provider (none/openai/local) |

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker compose logs <service-name>

# Common issues:
# - Port already in use: change port in docker-compose.yml
# - Environment variable missing: check .env file
# - Volume permission issue: run 'docker volume prune' carefully
```

### Database Connection Failed

```bash
# Check if PostgreSQL is healthy
docker compose ps postgres

# Test connection manually
docker compose exec postgres psql -U togi -d togi

# Check logs
docker compose logs postgres
```

### Redis Connection Failed

```bash
# Check if Redis is healthy
docker compose ps redis

# Test connection manually
docker compose exec redis redis-cli -a <password> ping

# Check logs
docker compose logs redis
```

### Migration Fails

```bash
# Rollback last migration
docker compose exec api pnpm db:rollback

# Check migration status
docker compose exec api pnpm db:status

# Manually run migration
docker compose exec api pnpm db:migrate
```

### High Memory Usage

```bash
# Check container resource usage
docker stats --no-stream

# Increase memory limit in docker-compose.prod.yml
# services:
#   api:
#     deploy:
#       resources:
#         limits:
#           memory: 512M
```

### Web Dashboard Not Loading

```bash
# Check if web container is healthy
docker compose ps web

# Check web logs
docker compose logs web

# Rebuild web container
docker compose up -d --build web
```

---

## Backup and Recovery

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U togi togi > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U togi togi < backup_20240115.sql
```

### Redis Backup

```bash
# Save Redis data
docker compose exec redis redis-cli -a <password> SAVE

# Copy backup file
docker compose cp redis:/data/dump.rdb ./redis_backup.rdb
```

---

## Rolling Update

```bash
# Pull latest images
docker compose pull

# Restart services with new images
docker compose up -d

# Check health
curl -s http://localhost:4310/health
```

---

## Rollback

```bash
# Stop current deployment
docker compose down

# Use previous docker-compose file
git checkout docker-compose.prod.yml.backup

# Start previous version
docker compose -f docker-compose.prod.yml up -d

# Verify rollback
curl -s http://localhost:4310/health
```