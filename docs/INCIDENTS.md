# INCIDENTS.md

## Past Incidents

None yet - this is a new project.

## Incident Response Process

When an incident occurs:

### 1. Detect
- Monitoring alerts from Prometheus/Grafana
- User reports via support channel
- Telegram bot alerts (future)

### 2. Triage
Assess severity and impact:

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | Service down / Complete data loss | 15 minutes |
| P1 | Major feature broken / Data corruption | 1 hour |
| P2 | Minor feature broken / Performance degraded | 4 hours |
| P3 | Cosmetic issue / Minor UX bug | 24 hours |

### 3. Contain
Stop the bleeding:
- Disable problematic feature
- Rollback recent deployment
- Enable circuit breaker

### 4. Investigate
Root cause analysis:
- Check logs: `docker compose logs -f api`
- Check metrics in Grafana
- Identify failure point
- Document timeline

### 5. Resolve
Fix the issue:
- Implement fix
- Test fix
- Deploy to staging
- Deploy to production

### 6. Review
Retrospective and documentation:
- Write post-mortem
- Update runbooks
- Add monitoring for similar issues
- Update this document

## Runbooks

### Bot Not Responding

```bash
# 1. Check API logs
docker compose logs -f api

# 2. Verify Telegram webhook status
curl -s https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 3. Check database connectivity
docker compose exec api ping postgres

# 4. Check Redis connectivity
docker compose exec api ping redis

# 5. Restart containers if needed
docker compose restart api worker
```

### High Memory Usage (Redis)

```bash
# 1. Check Redis memory
docker compose exec redis redis-cli -a <password> info memory

# 2. Find big keys
docker compose exec redis redis-cli -a <password> --bigkeys

# 3. Flush if needed (dev only)
docker compose exec redis redis-cli -a <password> flushall

# 4. Restart Redis
docker compose restart redis
```

### Database Connection Failures

```bash
# 1. Check PostgreSQL is running
docker ps | grep togi-postgres

# 2. Verify connection string
cat .env.local | grep POSTGRES

# 3. Test connection
docker compose exec api node -e "require('./packages/db')"

# 4. Check connection pool limits
docker compose exec postgres psql -U togi -c "show max_connections"

# 5. Restart database if needed
docker compose restart postgres
```

### Telegram API Rate Limited

```bash
# 1. Check bot's message queue
redis-cli -p 6388 llen togi:telegram:queue

# 2. Monitor Telegram errors
docker compose logs api | grep "429"

# 3. Wait for rate limit window
# Telegram rate limits reset every second

# 4. If persistent, check bot token validity
curl https://api.telegram.org/bot<TOKEN>/getMe
```

## Monitoring Setup

For v1.0, monitoring includes:
- Health check endpoint: `GET /health`
- Readiness probe: `GET /health/ready`
- Worker metrics: `GET :4390/metrics`
- Prometheus format metrics

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API response time p95 | > 200ms | > 500ms |
| Queue depth | > 100 | > 500 |
| Redis memory | > 200MB | > 240MB |
| Failed jobs | > 10/min | > 50/min |
| Error rate | > 1% | > 5% |
