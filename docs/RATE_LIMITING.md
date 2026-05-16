# Rate Limiting

## Overview

All public API endpoints and dashboard routes are protected by Redis-backed sliding-window rate limiting with configurable limits per endpoint category.

## Rate Limit Tiers

| Tier | Window | Default Limit | Key Type |
|------|-------|---------------|----------|
| Public auth endpoints | 1 min | 10 req/min | Per IP |
| Dashboard API | 1 min | 100 req/min | Per session |
| Policy mutations | 5 min | 10 changes/5min | Per group |
| Domain rule ops | 1 min | 20 ops/min | Per group |
| Review queue ops | 1 min | 30 ops/min | Per group |
| Webhook per-chat | 1 sec | 30 updates/sec | Per chat |
| Failed login | 15 min | 5 attempts | Per IP (hashed) |

## Configuration

All limits are configurable via environment variables in `packages/config/src/index.ts`:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_PUBLIC_AUTH_WINDOW_MS` | 60000 | Auth endpoint window (ms) |
| `RATE_LIMIT_PUBLIC_AUTH_MAX` | 10 | Auth endpoint max requests per window |
| `RATE_LIMIT_DASHBOARD_WINDOW_MS` | 60000 | Dashboard API window (ms) |
| `RATE_LIMIT_DASHBOARD_MAX` | 100 | Dashboard API max requests per window |
| `RATE_LIMIT_POLICY_WINDOW_MS` | 300000 | Policy mutation window (ms) |
| `RATE_LIMIT_POLICY_MAX` | 10 | Policy mutation max per window |
| `RATE_LIMIT_DOMAIN_RULES_WINDOW_MS` | 60000 | Domain rules window (ms) |
| `RATE_LIMIT_DOMAIN_RULES_MAX` | 20 | Domain rules max per window |
| `RATE_LIMIT_REVIEW_QUEUE_WINDOW_MS` | 60000 | Review queue window (ms) |
| `RATE_LIMIT_REVIEW_QUEUE_MAX` | 30 | Review queue max per window |
| `RATE_LIMIT_WEBHOOK_WINDOW_MS` | 1000 | Webhook per-chat window (ms) |
| `RATE_LIMIT_WEBHOOK_MAX` | 30 | Webhook max updates per window per chat |
| `RATE_LIMIT_ABUSE_FAILED_LOGIN_WINDOW_MS` | 900000 | Failed login tracking window (ms) |
| `RATE_LIMIT_ABUSE_FAILED_LOGIN_MAX` | 5 | Failed login max before block |
| `RATE_LIMIT_ABUSE_BLOCK_DURATION_MS` | 3600000 | Block duration after abuse (ms) |

## Response Format

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please slow down.",
    "requestId": "togi_1234567890_abc"
  }
}
```

With headers:
- `X-RateLimit-Limit` — max requests allowed in window
- `X-RateLimit-Remaining` — requests remaining
- `X-RateLimit-Reset` — Unix timestamp when window resets
- `Retry-After` — seconds to wait (on 429 only)

## Abuse Detection

Failed login attempts are tracked per IP. After 5 failures in 15 minutes, the IP is blocked for 1 hour on auth endpoints. Blocked attempts return 429 `RATE_LIMITED`.

## Degraded Mode

When Redis is unavailable:
- Dashboard mutations: `fail_closed` (blocks mutations) by default
- Webhook processing: `fail_open` (allows minimal processing) by default

Configurable via `REDIS_DEGRADED_MODE` env var.