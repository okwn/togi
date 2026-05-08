# ARCHITECTURE.md

## System Overview

TOGI uses a webhook-first architecture to receive Telegram updates with minimal latency. The system processes messages through two paths: a fast synchronous path for real-time decisions, and an asynchronous path for complex analysis.

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM API                            │
│                    (Webhooks to API Server)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FAST PATH (Sync)                              │
│  ┌─────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────┐  │
│  │ Webhook │──▶│ Rate Limit │──▶│ Flood    │──▶│ Link Check  │ │
│  │ Handler │   │  (Redis)   │   │ Check    │   │  (Blocklist)│ │
│  └─────────┘   └────────────┘   └──────────┘   └──────┬──────┘  │
│                                                        │         │
│                       ┌────────────────────────────────┼──────┐ │
│                       │                                │      │ │
│                       ▼                                ▼      │ │
│               ┌──────────────┐                   ┌──────────┐   │ │
│               │   DECISION  │                   │  PASS    │   │ │
│               │  (Block/No) │                   │  (Allow) │   │ │
│               └──────┬───────┘                   └─────────┘   │ │
│                      │                                          │ │
└──────────────────────┼──────────────────────────────────────────┘ │
                       │                                            │
                       ▼                                            │
┌─────────────────────────────────────────────────────────────────┐
│              ACTION EXECUTOR (Telegram API)                     │
│  Ban / Mute / Delete / Warn / Notify                            │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              ASYNC PATH (Background Worker)                     │
│  ┌────────────┐   ┌─────────────┐   ┌──────────────┐           │
│  │   BullMQ   │──▶│    ML       │──▶│  Security    │           │
│  │   Queue    │   │  Analysis   │   │    Score     │           │
│  └────────────┘   └─────────────┘   └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### API Server (`apps/api`)
- **Framework**: Fastify (high-performance HTTP)
- **Responsibility**: Webhook receiver, REST API, action dispatch
- **Port**: Read from `API_PORT` env var (default 4310)

### Web Dashboard (`apps/web`)
- **Framework**: Vite + React 18
- **Responsibility**: Group management UI, policy editor, audit logs
- **Port**: Read from `WEB_PORT` env var (default 4320)

### Worker (`apps/worker`)
- **Framework**: BullMQ + Redis
- **Responsibility**: Async analysis, score calculation, reports
- **Metrics Port**: Read from `WORKER_METRICS_PORT` (default 4390)

### Packages

| Package | Purpose |
|---------|---------|
| `shared` | Common types, constants, utilities |
| `config` | Environment variable management |
| `db` | PostgreSQL client, migrations, queries |
| `telegram-client` | Telegram Bot API wrapper |
| `policy-engine` | Rule evaluation and policy matching |
| `detection-engine` | Flood, link, spam, threat detection algorithms |

## Data Flow

### Webhook Update Flow
1. Telegram sends POST to `/webhooks/telegram`
2. API verifies `X-Telegram-Bot-Api-Secret-Token` header
3. API normalizes the update to internal event model
4. Fast path executes (flood → link → pattern) - Phase 03+
5. If blocked: Execute action via Telegram API
6. Enqueue event for async processing (audit, score) via BullMQ
7. Return 200 within 60s (Telegram requirement)

### Webhook Processing (Phase 01)
- **Target**: < 120ms p95
- Fast deterministic checks only
- No ML or heavy analysis in webhook path
- No blocking database operations
- Event normalization for consistent processing

### Message Processing (Fast Path)
- **Target**: < 20ms p95
- **Redis operations**: < 50ms p95
- **No database queries** in fast path
- **All hot data** in Redis cache

### Async Analysis Flow
1. Message queued to BullMQ
2. Worker picks up job
3. ML model analyzes content
4. Security score updated
5. Report generated if needed

## Caching Strategy

| Data | Cache Location | TTL |
|------|---------------|-----|
| Group settings | Redis | 5 min |
| Policies | Redis | 5 min |
| Rate counters | Redis | 60 sec |
| Blocklists | Redis | 1 hour |

## Database Schema (PostgreSQL)

```sql
groups (id, telegram_chat_id, title, username, settings, security_score, created_at, updated_at)
users (id, telegram_user_id, username, first_name, last_name, created_at)
policies (id, group_id, name, type, config, enabled, created_at, updated_at)
audit_log (id, group_id, user_id, action, reason, severity, metadata, created_at)
incidents (id, group_id, user_id, type, severity, details, resolved, created_at)
```
