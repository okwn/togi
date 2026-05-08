# PERFORMANCE_MODEL.md

## Latency Targets

| Operation | Target p50 | Target p95 | Max |
|-----------|------------|------------|-----|
| Webhook receive | < 50ms | < 120ms | 200ms |
| Fast path decision | < 5ms | < 20ms | 50ms |
| Redis flood check | < 2ms | < 50ms | 100ms |
| Redis policy lookup | < 2ms | < 50ms | 100ms |
| Telegram action dispatch | < 100ms | < 500ms | 2000ms |
| Database write (async) | < 20ms | < 100ms | 200ms |
| Async ML analysis | < 500ms | < 5000ms | 10000ms |

## Throughput Targets

| Component | Normal | Peak |
|-----------|--------|------|
| API webhook receiver | 500 req/s | 1000 req/s |
| Fast path decisions | 500/s | 1000/s |
| Async analysis queue | 50/s | 200/s |
| Redis operations | 5000/s | 10000/s |

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

1. **No DB Calls** - All data in Redis
2. **Sliding Window** - O(1) rate limit check
3. **Hash-based Lookups** - O(1) policy match
4. **Pipeline Operations** - Batch Redis commands

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

1. **Telegram API** - Max 30 msg/sec per chat (hard limit)
2. **Redis Memory** - 256MB limit under load
3. **PostgreSQL Writes** - Async path only
4. **Worker Concurrency** - 10 parallel jobs max

## Monitoring Metrics

```prometheus
# Fast Path
togi_fastpath_decisions_total{result="pass|block"}[5m]
togi_fastpath_latency_seconds{quantile="0.95"}[5m]

# Redis
togi_redis_operations_total{op}[5m]
togi_redis_latency_seconds{quantile="0.95"}[5m]

# API
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

| Queue | p50 | p95 | Max |
|-------|-----|-----|-----|
| async-analysis | < 500ms | < 5000ms | 10000ms |
| audit-events | < 20ms | < 100ms | 200ms |
| domain-intel | < 200ms | < 1000ms | 2000ms |
| raid-correlation | < 100ms | < 500ms | 1000ms |
| action-retry | < 100ms | < 500ms | 2000ms |

### AI Classification Timeout

When AI_PROVIDER is set to openai or local:
- Timeout: 1200ms (hard limit)
- Fallback: Local heuristic classification
- Webhook never waits for AI - fire-and-forget pattern

### Worker Metrics

Worker exposes Prometheus metrics on port 9090:
```
togi_worker_jobs_completed_total{queue}[5m]
togi_worker_jobs_failed_total{queue}[5m]
togi_worker_processing_duration_seconds{queue,quantile="0.95"}[5m]
togi_worker_queue_latency_seconds{queue}[5m]
togi_worker_ai_timeout_total[5m]
```
