# PHASE_01_TELEGRAM_WEBHOOK.md - Telegram Webhook

## Objectives

- [x] Webhook receiver endpoint in API
- [x] Telegram update parsing
- [x] Bot token validation
- [x] Webhook secret verification
- [x] Health check endpoints
- [x] Bot commands (/start, /help, /setup, /security_status, /check_permissions)
- [x] Permission checker

## Components Created

### packages/shared/src/telegram/
```
packages/shared/src/telegram/
├── types.ts              # RawTelegramUpdate, NormalizedTelegramEvent, etc.
└── normalize-update.ts   # Update normalization logic
```

### packages/shared/src/security/
```
packages/shared/src/security/
├── hash-text.ts          # SHA-256 text hashing
└── redact.ts             # Safe event logging (no raw text)
```

### packages/shared/src/queues/
```
packages/shared/src/queues/
└── types.ts              # SecurityEventJob, enqueueSecurityEvent() stub
```

### packages/telegram-client/src/
```
packages/telegram-client/src/
├── types.ts              # BotConfig, PermissionReport, BotPermission
├── client.ts             # TelegramBot class with grammY
└── index.ts
```

### packages/config/src/
```
packages/config/src/
└── index.ts              # Zod-based env validation
```

### apps/api/src/
```
apps/api/src/
├── server.ts             # Fastify server entry point
├── logger.ts            # Structured logger setup
└── routes/
    ├── webhook.ts       # POST /webhooks/telegram
    └── health.ts       # GET /health, GET /ready, GET /api/internal/version
```

## Webhook Endpoint

```
POST /webhooks/telegram
  Headers: X-Telegram-Bot-Api-Secret-Token: <secret>
  Body: Telegram Update object

  Response: 200 OK (within 60s Telegram timeout)
```

## Bot Commands Implemented

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show available commands |
| `/setup` | Configuration instructions |
| `/security_status` | Check bot permissions |
| `/check_permissions` | Alias for /security_status |

## Performance Rules Applied

- Webhook returns quickly (no heavy processing)
- No AI/ML in webhook path
- No blocking DB operations
- Deterministic checks only in fast path
- Heavy work queued via `enqueueSecurityEvent()` stub

## Privacy Features

- Text hashing (SHA-256) for safe logging
- `DEBUG_LOG_RAW_TEXT` env flag (default false)
- Production refuses `DEBUG_LOG_RAW_TEXT=true`
- No raw message text in logs

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic liveness check |
| `GET /ready` | Readiness probe with dependency checks |
| `GET /api/internal/version` | Version info for internal use |

## Verification

```bash
# Start API
cd apps/api && pnpm dev

# Test health endpoint
curl http://localhost:4310/health

# Test webhook (with valid token)
curl -X POST http://localhost:4310/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: your-secret" \
  -d '{"update_id": 123456789, "message": {...}}'

# Check permissions command
# Add bot to group and send /check_permissions
```

## Dependencies
- Phase 00: Foundation (complete)

## Status: ✅ COMPLETE
