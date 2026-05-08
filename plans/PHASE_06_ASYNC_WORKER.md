# PHASE_06_ASYNC_WORKER.md - Async Worker

## Objectives

- [ ] BullMQ queue setup
- [ ] Async message analysis job
- [ ] Security score calculation job
- [ ] Report generation job
- [ ] Periodic cleanup job
- [ ] Worker metrics endpoint

## Queue Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BullMQ Redis                         │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  analysis    │  │   report    │  │  cleanup    │   │
│  │   queue      │  │   queue      │  │   queue      │   │
│  │  (priority)  │  │  (scheduled)│  │  (scheduled) │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │           │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Worker Process                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Analysis   │  │  Report     │  │  Cleanup    │   │
│  │  Processor  │  │  Generator   │  │  Job        │   │
│  │  (10 concurrent)            │  │  (hourly)  │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Queue Types

### Analysis Queue
- **Name**: `analysis`
- **Priority**: 1-10 (1 = highest)
- **Concurrency**: 10 workers
- **Retry**: 3 attempts with exponential backoff
- **Job TTL**: 5 minutes

### Report Queue
- **Name**: `reports`
- **Schedule**: Daily at midnight (configurable)
- **Concurrency**: 2 workers
- **Job TTL**: 1 hour

### Cleanup Queue
- **Name**: `cleanup`
- **Schedule**: Hourly
- **Job**: Delete audit logs > 90 days

## Job Types

### MessageAnalysisJob
```typescript
interface MessageAnalysisJob {
  messageId: string;
  chatId: string;
  userId: string;
  content: string;
  timestamp: number;
  entities?: TelegramMessageEntity[];
}
```
Processing:
1. Extract features (URLs, patterns, language)
2. Run ML classifier (future) or pattern match
3. Update user risk score
4. If high risk, create incident

### SecurityScoreJob
```typescript
interface SecurityScoreJob {
  groupId: string;
  period: 'day' | 'week' | 'month';
}
```
Processing:
1. Count incidents in period
2. Calculate average severity
3. Check policy coverage
4. Compute score (0-100)
5. Update group record

### ReportJob
```typescript
interface ReportJob {
  groupId: string;
  type: 'daily' | 'weekly' | 'incident';
  format: 'summary' | 'detailed';
}
```
Processing:
1. Aggregate data from PostgreSQL
2. Generate report content
3. Send via configured channel (email/webhook)

## Worker Metrics (Port 4390)

```prometheus
# Queue metrics
togi_worker_queue_depth{queue="analysis"} 42
togi_worker_queue_depth{queue="reports"} 0
togi_worker_processing{queue="analysis"} 3

# Job metrics
togi_worker_jobs_completed_total{queue="analysis", job_type="analysis"} 1523
togi_worker_jobs_failed_total{queue="analysis", job_type="analysis"} 12
togi_worker_job_duration_seconds{queue="analysis", quantile="0.95"} 0.345

# Redis metrics
togi_redis_commands_total 5042
togi_redis_latency_seconds{quantile="0.95"} 0.002
```

## Dependencies
- Phase 05: Web Dashboard (API)
- Phase 02: Database

## Verification
```bash
# Start worker
pnpm run dev:worker

# Check metrics
curl http://localhost:4390/metrics | grep togi_worker

# Add test job
curl -X POST http://localhost:4390/test/job \
  -H "Content-Type: application/json" \
  -d '{"type": "analysis", "data": {"messageId": "test", "chatId": "123", "userId": "456"}}'
```

## Status: PENDING
