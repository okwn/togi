# Scaling Gaps

## CRITICAL — No Horizontal Scaling Path

**Issue:** No Kubernetes manifests, no PM2 cluster configuration.

**Current:** Single API instance, single worker instance.

**Impact:** Cannot handle >1000 concurrent users or >500 groups.

---

## MEDIUM — Redis Cluster Missing

**Status:** NOT PLANNED until v1.3.0

**Gap:** Single Redis instance is SPOF and cannot scale writes.

**Current:** Redis 7 standalone on single instance.

**Performance Target:** 5000 ops/s but single connection may bottleneck.

---

## MEDIUM — PostgreSQL Read Replicas Missing

**Status:** NOT PLANNED until v1.3.0

**Gap:** All reads and writes go to single PostgreSQL instance.

**Impact:** Policy lookups on every message add latency.

---

## MEDIUM — No Connection Pooling at API Level

**Location:** `packages/db/src/client.ts`

**Issue:** Drizzle pool but no query batching or prepared statements.

---

## LOW — BullMQ Queue Depth Unlimited

**Location:** `apps/worker/src/queues/connection.ts`

**Issue:** No max queue size limit. Under attack, queue could grow unbounded.

**Fix:** Set `maxSize` on queues or implement queue overflow alerts.

---

## LOW — No CDN for Dashboard Assets

**Location:** Next.js static export not configured.

**Impact:** Dashboard loads slowly for distant users.

---

## LOW — No API Rate Limit Headers

**Location:** `apps/api/src/routes/webhook.ts`

**Issue:** Rate limiter tracks state but doesn't return `X-RateLimit-*` headers.

**UX:** API consumers can't know when they'll be rate limited.

---

## Infrastructure Scaling Path

| Component | Current | v1.3.0 Target |
|-----------|---------|----------------|
| API | Single Fastify | K8s HPA |
| Worker | Single BullMQ | K8s HPA |
| Redis | Standalone | Redis Cluster |
| PostgreSQL | Standalone | Primary + 2 replicas |
| Dashboard | Next.js | Static export + CDN |

---

## Memory Estimates at Scale

| Scale | Groups | Users | Redis Memory | PostgreSQL Memory |
|-------|--------|-------|--------------|-------------------|
| Current | <100 | <10K | <50MB | <100MB |
| v1.0 Target | <1000 | <100K | <200MB | <500MB |
| v2.0 Target | <10K | <1M | <1GB | <4GB |

**Note:** No measurements taken at any scale.