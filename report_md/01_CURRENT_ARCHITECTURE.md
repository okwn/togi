# Current Architecture

## System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM API                            │
│  ← webhook updates (x-telegram-bot-api-secret-token)     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOGI API (Fastify)                      │
│  Port: 4310                                                 │
│  ├── POST /webhooks/telegram  ← Main webhook receiver      │
│  ├── GET  /health            ← Health check              │
│  ├── GET  /api/groups        ← Group CRUD (protected)     │
│  └── GET  /api/groups/:id/logs                           │
│                                                              │
│  Middleware:                                                 │
│  ├── RateLimiter (Redis sorted sets)                       │
│  ├── checkGroupActionRateLimit                            │
│  ├── checkUserCommandRateLimit                            │
│  └── checkGlobalApiThrottle                               │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐              ┌─────────────────────────────────┐
│  Redis (6388)   │              │      Worker (BullMQ)             │
│  ├── action_locks│             │  Port: 4390 (metrics)           │
│  ├── rate limiting│            │                                 │
│  ├── policy cache│            │  Queues:                        │
│  └── flood windows│            │  ├── async-analysis             │
└─────────────────┘              │  ├── audit-events               │
                                │  ├── domain-intel              │
                                ▼  ├── raid-correlation          │
┌─────────────────────────────┐  │  └── action-retry              │
│  PostgreSQL (5543)          │  └─────────────────────────────────┘
│  ├── users                          │
│  ├── groups                         ▼
│  ├── group_policies           ┌─────────────────────────────────┐
│  ├── violations               │      Next.js Dashboard          │
│  ├── punishments              │      Port: 4320                 │
│  ├── domain_rules            │                                 │
│  ├── audit_logs              │  Pages:                          │
│  └── review_queue            │  ├── /dashboard (overview)       │
└─────────────────────────────┘  ├── /dashboard/groups           │
                                │  ├── /dashboard/groups/:id      │
                                │  │   ├── settings               │
                                │  │   ├── permissions            │
                                │  │   ├── members                │
                                │  │   ├── logs                   │
                                │  │   ├── domains                │
                                │  │   └── review                 │
                                │  └── /                          │
                                └─────────────────────────────────┘
```

## Package Architecture

```
packages/
├── config/        ← Environment variable loading + validation
├── db/            ← Drizzle ORM client, Redis client, schema
├── detection-engine/
│   ├── fast-path-engine.ts     ← Orchestrates 8 detectors
│   ├── detectors/
│   │   ├── rate-limit-detector.ts
│   │   ├── duplicate-detector.ts
│   │   ├── link-detector.ts
│   │   ├── threat-detector.ts
│   │   ├── new-member-detector.ts
│   │   ├── mention-spam-detector.ts
│   │   ├── media-flood-detector.ts
│   │   └── raid-detector.ts
│   ├── static-lists/
│   │   ├── scam-patterns.ts
│   │   ├── suspicious-shorteners.ts
│   │   ├── suspicious-tlds.ts
│   │   └── threat-patterns.ts
│   ├── risk-score.ts
│   ├── decision-engine.ts
│   └── text-normalizer.ts
├── policy-engine/  ← Policy CRUD, rule evaluation, defaults
├── shared/         ← normalizeUpdate, hashText, safeEventMetadata
└── telegram-client/
    ├── action-executor.ts  ← Idempotent Telegram action execution
    └── types.ts

apps/
├── api/           ← Fastify webhook receiver + REST API
├── web/           ← Next.js 14 App Router dashboard
└── worker/        ← BullMQ async job processors
```

## Data Flow

### Fast Path (Sync, <20ms target)

```
1. Webhook receives Telegram update
2. Verify secret token (X-Telegram-Bot-Api-Secret-Token)
3. normalizeUpdate() → extract event type, chatId, userId, text, links
4. Run fast-path-engine (8 detectors, no external calls)
5. If action required → TelegramActionExecutor.executeDecision()
6. Write violation to DB (if action taken)
7. Return 200 to Telegram immediately
```

### Async Path

```
1. EnqueueSecurityEvent() → BullMQ
2. Worker picks up job
3. Route to correct processor:
   - processAsyncAnalysis: AI classification
   - processAuditEvent: DB audit log write
   - processDomainIntel: URL reputation check
   - processRaidCorrelation: cross-group raid detection
   - processActionRetry: failed Telegram action retry
```

## Policy Modes

| Mode | ALLOW | WARN | DELETE | DELETE_MUTE | DELETE_BAN |
|------|-------|------|--------|--------------|------------|
| RELAXED | 0-39 | 40-59 | 60-79 | 80-89 | 90-100 |
| BALANCED | 0-29 | 30-49 | 50-69 | 70-89 | 90-100 |
| STRICT | 0-19 | 20-39 | 40-59 | 60-79 | 80-100 |
| PARANOID | 0-9 | 10-29 | 30-49 | 50-69 | 70-100 |

## Technology Stack

| Layer | Technology |
|-------|------------|
| API Server | Fastify + TypeScript |
| Web Dashboard | Next.js 14 (App Router) |
| Worker | BullMQ + TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| Cache | Redis 7 |
| Telegram | Grammy v1 |
| Container | Docker Compose |
| Package Manager | pnpm (workspace) |