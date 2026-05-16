# TOGI Scaling Guide

## Overview

TOGI is designed to scale horizontally across multiple instances. This document covers scaling considerations for database, Redis, queues, and multi-instance deployment.

---

## Database

### Connection Pooling with pgBouncer

For production deployments with high message volume, use pgBouncer as a connection pooler.

**docker-compose.pgbouncer.yml:**

```yaml
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgres://togi:${POSTGRES_PASSWORD}@postgres:5432/togi
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 500
      DEFAULT_POOL_SIZE: 25
      MIN_POOL_SIZE: 5
      RESERVE_POOL_SIZE: 10
      RESERVE_POOL_TIMEOUT: 3
      SERVER_IDLE_TIMEOUT: 600
    ports:
      - "5433:5432"
    depends_on:
      - postgres
    restart: unless-stopped
```

**Pool sizing recommendations:**

| Users | Max Connections | Default Pool | Reserved Pool |
|-------|-----------------|--------------|--------------|
| < 1000 | 100 | 20 | 5 |
| 1000–10000 | 200 | 25 | 10 |
| 10000+ | 500 | 30 | 15 |

**Configuration for API:**

```bash
POSTGRES_HOST=pgbouncer
POSTGRES_PORT=5433
```

### Index Verification

Run this query to verify all required indexes exist:

```sql
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN (
  'groups', 'violations', 'audit_logs', 'message_fingerprints',
  'threat_indicators', 'user_risk_profiles', 'group_user_profiles'
);
```

### Required Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| groups | telegram_chat_id | Fast group lookup by Telegram chat ID |
| violations | (group_id, created_at) | Group violation queries with time filter |
| audit_logs | (group_id, created_at) | Group audit log queries with time filter |
| message_fingerprints | text_hash | Duplicate message detection |
| threat_indicators | (type, value_hash) | Threat lookup by type and hash |
| user_risk_profiles | telegram_user_id | User risk profile lookup |
| group_user_profiles | (group_id, telegram_user_id) | Per-group user profile lookup |

---

## Redis

### Key Naming Conventions

All Redis keys use the following patterns for cluster compatibility:

| Pattern | Purpose | Hash Tag |
|---------|---------|----------|
| `rate:user:{chatId}:{userId}` | Per-user rate limiting | None |
| `duplicate:{chatId}:{hash}` | Duplicate detection | None |
| `action_lock:{chatId}:{messageId}:{action}` | Action idempotency | `{chatId}` |
| `update_state:{updateId}` | Webhook idempotency | None |
| `update_lock:{updateId}` | Webhook processing lock | None |
| `policy_cache:{chatId}` | Policy caching | `{chatId}` |
| `captcha:{nonce}` | Captcha verification | None |

### Redis Cluster Compatibility

**CRITICAL:** When using Redis Cluster, keys that need to be in the same slot must use hash tags (curly braces around a consistent part).

**Example of correct hashing:**

```
# Good: {chatId} ensures all keys for same chat are in same slot
action_lock:{123456}:789:ban
policy_cache:{123456}

# Bad: keys may be in different slots (cannot use MGET/MSET across cluster)
action_lock:123456:789:ban
policy_cache:123456
```

**Current key patterns review:**

```typescript
// Uses {chatId} hash tag — cluster safe
actionLock: (chatId, messageId, action) => `action_lock:${chatId}:${messageId}:${action}`,
policyCache: (chatId) => `policy_cache:${chatId}`,
permissionsCache: (chatId) => `permissions_cache:${chatId}`,

// No hash tag — cluster safe but cannot use multi-key operations
rate: (chatId, userId) => `rate:user:${chatId}:${userId}`,
duplicate: (chatId, hash) => `duplicate:${chatId}:${hash}`,
```

### Connection Retry and Backoff

```typescript
const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['ECONNREFUSED', 'ETIMEDOUT'];
    return targetErrors.some(e => err.message.includes(e));
  },
});
```

### Redis Degraded Mode

When Redis is unavailable, the system can operate in two modes:

- `fail_open`: Allow requests through without caching/rate limiting (higher risk, higher availability)
- `fail_closed`: Reject requests that require Redis (lower risk, lower availability)

```typescript
// In config
REDIS_DEGRADED_MODE=fail_open  // Default

// Usage in code
if (redis.status !== 'ready' && env.REDIS_DEGRADED_MODE === 'fail_open') {
  // Proceed without Redis
}
```

---

## Queue Priority and Configuration

### Priority Levels

Queues are configured with different priority levels for BullMQ:

| Priority | Queue | Use Case | Concurrency |
|----------|-------|----------|-------------|
| 1 (HIGHEST) | critical-actions | Ban, mute, delete actions | 5 |
| 2 (HIGH) | async-analysis | Content analysis | 5 |
| 3 (MEDIUM) | report-generation | Report creation | 2 |
| 4 (NORMAL) | media-analysis, domain-intel | Media and domain analysis | 3 |
| 5 (LOW) | low-priority-intel | Background intelligence | 2 |
| 6 (LOWEST) | scheduled-reports | Scheduled report generation | 1 |

### Dead Letter Queue

Failed jobs after max attempts move to dead letter queue:

```typescript
const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },  // Retain for debugging
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};
```

### Job Cleanup Policy

