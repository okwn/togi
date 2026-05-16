# PERFORMANCE_MODEL.md

## Latency Targets

| Operation | Target p50 | Target p95 | Max | Status |
|-----------|------------|------------|-----|--------|
| Webhook receive | < 50ms | < 120ms | 200ms | **NOT VALIDATED** |
| Fast path decision | < 5ms | < 20ms | 50ms | **NOT VALIDATED** |
| Redis flood check | < 2ms | < 50ms | 100ms | **NOT VALIDATED** |
| Redis policy lookup | < 2ms | < 50ms | 100ms | **NOT VALIDATED** |
| Telegram action dispatch | < 100ms | < 500ms | 2000ms | **NOT VALIDATED** |
| Database write (async) | < 20ms | < 100ms | 200ms | **NOT VALIDATED** |
| Async ML analysis | < 500ms | < 5000ms | 10000ms | N/A (not implemented) |

## Throughput Targets

| Component | Normal | Peak | Status |
|-----------|--------|------|--------|
| API webhook receiver | 500 req/s | 1000 req/s | **NOT VALIDATED** |
| Fast path decisions | 500/s | 1000/s | **NOT VALIDATED** |
| Async analysis queue | 50/s | 200/s | **NOT VALIDATED** |
| Redis operations | 5000/s | 10000/s | **NOT VALIDATED** |

## Resource Allocation

### API Server
- **CPU**: 2 vCPU
- **Memory**: 512MB
- **Connection Pool**: 20 PostgreSQL connections

### Worker
- **CPU**: 1 vCPU
- **Memory**: 256MB
- **Queue Concurrency**: 10 parallel jobs

### PostgreSQL
- **Memory**: 512MB shared buffers
- **Max Connections**: 30
- **Work Memory**: 64MB

### Redis
- **Memory**: 256MB max
- **Max Connections**: 50
- **Persistence**: RDB + AOF

## Fast Path Optimization

The fast path is optimized for sub-20ms decisions:

1. **No DB Calls** — All data in Redis (CURRENT: DB writes happen on violations — TECH DEBT)
2. **Sliding Window** — O(1) rate limit check
3. **Hash-based Lookups** — O(1) policy match (CURRENT: Policy lookup hits DB — TECH DEBT)
4. **Pipeline Operations** — Batch Redis commands

```
Fast Path Timeline:

t=0ms    Receive webhook
t=5ms    Parse message, extract URLs/patterns
t=10ms   Redis flood check (sliding window)
t=15ms   Redis link blocklist check
t=20ms   Decision: PASS/BLOCK
t=25ms   If block: Execute Telegram action
t=50ms   Webhook response sent
```

## Bottlenecks

1. **Telegram API** — Max 30 msg/sec per chat (hard limit)
2. **Redis Memory** — 256MB limit under load (CURRENT: Single instance, no Cluster)
3. **PostgreSQL Writes** — Async path only (CURRENT: Fast path includes DB write — TECH DEBT)
4. **Worker Concurrency** — 10 parallel jobs max

## Monitoring Metrics

**STATUS: PARTIAL**

- Worker exposes Prometheus metrics on port 4390 ✅
- API does NOT expose Prometheus metrics ❌

```prometheus
# Fast Path
togi_fastpath_decisions_total{result="pass|block"}[5m]
togi_fastpath_latency_seconds{quantile="0.95"}[5m]

# Redis
togi_redis_operations_total{op}[5m]
togi_redis_latency_seconds{quantile="0.95"}[5m]

# API — NOT IMPLEMENTED
togi_webhook_requests_total[5m]
togi_webhook_latency_seconds{quantile="0.95"}[5m]

# Worker
togi_worker_queue_depth[5m]
togi_worker_jobs_completed_total[5m]
togi_worker_jobs_failed_total[5m]
```

## Graceful Degradation

If Redis is unavailable:
- Fail open (allow messages) with warning log
- Fallback to async DB-based checking

If Telegram API fails:
- Queue failed actions for retry
- Do not block webhook response
- Log error, alert via monitoring

## Async Worker Pipeline

The worker handles non-blocking operations via BullMQ queues.

### Queue Latency Targets

| Queue | p50 | p95 | Max | Status |
|-------|-----|-----|-----|--------|
| async-analysis | < 500ms | < 5000ms | 10000ms | **NOT VALIDATED** |
| audit-events | < 20ms | < 100ms | 200ms | **NOT VALIDATED** |
| domain-intel | < 200ms | < 1000ms | 2000ms | **NOT VALIDATED** |
| raid-correlation | < 100ms | < 500ms | 1000ms | **NOT VALIDATED** |
| action-retry | < 100ms | < 500ms | 2000ms | **NOT VALIDATED** |

### AI Classification Timeout

When AI_PROVIDER is set to openai or local:
- Timeout: 1200ms (hard limit)
- Fallback: Local heuristic classification
- Webhook never waits for AI - fire-and-forget pattern

**STATUS:** AI integration not yet implemented

### Worker Metrics

Worker exposes Prometheus metrics on port 9090:
```
togi_worker_jobs_completed_total{queue}[5m]
togi_worker_jobs_failed_total{queue}[5m]
togi_worker_processing_duration_seconds{queue,quantile="0.95"}[5m]
togi_worker_queue_latency_seconds{queue}[5m]
togi_worker_ai_timeout_total[5m]
```

---

## Performance Audit Findings (2026-05-16)

### CRITICAL — Not Validated
1. **Fast path <20ms p95 claim** — No load test validates this
2. **Webhook <50ms p50 claim** — No load test validates this
3. **500 req/s throughput** — No load test validates this

### MEDIUM — Implementation Issues
4. **Policy lookup hits DB** — Fast path should be Redis-only
5. **Violations write on fast path** — DB write adds latency
6. **Redis single connection** — May bottleneck at scale
7. **BullMQ untested** — Processors never validated at runtime

### MEDIUM — Missing Monitoring
8. **API Prometheus metrics missing** — No observability on API layer
9. **No dashboard for worker metrics** — Grafana not configured

### LOW — Architecture
10. **Single API instance** — No horizontal scaling path
11. **Single Redis instance** — No Cluster mode

---

## Load Testing Requirements

Before production release, validate:

```bash
# 1. Fast path latency
k6 run tests/load/fast-path.js --duration=60s --vus=100

# 2. Webhook throughput
k6 run tests/load/webhook.js --duration=60s --vus=500

# 3. Redis throughput
redis-benchmark -n 10000 -t set,rget

# 4. PostgreSQL write throughput
pgbench -c 10 -t 1000 -r togi
```

### Performance Validation Checklist

```
[ ] Fast path p95 < 20ms (target)
[ ] Webhook p50 < 50ms (target)
[ ] API 500 req/s sustained (1 minute)
[ ] Redis 5000 ops/s sustained
[ ] No memory leaks after 1 hour
[ ] Graceful degradation tested (Redis failure)
```