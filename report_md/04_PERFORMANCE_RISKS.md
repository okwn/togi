# Performance Risks

## CRITICAL — Performance Claims Not Validated

**Risk:** PERFORMANCE_MODEL.md claims sub-20ms fast path but no load tests exist.

| Claim | Status |
|-------|--------|
| Fast path decision < 20ms p95 | **NOT TESTED** |
| Webhook receive < 50ms p50 | **NOT TESTED** |
| 500 req/s normal, 1000 req/s peak | **NOT TESTED** |

**Validation Status:** No k6, Artillery, or Locust scripts exist.

---

## MEDIUM — Redis Connection Not Pooled

**Location:** `packages/db/src/redis.ts`

**Issue:** Redis client exported directly. Under load, connection exhaustion possible.

**Performance Target:** 5000 Redis ops/s — single connection may bottleneck.

**Fix:** Use connection pool via `ioredis` cluster mode or `redis Pool`.

---

## MEDIUM — PostgreSQL Write on Fast Path

**Location:** `apps/api/src/routes/webhook.ts:265-276`

```typescript
// Store violation if action was taken
await db.insert(violations).values({...});
```

**Issue:** Fast path includes a DB write on every blocked message. PERFORMANCE_MODEL.md says "No DB Calls" for fast path.

**Impact:** Violations write adds ~5-20ms latency under contention.

**Fix:** Move violations write to async queue.

---

## MEDIUM — BullMQ Processors Untested at Runtime

**Location:** `apps/worker/src/processors/index.ts:1-5`

**Issue:** 5 processor functions exported but never executed in production load.

**BullMQ Reliability Unknown:**
- Job deduplication not confirmed
- Retry backoff not measured
- Queue overflow handling not tested

---

## LOW — No Prometheus Metrics on API

**Location:** API server (`apps/api/src/server.ts`)

**Issue:** PERFORMANCE_MODEL.md specifies Prometheus metrics but API doesn't expose them. Only worker has metrics endpoint (port 4390).

**Missing Metrics:**
```prometheus
togi_webhook_requests_total[5m]
togi_webhook_latency_seconds{quantile="0.95"}[5m]
togi_fastpath_decisions_total{result="pass|block"}[5m]
```

---

## LOW — Telegram API Throttle Hardcoded

**Location:** `apps/api/src/middleware/security.ts:93-102`

```typescript
const globalApiThrottle = new RateLimiter({
  windowMs: 1000,
  maxRequests: 25, // Telegram limits 30 msg/sec per chat
});
```

**Issue:** Throttle is global (all chats), not per-chat. Telegram limit is per-chat, not global.

**Fix:** Per-chat throttling with 30 msg/sec limit per chatId.

---

## LOW — N+1 Query in Group Policy Lookup

**Location:** `apps/api/src/routes/webhook.ts:226-234`

```typescript
const [policy] = await db
  .select()
  .from(groupPolicies)
  .where(eq(groupPolicies.groupId, group.id))
  .orderBy()
  .limit(1);
```

**Issue:** Runs on every message. Policy should be cached in Redis with short TTL.

**Fix:** Cache policy in Redis with 60s TTL, invalidate on policy update.

---

## LOW — Action Executor Uses Sync Redis Operations

**Location:** `packages/telegram-client/src/action-executor.ts`

**Issue:** `acquireActionLock` uses `await redis.set()` — each action takes 1-2ms for Redis round-trip.

**Mitigation:** Lock TTL of 300s means lock contention rare in practice.

---

## Architecture Bottleneck — Single API Instance

**Issue:** No horizontal scaling path documented.

**Fix:** Add Kubernetes deployment (v1.3.0 roadmap item), or at minimum PM2 cluster mode.