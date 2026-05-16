# TECH_DEBT.md

## High Priority (Address Before v1.0)

### 1. No Production Authentication
**Location:** `apps/api/src/middleware/auth.ts`, `apps/web/src/app/dashboard/`

**Issue:** Telegram Login Widget not implemented. Dashboard uses mock data.

**Status:** CRITICAL — blocks public release

**Fix:** Implement `verifyInitData` on backend, issue JWT, wire dashboard to real API.

---

### 2. Webhook Replay Protection Missing
**Location:** `apps/api/src/routes/webhook.ts`

**Issue:** SECURITY_MODEL.md specifies update ID deduplication but code doesn't implement it.

**Status:** CRITICAL — security vulnerability

**Fix:** Add Redis set `webhook:processed-ids` with 24h TTL. Check/update on each request.

---

### 3. Per-IP Rate Limiting Not Implemented
**Location:** `apps/api/src/middleware/security.ts`

**Issue:** `ipLoggingMiddleware` logs but doesn't block. Single IP can exhaust API.

**Status:** HIGH — DoS vulnerability

**Fix:** Add `RateLimiter` instance with IP-based keys.

---

### 4. Command Target Resolution Broken
**Location:** `apps/api/src/routes/webhook.ts:601-885`

**Issue:** `/warn @username` parses username but can't resolve to userId. Falls back to command sender.

**Status:** HIGH — moderation commands broken

**Fix:** Use `resolveUsername` bot API or require reply-based commands.

---

### 5. No Dockerfiles
**Location:** `docker-compose.yml:39,64,79` references non-existent files

**Issue:** `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile` don't exist.

**Status:** CRITICAL — cannot deploy

**Fix:** Create multi-stage Dockerfiles for all three apps.

---

### 6. No CI/CD Pipeline
**Location:** No `.github/workflows/` directory

**Issue:** No automated tests on PR. Code can merge without validation.

**Status:** HIGH — quality risk

**Fix:** Create GitHub Actions workflow with typecheck, lint, test, docker build.

---

### 7. BullMQ Processors Untested at Runtime
**Location:** `apps/worker/src/processors/index.ts`

**Issue:** 5 processors exist but never validated in production conditions.

**Status:** HIGH — operational risk

**Fix:** Add integration tests with BullMQ test helpers, load test.

---

## Medium Priority (Address in v0.3.0)

### 8. Redis Single Instance (SPOF)
**Location:** `docker-compose.yml`

**Issue:** No Redis Cluster, single point of failure.

**Status:** MEDIUM — availability risk

**Fix:** Upgrade to Redis Cluster in v0.4.0.

---

### 9. Policy Not Cached in Redis
**Location:** `apps/api/src/routes/webhook.ts:226-234`

**Issue:** DB query on every message for policy lookup. PERFORMANCE_MODEL.md says "No DB Calls" for fast path.

**Status:** MEDIUM — performance degradation

**Fix:** Cache policy in Redis with 60s TTL, invalidate on update.

---

### 10. No Prometheus Metrics on API
**Location:** `apps/api/src/server.ts`

**Issue:** PERFORMANCE_MODEL.md specifies metrics but API doesn't expose them.

**Status:** MEDIUM — no observability

**Fix:** Add `/metrics` endpoint using `prom-client`.

---

### 11. PostgreSQL Single Instance
**Location:** `docker-compose.yml`

**Issue:** No read replicas, scaling limited.

**Status:** MEDIUM — scalability

**Fix:** Add read replicas in v0.4.0.

---

### 12. Worker Retries Not Exponential Backoff
**Location:** `apps/worker/src/processors/action-retry.ts`

**Issue:** TECH_DEBT.md line 15 says "Worker retries are not exponential backoff".

**Status:** MEDIUM — could flood Telegram API

**Fix:** Implement exponential backoff in retry logic.

---

### 13. No Kubernetes
**Location:** N/A

**Issue:** Manual Docker Compose deployment, no horizontal scaling.

**Status:** LOW — v0.4.0 item

**Fix:** Add K8s manifests in v0.4.0.

---

## Low Priority (Nice to Have)

### 14. Rate Limit Headers Missing
**Location:** `apps/api/src/middleware/security.ts`

**Issue:** Rate limiter tracks state but doesn't return `X-RateLimit-*` headers.

**Status:** LOW

**Fix:** Add headers to all API responses.

---

### 15. Slow Mode Integration Incomplete
**Location:** `packages/detection-engine/src/detectors/raid-detector.ts`

**Issue:** `setChatPermissions` lockdown exists but slow mode not implemented.

**Status:** LOW

**Fix:** Add Telegram `SlowMode` API call.

---

### 16. Homoglyph Detection Missing
**Location:** `packages/detection-engine/src/detectors/link-detector.ts`

**Issue:** No IDN/punycode or lookalike character detection.

**Status:** LOW — security gap

**Fix:** Add `url-parse` with IDN support or use punycode normalization.

---

### 17. No API Docs (Swagger)
**Location:** N/A

**Issue:** No OpenAPI spec for API consumers.

**Status:** LOW

**Fix:** Add `@fastify/swagger` with route annotations.

---

### 18. Dashboard Not Mobile Responsive
**Location:** `apps/web/src/app/dashboard/`

**Issue:** Layout optimized for desktop.

**Status:** LOW

**Fix:** Add mobile-responsive breakpoints.

---

## Testing Gaps (From TECH_DEBT.md)

### Before v1.0
- [ ] Load testing script
- [ ] E2E tests for webhook flow
- [ ] Integration tests for policy engine
- [ ] Chaos testing for worker resilience
- [ ] Security tests

### Before v1.1
- [ ] Property-based testing for detection
- [ ] Mutation testing
- [ ] Contract tests for API

---

## Tech Debt Matrix

| Item | Priority | Effort | Risk if Delayed |
|------|----------|--------|------------------|
| Production auth | CRITICAL | 3 days | No deployment |
| Replay protection | CRITICAL | 1 day | Security breach |
| Dockerfiles | CRITICAL | 2 days | No deployment |
| CI/CD | HIGH | 2 days | Quality risk |
| Per-IP rate limit | HIGH | 1 day | DoS vulnerability |
| RBAC enforcement | HIGH | 2 days | Auth bypass |
| Command resolution | HIGH | 1 day | Features broken |
| BullMQ testing | HIGH | 2 days | Production failures |
| Policy caching | MEDIUM | 1 day | Performance |
| API Prometheus | MEDIUM | 1 day | No observability |
| Redis Cluster | MEDIUM | 3 days | Scalability |
| Slow mode | LOW | 1 day | Incomplete |
| Homoglyph | LOW | 1 day | Security gap |

---

## Recommendations

1. **v0.2.0 Sprint 1 (Week 1-2):** Auth + Security — items 1, 2, 3, 5, 6
2. **v0.2.0 Sprint 2 (Week 3-4):** Bug fixes — items 4, 7
3. **v0.3.0:** Performance + Scale — items 8, 9, 10, 11, 12
4. **v0.4.0:** K8s + advanced features

**Do not let CRITICAL items accumulate.** Each one compounds.