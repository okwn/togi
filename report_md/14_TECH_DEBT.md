# Tech Debt

## High Priority (Address in v0.2.0)

### 1. Mock Dashboard Data
**Location:** `apps/web/src/app/dashboard/page.tsx:8-70`

**Debt:** Hardcoded mock data instead of API calls.

**Why:** Auth not implemented, so API access not possible.

**Fix:** Wire up React Query to real API endpoints once auth exists.

---

### 2. Command Target Resolution Broken
**Location:** `apps/api/src/routes/webhook.ts:601-885`

**Debt:** `/warn @username` parses username but can't resolve to userId.

**Why:** Telegram's `getChatMember` requires chat ID, not username.

**Fix:** Use `resolveUsername` bot API method or require reply-based commands.

---

### 3. No Update IDempotency
**Location:** `apps/api/src/routes/webhook.ts`

**Debt:** Updates processed even if already handled.

**Why:** Replay protection was not implemented in MVP.

**Fix:** Add Redis set for processed update IDs with 24h TTL.

---

### 4. No Per-IP Rate Limiting
**Location:** `apps/api/src/middleware/security.ts`

**Debt:** IP logged but not rate limited.

**Why:** MVP focused on per-group/user limiting.

**Fix:** Add `RateLimiter` with IP-based keys.

---

### 5. BullMQ Processors Untested
**Location:** `apps/worker/src/processors/`

**Debt:** 5 processors exist but no runtime verification.

**Why:** Worker not load-tested.

**Fix:** Add integration tests with BullMQ test helpers.

---

## Medium Priority (Address in v0.3.0)

### 6. Redis Single Instance
**Location:** `docker-compose.yml`

**Debt:** No Redis Cluster, single point of failure.

**Why:** MVP simplicity.

**Fix:** Upgrade to Redis Cluster in v0.3.0.

---

### 7. PostgreSQL Single Instance
**Location:** `docker-compose.yml`

**Debt:** No read replicas, scaling limited.

**Why:** MVP simplicity.

**Fix:** Add read replicas in v0.3.0.

---

### 8. No Kubernetes
**Location:** N/A

**Debt:** Manual Docker Compose deployment.

**Why:** MVP, K8s learning curve.

**Fix:** Add K8s manifests in v0.3.0.

---

### 9. No Prometheus on API
**Location:** `apps/api/src/server.ts`

**Debt:** PERFORMANCE_MODEL.md specifies metrics but API doesn't expose them.

**Why:** MVP focused on worker metrics.

**Fix:** Add `/metrics` endpoint using `prom-client`.

---

### 10. Policy Not Cached in Redis
**Location:** `apps/api/src/routes/webhook.ts:226-234`

**Debt:** DB query on every message for policy lookup.

**Why:** Simpler MVP code.

**Fix:** Cache policy in Redis with 60s TTL, invalidate on update.

---

## Low Priority (Nice to Have)

### 11. Rate Limit Headers Missing
**Location:** `apps/api/src/middleware/security.ts`

**Debt:** Rate limiter tracks state but doesn't return `X-RateLimit-*` headers.

**Fix:** Add headers to all API responses.

---

### 12. Slow Mode Integration Incomplete
**Location:** ROADMAP.md v0.8.0

**Debt:** `setChatPermissions` lockdown exists but slow mode not implemented.

**Fix:** Add Telegram `SlowMode` API call.

---

### 13. Homoglyph Detection Missing
**Location:** `packages/detection-engine/src/detectors/link-detector.ts`

**Debt:** No IDN/punycode or lookalike character detection.

**Fix:** Add `url-parse` with IDN support.

---

### 14. No API Docs (Swagger)
**Location:** N/A

**Debt:** No OpenAPI spec for API consumers.

**Fix:** Add `@fastify/swagger` with route annotations.

---

### 15. Dashboard Not Mobile Responsive
**Location:** `apps/web/src/app/dashboard/`

**Debt:** Layout optimized for desktop.

**Fix:** Add mobile-responsive breakpoints.

---

## Tech Debt Matrix

| Item | Priority | Effort | Risk if Delayed |
|------|----------|--------|------------------|
| Command resolution | HIGH | 1 day | Moderation broken |
| Replay protection | HIGH | 1 day | Security risk |
| Per-IP rate limit | HIGH | 1 day | DoS risk |
| Worker testing | HIGH | 2 days | Production failures |
| API Prometheus | MEDIUM | 1 day | No observability |
| Policy caching | MEDIUM | 1 day | Performance degradation |
| Redis Cluster | LOW | 3 days | Scalability |
| K8s | LOW | 1 week | Manual ops |
| Slow mode | LOW | 1 day | Incomplete feature |
| Homoglyph | LOW | 1 day | Security gap |

---

## Recommendations

1. **v0.2.0 must include:** Items 1-5 (all HIGH)
2. **v0.3.0 must include:** Items 6-10 (MEDIUM)
3. **Backlog:** Items 11-15 (LOW)

**Do not let HIGH items accumulate.** Each one compounds the others.