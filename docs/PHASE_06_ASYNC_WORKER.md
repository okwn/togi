# Phase 06: TOGI Async Worker Pipeline

## Overview

The TOGI async worker pipeline provides background processing for operations that must not block the Telegram fast-path. It uses BullMQ with Redis to manage job queues with configurable concurrency, retry logic, and graceful shutdown.

## Architecture

### Queues

| Queue Name | Purpose | Max Concurrency | Retry Attempts |
|------------|---------|-----------------|-----------------|
| `async-analysis` | Async content analysis after fast-path check | 10 | 3 |
| `action-retry` | Retry failed Telegram bot actions | 5 | 10 |
| `audit-events` | Audit log persistence | 20 | 3 |
| `domain-intel` | Domain intelligence analysis | 5 | 2 |
| `raid-correlation` | Raid signal correlation and auto-lockdown | 5 | 2 |

### Job Types

```typescript
interface AsyncAnalysisJob {
  messageId: string;
  groupId: string;
  content: string;
  senderTelegramUserId: string;
  timestamp: number;
}

interface ActionRetryJob {
  action: string;
  chatId: string;
  messageId?: string;
  attempt: number;
  payload: Record<string, unknown>;
}

interface AuditEventJob {
  groupId: string;
  actorTelegramUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

interface DomainIntelJob {
  eventId: string;
  links: string[];
}

interface RaidCorrelationJob {
  groupId: string;
  eventIds: string[];
}
```

## AI Classification

AI classification is optional and controlled by `AI_PROVIDER` environment variable:

- `none` - Local heuristic classification only (default)
- `openai` - OpenAI GPT-4 classification
- `local` - Local model via Ollama

When AI is enabled, analysis jobs timeout after 1200ms and fall back to local classification.

## Domain Intelligence

The domain-intel processor analyzes URLs for:

- **Punycode/Homograph detection** - Detects IDN homograph attacks
- **Suspicious TLDs** - .xyz, .top, .club, .work, .click, .link, .buzz, .win, .date, .racing
- **URL shorteners** - Detects common URL shorteners
- **Domain spikes** - Redis-based rate limiting to detect anomalous domain mention rates

## Raid Correlation

Raid correlation identifies coordinated spam/raid attacks by:

1. Tracking cross-group event patterns
2. Detecting threshold breaches (>50 users mentioned OR >100 messages in <30s)
3. Auto-lockdown option via `RAID_AUTO_LOCKDOWN=true`

## Metrics

Metrics are exposed on `WORKER_METRICS_PORT` (default 9090):

- `worker_jobs_processed_total` - Total processed jobs by queue
- `worker_jobs_failed_total` - Total failed jobs by queue
- `worker_queue_latency_seconds` - Queue wait time histogram
- `worker_processing_duration_seconds` - Processing duration histogram (p95)
- `worker_ai_timeout_total` - AI timeout count
- `worker_action_retry_total` - Action retry attempts
- `worker_raid_signal_total` - Raid signals detected

## Running the Worker

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start worker
pnpm --filter togi-worker dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `AI_PROVIDER` | `none` | AI provider (none/openai/local) |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `AI_TIMEOUT_MS` | `1200` | AI timeout in milliseconds |
| `WORKER_METRICS_PORT` | `9090` | Metrics HTTP server port |
| `RAID_AUTO_LOCKDOWN` | `false` | Enable auto-lockdown on raid detection |
| `LOCKDOWN_THRESHOLD_USERS` | `50` | User threshold for auto-lockdown |
| `LOCKDOWN_THRESHOLD_MESSAGES` | `100` | Message threshold for auto-lockdown |
| `LOCKDOWN_WINDOW_SECONDS` | `30` | Time window for threshold calculation |

## Graceful Shutdown

On SIGTERM/SIGINT signals:
1. Stop accepting new jobs
2. Wait for active jobs to complete (up to 30s)
3. Close Redis connections
4. Exit process