# Production Deployment Guide

## Overview

This guide covers production deployment requirements for TOGI (Telegram Guard Interface).

## Prerequisites

- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+
- Node.js 20+ (for local development)
- Telegram Bot Token from @BotFather

## Environment Variables

### Required Variables

```bash
# Production flag
NODE_ENV=production

# API Server
API_PORT=4310
API_HOST=0.0.0.0

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=togi
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=togi
DATABASE_URL=postgresql://togi:<password>@localhost:5432/togi

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>

# Telegram (CRITICAL: Keep secret!)
TELEGRAM_BOT_TOKEN=<bot-token-from-botfather>
TELEGRAM_WEBHOOK_SECRET=<random-secret-for-webhook-verification>

# JWT for session management
JWT_SECRET=<strong-random-secret-min-32-chars>

# Security
DEBUG_LOG_RAW_TEXT=false
```

### Security Checklist

- [ ] `TELEGRAM_BOT_TOKEN` never logged or committed to git
- [ ] `TELEGRAM_WEBHOOK_SECRET` set and at least 32 characters
- [ ] `JWT_SECRET` set and at least 32 characters
- [ ] `POSTGRES_PASSWORD` strong and unique
- [ ] `REDIS_PASSWORD` set for production
- [ ] `DEBUG_LOG_RAW_TEXT` is `false` in production
- [ ] `NODE_ENV=production` is set

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: togi-api
    restart: unless-stopped
    ports:
      - "${API_PORT:-4310}:4310"
    environment:
      NODE_ENV: production
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_WEBHOOK_SECRET: ${TELEGRAM_WEBHOOK_SECRET}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: togi
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: togi
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4310/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    container_name: togi-worker
    restart: unless-stopped
    ports:
      - "${WORKER_METRICS_PORT:-4390}:4390"
    environment:
      NODE_ENV: production
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: togi
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: togi
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      AI_PROVIDER: none
      WORKER_METRICS_PORT: 4390
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    container_name: togi-web
    restart: unless-stopped
    ports:
      - "${WEB_PORT:-4320}:4320"
    environment:
      NODE_ENV: production
      API_URL: http://api:4310
    depends_on:
      - api

  postgres:
    image: postgres:15-alpine
    container_name: togi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: togi
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: togi
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U togi -d togi"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: togi-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Health Checks

Each service should implement health checks:

**API Health Check:**
```typescript
// GET /health
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Worker Metrics:**
```bash
# GET http://worker:4390/metrics
# Prometheus metrics endpoint
```

## Webhook Setup

### 1. Set webhook URL

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/webhooks/telegram" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

### 2. Verify webhook secret

The `X-Telegram-Bot-Api-Secret-Token` header must be verified on every request.

## Database Setup

### Run migrations

```bash
pnpm db:migrate
```

### Verify connection

```bash
psql "postgresql://togi:<password>@localhost:5432/togi" -c "SELECT 1"
```

## Monitoring

### Metrics to Track

1. **API Metrics:**
   - `togi_webhook_requests_total`
   - `togi_webhook_latency_seconds`
   - `togi_fastpath_decisions_total`

2. **Worker Metrics:**
   - `togi_worker_jobs_completed_total`
   - `togi_worker_jobs_failed_total`
   - `togi_worker_processing_duration_seconds`

3. **System Metrics:**
   - PostgreSQL connections
   - Redis memory usage
   - API response time p95

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API error rate | >1% | >5% |
| Worker failure rate | >2% | >10% |
| DB connection pool | >70% | >90% |
| Redis memory | >70% | >85% |

## Backup Strategy

### Database Backups

```bash
# Daily backup at 3 AM
0 3 * * * pg_dump -U togi togi > /backups/togi_$(date +\%Y\%m\%d).sql
```

### Redis Backups

Redis persistence should be enabled with RDB + AOF.

## Scaling Considerations

- **Horizontal scaling**: Run multiple API instances behind load balancer
- **Worker scaling**: Run multiple worker instances for queue processing
- **Redis**: Use Redis Cluster for high availability
- **PostgreSQL**: Use read replicas for read-heavy workloads

## Security Hardening

1. **Network segmentation**: Use Docker networks
2. **TLS**: All external traffic over HTTPS
3. **Secrets management**: Use Docker secrets or external vault
4. **Rate limiting**: Configure per-service rate limits
5. **Logging**: Aggregate logs to central system

## Troubleshooting

### Bot not responding

1. Check webhook is set: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Check bot token is correct
3. Check API logs for errors

### Database connection failures

1. Verify PostgreSQL is running
2. Check connection string
3. Verify network connectivity from container

### Redis connection failures

1. Verify Redis is running
2. Check password is correct
3. Verify network connectivity
