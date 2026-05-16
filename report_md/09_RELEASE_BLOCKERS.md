# Release Blockers

## Items Required Before Public Release

### 1. Production Authentication — **CRITICAL**

**What:** Implement Telegram Login Widget for dashboard auth.

**Where:** `apps/api/src/middleware/auth.ts:138`

**Why:** Currently returns 401 in production — dashboard unusable.

**Effort:** 2-3 days

---

### 2. Webhook Replay Protection — **CRITICAL**

**What:** Implement update ID deduplication in Redis.

**Where:** `apps/api/src/routes/webhook.ts`

**Why:** SECURITY_MODEL.md promises this; without it, replay attacks possible.

**Effort:** 1 day

---

### 3. Dockerfiles — **CRITICAL**

**What:** Create Dockerfiles for apps/api, apps/web, apps/worker.

**Where:** `docker-compose.yml` references non-existent files at `apps/*/Dockerfile`

**Why:** Cannot deploy without containerization.

**Effort:** 1-2 days

---

### 4. CI/CD Pipeline — **HIGH**

**What:** GitHub Actions workflow with test automation.

**Where:** `.github/workflows/`

**Why:** Code can be merged without running tests.

**Effort:** 2 days

---

### 5. Per-IP Rate Limiting — **HIGH**

**What:** Add IP-based rate limiting middleware.

**Where:** `apps/api/src/middleware/security.ts`

**Why:** Single IP can exhaust API resources.

**Effort:** 1 day

---

### 6. RBAC Enforcement — **HIGH**

**What:** Add group admin verification middleware.

**Where:** `apps/api/src/routes/groups.ts`

**Why:** Any API caller can modify any group's policies.

**Effort:** 2 days

---

### 7. Load Testing Validation — **HIGH**

**What:** Validate PERFORMANCE_MODEL.md claims with k6/Artillery.

**Where:** `scripts/` or `tests/load/`

**Why:** No evidence fast path achieves <20ms under load.

**Effort:** 2-3 days

---

### 8. Command Target Resolution — **MEDIUM**

**What:** Fix `/warn`, `/mute`, `/ban` commands to resolve target users.

**Where:** `apps/api/src/routes/webhook.ts:601-885`

**Why:** Moderation commands silently fail.

**Effort:** 1 day

---

### 9. BullMQ Runtime Testing — **MEDIUM**

**What:** Verify all 5 processors work under load.

**Where:** `apps/worker/src/processors/`

**Why:** Processors exist but untested in production conditions.

**Effort:** 2 days

---

### 10. Join Request Screening — **MEDIUM**

**What:** Route join requests through detection engine.

**Where:** `apps/api/src/routes/webhook.ts:519-531`

**Why:** New member protection only works for messages, not join requests.

**Effort:** 2-3 days

---

## Nice-to-Have (Can Ship Without)

- Unicode/homoglyph detection (LOW risk)
- Prometheus metrics on API (LOW impact)
- Redis Cluster (v1.3.0 item)
- Slow mode integration (v0.8.0 incomplete)
- LLM integration (future phase)

---

## Release Criteria Checklist

```
PRE-RELEASE BLOCKERS:
[ ] Telegram Login Widget auth implemented
[ ] Webhook replay protection implemented
[ ] Dockerfiles created for all 3 apps
[ ] CI/CD pipeline with test automation
[ ] Per-IP rate limiting enforced
[ ] RBAC middleware verifying group admin
[ ] Load tests demonstrate <20ms p95 fast path
[ ] Join request screening implemented
[ ] Moderation commands resolve targets correctly
[ ] BullMQ processors tested under load

NON-BLOCKING (v0.2.0):
[ ] Prometheus metrics on API
[ ] Homoglyph/IDN detection
[ ] Redis Cluster for HA
[ ] Slow mode integration
[ ] LLM integration for async analysis
```