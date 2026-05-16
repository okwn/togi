# Production Readiness Checklist

## Pre-Release Checklist

### Authentication & Authorization

```
[ ] Telegram Login Widget implemented and tested
[ ] JWT token generation/validation working
[ ] Session expiry enforced (24h max)
[ ] RBAC middleware verifies group admin before CRUD
[ ] Per-IP rate limiting active on all API endpoints
[ ] No development auth fallback in production code
```

### Webhook Security

```
[ ] Webhook secret verification enforced
[ ] Update ID deduplication in Redis (24h TTL)
[ ] No replay attack possible
[ ] Secret token rotatable without downtime
[ ] Failed webhook returns 200 (prevent Telegram retry storms)
```

### Action Execution

```
[ ] All 7 actions idempotent via Redis locks
[ ] Admin protection verified before every action
[ ] Retriable errors use exponential backoff
[ ] Failed actions queued for retry (max 10 attempts)
[ ] Action logs include request ID for tracing
```

### Database

```
[ ] All tables have appropriate indexes
[ ] Connection pooling configured (20 connections)
[ ] Migrations tested on staging
[ ] Backup/restore procedure documented
[ ] No raw message content stored (hash only)
```

### Redis

```
[ ] Connection pooling configured
[ ] Key expiration policies set
[ ] Memory limit enforced (256MB)
[ ] Persistence enabled (RDB + AOF)
[ ] Fail-open behavior tested
```

### Infrastructure

```
[ ] Dockerfiles created for api, web, worker
[ ] Docker Compose orchestration works
[ ] Health check endpoints respond correctly
[ ] Graceful shutdown implemented
[ ] No hardcoded credentials in images
```

### Monitoring & Alerting

```
[ ] Prometheus metrics exposed on API (port 4310)
[ ] Prometheus metrics exposed on Worker (port 4390)
[ ] Key metrics: request latency, error rate, queue depth
[ ] PagerDuty/OpsGenie alerts configured
[ ] Log aggregation working (structured JSON)
```

### Testing

```
[ ] Unit test coverage >70%
[ ] Integration tests pass
[ ] Load tests validate performance claims
[ ] Fast path <20ms p95 validated
[ ] API webhook <50ms p50 validated
```

### Documentation

```
[ ] README.md updated with production instructions
[ ] Environment variables documented (.env.example)
[ ] Architecture decisions documented (ADRs)
[ ] Runbook for common issues
[ ] Onboarding doc for new developers
```

---

## Go/No-Go Criteria

| Category | Criterion | Minimum | Target |
|----------|-----------|---------|--------|
| Security | Auth bypass vulnerabilities | 0 Critical | 0 High |
| Security | Webhook replay protection | Implemented | Tested |
| Performance | Fast path latency p95 | <50ms | <20ms |
| Performance | API throughput | 100 req/s | 500 req/s |
| Testing | Unit coverage | >50% | >70% |
| Testing | Integration tests | Pass | Pass |
| Monitoring | Metrics exposed | Yes | Yes |
| Monitoring | Alerts configured | Yes | Yes |
| Documentation | README accurate | Yes | Yes |

---

## Staging Validation Steps

```bash
# 1. Deploy to staging
git checkout staging
docker compose up -d

# 2. Verify health
curl https://staging.togi.example/health

# 3. Run integration tests
pnpm test:integration

# 4. Run load tests
k6 run tests/load/webhook.js

# 5. Check metrics
curl https://staging.togi.example/metrics | grep togi_

# 6. Verify auth flow
# - Open dashboard in browser
# - Click Telegram Login button
# - Verify redirect after auth
# - Check JWT in response headers
```

---

## Rollback Plan

**Trigger:** Any of the following:
- Error rate >5% for 5 minutes
- p99 latency >2s for 5 minutes
- Security vulnerability discovered

**Procedure:**
```bash
# 1. Switch traffic to previous version
kubectl rollout undo deployment/togi-api
kubectl rollout undo deployment/togi-worker

# 2. Verify old version running
kubectl rollout status deployment/togi-api

# 3. Notify on-call
# PagerDuty incident created automatically
```

---

## Final Verdict

**Current Readiness:** NOT READY FOR PRODUCTION

**Blocking Issues:**
1. No production authentication (Telegram Login Widget missing)
2. No webhook replay protection
3. No Dockerfiles
4. No CI/CD pipeline

**Estimated Time to Production:** 4-6 weeks

**Recommendation:** Focus on Sprint 1 (Security Hardening) before any deployment.