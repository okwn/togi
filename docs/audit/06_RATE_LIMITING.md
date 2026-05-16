# Rate Limiting

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

TOGI implements multi-layer rate limiting to prevent abuse and ensure fair resource usage.

---

## Rate Limit Tiers

### Tier 1: Public Auth (Login)

**Purpose:** Prevent brute force on authentication endpoints

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max requests | 10 |
| Block duration | 1 hour (after 5 failures) |

**Key:** `rate:auth:{ip}`

### Tier 2: Dashboard API

**Purpose:** Prevent dashboard abuse

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max requests | 100 |

**Key:** `rate:dashboard:{userId}`

### Tier 3: Webhook (Per-Chat)

**Purpose:** Prevent webhook spam per group

| Setting | Value |
|---------|-------|
| Window | 1 second |
| Max requests | 30 |
| Burst allowed | 50 |

**Key:** `webhook:{chatId}`

### Tier 4: Policy Queries

**Purpose:** Limit policy lookups

| Setting | Value |
|---------|-------|
| Window | 300 seconds (5 min) |
| Max requests | 10 |

**Key:** `rate:policy:{chatId}`

### Tier 5: Domain Rules

**Purpose:** Prevent domain rule abuse

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max requests | 20 |

**Key:** `rate:domain:{chatId}`

### Tier 6: Review Queue

**Purpose:** Limit review operations

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max requests | 30 |

**Key:** `rate:review:{chatId}`

### Tier 7: Abuse Detection (Failed Login)

**Purpose:** Detect credential stuffing

| Setting | Value |
|---------|-------|
| Window | 15 minutes |
| Max failures | 5 |
| Block duration | 1 hour |

**Key:** `abuse:failed_login:{ip}`

---

## Implementation

### Rate Limit Service

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

async isAllowed(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, Math.ceil(windowMs / 1000));
  }

  const ttl = await redis.ttl(windowKey);

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: now + (ttl * 1000),
  };
}
```

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1234567890
```

---

## Rate Limit Response

When rate limited:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "retryAfter": 12345
}
```

HTTP Status: 429 Too Many Requests

---

## Configuration

### Environment Variables

```bash
# Auth rate limits
RATE_LIMIT_PUBLIC_AUTH_WINDOW_MS=60000
RATE_LIMIT_PUBLIC_AUTH_MAX=10

# Webhook rate limits
RATE_LIMIT_WEBHOOK_WINDOW_MS=1000
RATE_LIMIT_WEBHOOK_MAX=30

# Dashboard rate limits
RATE_LIMIT_DASHBOARD_WINDOW_MS=60000
RATE_LIMIT_DASHBOARD_MAX=100

# Abuse detection
RATE_LIMIT_ABUSE_FAILED_LOGIN_WINDOW_MS=900000
RATE_LIMIT_ABUSE_FAILED_LOGIN_MAX=5
RATE_LIMIT_ABUSE_BLOCK_DURATION_MS=3600000
```

---

## Degraded Mode

When Redis is unavailable (`REDIS_DEGRADED_MODE=fail_open`):
- Rate limits pass (allowed)
- Violation logged for review

When `REDIS_DEGRADED_MODE=fail_closed`:
- Requests blocked
- Service unavailable until Redis returns

---

## Bypass Prevention

### IP Rotation Detection

Monitor for IP patterns:
```typescript
const ips = await redis.smembers(`ips:${userId}`);
if (ips.length > 10) {
  // Flag for review - possible IP rotation attack
}
```

### User Token Rotation

Monitor for token patterns:
```typescript
const tokens = await redis.smembers(`tokens:${userId}`);
if (tokens.length > 5) {
  // Flag for review - possible token rotation
}
```

---

## Audit Checklist

- [ ] All endpoints have rate limits
- [ ] Rate limit headers included in responses
- [ ] Rate limit exceeded returns 429
- [ ] Abuse detection triggers block
- [ ] Redis failure has degraded mode
- [ ] Rate limit config via environment
- [ ] Logs include rate limit violations