- Completed jobs: Remove after 1000 completed per queue
- Failed jobs: Remove after 5000 failed per queue
- Stale locks: 30 second TTL on job locks

---

## Multi-Instance Deployment

### Webhook Idempotency

Webhooks are idempotent using Redis:

1. `checkUpdate()` - Returns if update already processed (24h TTL)
2. `tryClaimUpdate()` - Atomically claims update using Lua script
3. `markProcessed()` - Marks as processed, releases lock

### Action Locks

Actions (ban, mute, warn) use distributed locks:

```typescript
const locked = await idempotencyService.tryLockAction(chatId, messageId, actionType);
if (!locked) {
  // Action already executed, skip
  return;
}
```

Lock TTL: 5 minutes. Prevents duplicate actions across instances.

### Scheduled Job Distributed Lock

Prevent duplicate scheduled job execution across instances:

```typescript
// Distributed lock for scheduled reports
async function acquireScheduledJobLock(jobName: string, ttlSeconds: number = 300): Promise<boolean> {
  const key = `scheduled_lock:${jobName}`;
  const result = await redis.set(key, process.pid.toString(), 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function releaseScheduledJobLock(jobName: string): Promise<void> {
  const key = `scheduled_lock:${jobName}`;
  await redis.del(key);
}
```

**Usage:**

```typescript
const lockAcquired = await acquireScheduledJobLock('weekly_report', 300);
if (!lockAcquired) {
  console.log('Another instance is running weekly report, skipping');
  return;
}

try {
  await generateWeeklyReport();
} finally {
  await releaseScheduledJobLock('weekly_report');
}
```

### Agent Run Distributed Lock

```typescript
const AGENT_RUN_LOCK_TTL = 600; // 10 minutes

async function acquireAgentRunLock(groupId: string): Promise<boolean> {
  const key = `agent_run_lock:${groupId}`;
  return await redis.set(key, process.pid.toString(), 'EX', AGENT_RUN_LOCK_TTL, 'NX') === 'OK';
}
```

---

## Observability

### Metrics Endpoint

Prometheus-format metrics available at `/metrics`:

```
# DB metrics
db_query_duration_seconds{operation="select",table="groups"}
db_query_duration_seconds{operation="insert",table="violations"}

# Redis metrics
redis_command_duration_seconds{command="get"}
redis_command_duration_seconds{command="set"}
redis_connection_status{status="connected"}

# Queue metrics
queue_jobs_total{queue="async-analysis",status="completed"}
queue_jobs_total{queue="async-analysis",status="failed"}
queue_jobs_pending{queue="async-analysis"}

# Telegram API metrics
telegram_api_errors_total{error="rate_limit"}
telegram_api_errors_total{error="timeout"}
telegram_api_duration_seconds{operation="sendMessage"}
```

### Health Check

```bash
curl http://localhost:4310/health | jq .
# Response:
{
  "status": "ok",
  "postgres": "connected",
  "redis": "connected",
  "uptime": 86400
}
```

---

## Load Testing

Target metrics:

- Webhook receive: < 50ms p50, < 120ms p95
- Fast path decision: < 5ms p50, < 20ms p95
- API throughput: 500 req/s normal, 1000 req/s peak

Run load test:

```bash
# Using oha or wrk
oha -n 10000 -c 100 -d 30s http://localhost:4310/webhooks/telegram
```

---

## Kubernetes (Future)

For Kubernetes deployment, see `docs/KUBERNETES_NOTES.md`.

---

## Migration Safety

### Before Running Migrations

1. **Backup the database:**
   ```bash
   docker exec togi-postgres pg_dump -U togi togi > backup_pre_migration.sql
   ```

2. **Check table sizes:**
   ```sql
   SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;
   ```

3. **Add indexes concurrently (PostgreSQL 11+):**
   ```sql
   CREATE INDEX CONCURRENTLY idx_violations_group_created
   ON violations(group_id, created_at);
   ```

### Dangerous Operations

DO NOT execute without explicit approval:

- `DROP TABLE`
- `DROP COLUMN`
- `ALTER TABLE DROP`
- `TRUNCATE`
- `DELETE FROM` without WHERE

Safe alternatives:

- Add new column (additive)
- Add new index (non-blocking)
- Create new table (migrate data)
- Rename (use transaction)

---

## Performance Troubleshooting

### High DB latency

1. Check for missing indexes: `EXPLAIN ANALYZE` on slow queries
2. Check connection pool: `SHOW POOLS` in pgBouncer
3. Check long-running transactions: `SELECT * FROM pg_stat_activity WHERE state = 'active'`

### High Redis latency

1. Check slow commands: `SLOWLOG GET 10`
2. Check memory: `INFO memory`
3. Check cluster rebalancing

### Queue backlog

1. Check job counts: BullMQ dashboard or Redis `LLEN` on queue keys
2. Check failed jobs: Dead letter queue
3. Scale workers: Increase concurrency for affected queue

---

## Scaling Checklist

- [ ] pgBouncer configured for production
- [ ] Database indexes verified
- [ ] Redis Cluster compatible (if using cluster)
- [ ] Queue priorities configured
- [ ] Dead letter queue handling in place
- [ ] Distributed locks for scheduled jobs
- [ ] Metrics endpoint exposed
- [ ] Health check operational
- [ ] Load testing performed
- [ ] Migration safety notes reviewed