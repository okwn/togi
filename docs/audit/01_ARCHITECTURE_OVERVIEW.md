# Architecture Overview

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## System Overview

TOGI (Telegram Open Guard Intelligence) is a Telegram group security bot that provides:

1. Real-time message moderation via webhook
2. AI-powered content analysis
3. Autonomous agent for security actions
4. Admin dashboard for policy management

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Telegram Bot API                         │
│                   (webhook pushes updates)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Internet                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│       togi-api            │    │        togi-web         │
│   (Fastify, port 4310)    │    │   (Next.js, port 4320)  │
│                          │    │                          │
│  ┌────────────────────┐  │    │  ┌────────────────────┐ │
│  │  Webhook Handler   │  │    │  │    React UI        │ │
│  │  - Signature Check │  │    │  │    - Dashboard     │ │
│  │  - Rate Limiting   │  │    │  │    - Policy Editor │ │
│  │  - Idempotency     │  │    │  │    - Reports      │ │
│  └────────────────────┘  │    │  └────────────────────┘ │
│  ┌────────────────────┐  │    │          │             │
│  │  Detection Engine  │  │    │          │             │
│  │  - Fast Path       │  │    │          ▼             │
│  │  - Policy Eval     │  │    │  ┌──────────────────┐  │
│  └────────────────────┘  │    │  │   REST API       │  │
│  ┌────────────────────┐  │    │  │   /api/v1/*      │  │
│  │  Auth / RBAC       │  │    │  └──────────────────┘  │
│  │  - JWT Sessions    │    │  └──────────────────────┘
│  │  - Role Checks     │    │
│  └────────────────────┘    │
└────────────┬───────────────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
┌────────┐ ┌──────┐ ┌─────────┐
│postgres│ │redis │ │ telegram│
│  5432  │ │ 6379 │ │   API   │
└────────┘ └──────┘ └─────────┘
    │        │        │
    │        ▼        │
    │   ┌────────┐   │
    │   │ BullMQ │   │
    │   │ Queues │   │
    │   └────────┘   │
    │        │        │
    └────────┼────────┘
             │
             ▼
    ┌─────────────────────┐
    │     togi-worker     │
    │  (port 4390)        │
    │                     │
    │  - Async Analysis   │
    │  - Report Gen       │
    │  - Agent Runs       │
    │  - Scheduled Jobs   │
    └─────────────────────┘
```

---

## Services

### togi-api

**Purpose:** Main API server handling Telegram webhooks and dashboard requests

**Technology:** Node.js, Fastify, TypeScript

**Key Responsibilities:**
- Receive and validate Telegram webhook updates
- Execute fast-path detection on messages
- Enforce rate limits
- Manage authentication sessions (JWT)
- Expose REST API for dashboard
- Enqueue async jobs for worker

**Ports:**
- `4310`: HTTP API

**Environment Variables:**
```
NODE_ENV=production
API_PORT=4310
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=togi
POSTGRES_PASSWORD=<secret>
POSTGRES_DB=togi
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<secret>
TELEGRAM_BOT_TOKEN=<secret>
TELEGRAM_WEBHOOK_SECRET=<secret>
JWT_SECRET=<min-32-chars>
```

### togi-web

**Purpose:** Admin dashboard for group management

**Technology:** Next.js 14, React, TypeScript

**Key Responsibilities:**
- Group policy visualization
- Report viewing and management
- User trust score display
- Agent run monitoring

**Ports:**
- `4320`: HTTP (development)
- Internal: Vite dev server

### togi-worker

**Purpose:** Async job processor for heavy operations

**Technology:** Node.js, BullMQ, TypeScript

**Key Responsibilities:**
- Content analysis (async)
- Media analysis
- Report generation
- Scheduled report delivery
- Agent planning and execution
- Raid correlation

**Ports:**
- `4390`: Metrics endpoint

---

## Data Stores

### PostgreSQL (Primary Database)

**Purpose:** Persistent storage for all application data

**Schema Tables:**

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| users | Telegram user records | telegram_user_id (unique) |
| groups | Telegram group records | telegram_chat_id (unique) |
| group_admins | Admin/role assignments | (group_id, telegram_user_id) |
| group_policies | Policy configurations | (group_id, mode) |
| violations | Violation records | (group_id, created_at) |
| punishments | Punishment records | (group_id, status) |
| audit_logs | Action audit trail | (group_id, created_at) |
| sessions | Web session records | csrf_token (unique) |
| message_fingerprints | Duplicate detection | text_hash |
| user_risk_profiles | Global risk scores | telegram_user_id (unique) |
| group_user_profiles | Per-group behavior | (group_id, telegram_user_id) |
| threat_indicators | Cross-group threats | (type, value_hash) |
| agent_runs | Autonomous agent history | (group_id, status) |
| recommendations | Agent recommendations | (group_id, status) |
| autonomous_agent_policies | Agent configuration | group_id (unique) |
| captchas | Verification challenges | nonce (unique) |
| new_member_signals | New member risk signals | (group_id, telegram_user_id) |

### Redis (Cache, Queue, Idempotency)

**Purpose:** Cache, rate limiting, job queues, distributed locks

**Key Patterns:**

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `rate:user:{chatId}:{userId}` | Per-user rate limit | 60s |
| `duplicate:{chatId}:{hash}` | Duplicate detection | 24h |
| `action_lock:{chatId}:{msgId}:{action}` | Action idempotency | 5min |
| `update_state:{updateId}` | Webhook idempotency | 24h |
| `update_lock:{updateId}` | Webhook processing lock | 30s |
| `policy_cache:{chatId}` | Policy cache | 1h |
| `scheduled_lock:{jobName}` | Scheduled job lock | 5min |
| `agent_run_lock:{groupId}` | Agent run lock | 10min |

**Queue Names:**
- `critical-actions` - High priority actions
- `async-analysis` - Content analysis
- `audit-events` - Audit log writes
- `domain-intel` - Domain intelligence
- `raid-correlation` - Raid detection
- `media-analysis` - Media processing
- `report-generation` - Report creation
- `report-delivery` - Report delivery
- `scheduled-reports` - Scheduled reports
- `low-priority-intel` - Background intel
- `dead-letter` - Failed job retention

---

## External Integrations

### Telegram Bot API

**Purpose:** Send/receive messages, manage group members, enforce actions

**Security:**
- Webhook secret token verification
- HMAC-SHA256 signature validation
- Rate limiting on outbound requests

**Outgoing Operations:**
- sendMessage
- deleteMessage
- restrictChatMember
- banChatMember
- unbanChatMember
- getChatMember
- answerCallbackQuery

### OpenAI API (Optional)

**Purpose:** Message classification, agent planning

**Security:**
- API key stored in environment
- Circuit breaker (5 failures → 60s reset)
- Timeout: 1200ms for classification, 5000ms for agent planning

### Anthropic API (Optional)

**Purpose:** Alternative LLM for agent planning

**Security:**
- API key stored in environment
- Same circuit breaker as OpenAI

---

## Security Architecture

### Authentication Flow

```
User → Dashboard → JWT Cookie → API
                          ↓
                   JWT Validation
                          ↓
                   Claims Check
                          ↓
                   Role Lookup
                          ↓
                   Permission Grant
```

### RBAC Roles

| Role | Permissions |
|------|-------------|
| OWNER | All permissions, policy management, agent control |
| SUPERVISOR | Warn, mute, kick, ban, view reports |
| MODERATOR | Warn, mute (temp), view reports |
| VIEWER | View-only access |

### Webhook Security

```
Telegram → [HMAC Signature] → API
                ↓
         Secret Validation
                ↓
         Timestamp Check (prevent replay)
                ↓
         Idempotency Check (Redis)
                ↓
         Processing
```

### Agent Safety Levels

| Level | Description | Human Approval |
|-------|-------------|----------------|
| RESTRICTED | No actions, recommendations only | All |
| LOW | Warn, captcha | High-impact |
| MEDIUM | Warn, mute, captcha | Critical |
| HIGH | All except ban | Critical only |
| FULL | All actions, no restrictions | None |

---

## Data Flow Diagrams

### Webhook Processing Flow

```
1. Telegram sends POST /webhooks/telegram
2. API validates HMAC signature
3. API checks replay protection (Redis)
4. API claims update (Redis NX)
5. API runs fast-path detection
6. If action needed:
   a. API acquires action lock
   b. API sends Telegram action
   c. API releases lock on failure
7. API enqueues async analysis
8. API marks update processed
9. Return 200 to Telegram
```

### Dashboard Authentication Flow

```
1. User visits /login
2. User submits Telegram auth
3. API verifies with Telegram
4. API creates session (JWT)
5. API sets HttpOnly cookie
6. User accesses dashboard
7. Dashboard validates JWT
8. User performs actions
```

---

## Network Boundaries

| Zone | Components | Access |
|------|------------|--------|
| DMZ | togi-api (webhook) | Public internet |
| Internal | togi-web | Limited to dashboard users |
| Internal | togi-worker | Internal only |
| Data | PostgreSQL | togi-api, togi-worker |
| Cache | Redis | togi-api, togi-worker |
| External | Telegram API | Outbound only |
| External | LLM Providers | Outbound only |

---

## Deployment

### Docker Compose (Development/Testing)

See `docker-compose.yml` for full configuration.

### Production Recommendations

1. **pgBouncer** for connection pooling
2. **Redis Cluster** for high availability
3. **Multiple API instances** behind load balancer
4. **Multiple Worker instances** for queue processing
5. **Prometheus + Grafana** for monitoring

---

## Version Information

- **Current Version:** 1.0.0
- **Node.js:** 20.x LTS
- **TypeScript:** 5.x
- **PostgreSQL:** 16
- **Redis:** 7.x