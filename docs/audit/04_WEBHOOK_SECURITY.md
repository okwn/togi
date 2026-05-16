# Webhook Security

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

TOGI receives Telegram updates via webhook. This document details the security controls for webhook processing.

---

## Webhook Processing Flow

```
Telegram → HTTPS Request → Webhook Endpoint → Validation → Processing → Response
                                 │
                                 ├── 1. Signature Check
                                 ├── 2. Replay Protection
                                 ├── 3. Rate Limiting
                                 ├── 4. Idempotency Check
                                 └── 5. Action Execution
```

---

## Security Controls

### 1. Secret Token Verification

**Header:** `X-Telegram-Bot-Api-Secret-Token`

Every webhook request must include the secret token:

```typescript
const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;

if (!secretHeader || secretHeader !== expectedSecret) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
```

**Requirements:**
- Secret must be at least 32 random characters
- Secret must be set in production
- Secret must never be logged

### 2. Replay Protection

**Purpose:** Prevent attackers from replaying old updates.

**Implementation:** Redis-based idempotency check

```typescript
const state = await redis.get(`update_state:${updateId}`);

// If PROCESSED, return 200 (already handled)
if (state === 'PROCESSED') {
  return reply.status(200).send({ ok: true, duplicate: true });
}
```

**TTL:** 24 hours (configurable via `UPDATE_TTL_SECONDS`)

### 3. Atomic Claim Update

**Purpose:** Prevent race condition where two instances process same update.

**Implementation:** Lua script for atomic check-and-claim

```lua
local stateKey = KEYS[1]
local lockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local processedState = ARGV[2]
local failedFinalState = ARGV[3]
local failedRetriableState = ARGV[4]
local processingState = ARGV[5]
local pid = ARGV[6]

local current = redis.call('GET', stateKey)

if current == processedState or current == failedFinalState then
  return 0  -- Already processed, skip
end

local lockAcquired = redis.call('SET', lockKey, pid, 'EX', 30, 'NX')
if not lockAcquired then
  return -1  -- Another process has lock
end

-- Claim for processing
redis.call('SET', stateKey, processingState, 'EX', ttl)
return 1  -- Successfully claimed
```

**Lock TTL:** 30 seconds (prevents deadlocks on crash)

### 4. Rate Limiting

**Per-Chat Rate Limit:**
```typescript
RATE_LIMIT_WEBHOOK_WINDOW_MS: 1000   // 1 second
RATE_LIMIT_WEBHOOK_MAX: 30          // 30 requests per second per chat
```

**Implementation:**
```typescript
const rateKey = `webhook:${chatId}`;
const allowed = await rateLimitService.isAllowed(rateKey, windowMs, max);

if (!allowed.allowed) {
  await idempotencyService.markFailedRetriable(updateId);
  return reply.status(200).send({ ok: true, rateLimited: true });
}
```

### 5. Body Size Limit

**Purpose:** Prevent memory exhaustion from large payloads.

```typescript
config: {
  bodyLimit: env.WEBHOOK_BODY_MAX_BYTES || 65536,  // 64KB default
}
```

---

## Webhook Endpoint Specification

### Endpoint

```
POST /webhooks/telegram
Content-Type: application/json
X-Telegram-Bot-Api-Secret-Token: <secret>
```

### Request Body

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 123,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "John",
      "username": "johndoe"
    },
    "chat": {
      "id": -987654321,
      "type": "supergroup"
    },
    "date": 1234567890,
    "text": "Hello"
  }
}
```

### Response

**Success:**
```json
{
  "ok": true
}
```

**Duplicate (already processed):**
```json
{
  "ok": true,
  "duplicate": true
}
```

**Rate Limited:**
```json
{
  "ok": true,
  "rateLimited": true
}
```

**Error (Telegram won't retry):**
```json
{
  "ok": false,
  "error": "error message"
}
```

---

## Action Idempotency

### Purpose

Prevent duplicate actions (ban, mute, warn) when the same message is processed multiple times or action is retried.

### Implementation

```typescript
async tryLockAction(chatId: number, messageId: number, actionType: string): Promise<boolean> {
  const key = `action_lock:${chatId}:${messageId}:${actionType}`;
  const result = await redis.set(key, '1', 'EX', 300, 'NX'); // 5 min TTL
  return result === 'OK';
}
```

### Lock Release

On action failure, lock is released to allow retry:

```typescript
await idempotencyService.unlockAction(chatId, messageId, actionType);
```

### Action Lock TTL

**5 minutes** - Sufficient time for Telegram API response while preventing indefinite locks.

---

## Security Considerations

### IP Whitelist (Future Enhancement)

Telegram webhooks originate from known IP ranges:
- 149.154.160.0/20
- 91.108.4.0/20

In future, verify source IP matches Telegram ranges.

### TLS Requirement

Webhook endpoint must be served over HTTPS in production. HTTP should redirect to HTTPS.

### Webhook Certificate (Future Enhancement)

For additional security, verify Telegram's webhook certificate:
- Certificate must be from a trusted CA
- Domain must match bot's configured webhook URL

---

## Error Handling

### Error Response Behavior

| Error | HTTP Status | Telegram Retry |
|-------|-------------|----------------|
| Invalid secret | 401 | No |
| Invalid body | 400 | No |
| Rate limited | 200 (graceful) | No |
| Internal error | 200 (mark failed) | Yes (after backoff) |

**Important:** Always return 200 to Telegram unless the request is truly invalid. Returning 4xx causes Telegram to stop sending webhooks.

### Failure Marking

On processing failure:
```typescript
await idempotencyService.markFailedRetriable(updateId);
return reply.status(200).send({ ok: false });
```

Failed updates can be retried up to 3 times (configurable).

---

## Audit Checklist

- [ ] Webhook secret required in production
- [ ] Secret is at least 32 characters
- [ ] Replay protection active (24h TTL)
- [ ] Atomic claim prevents race conditions
- [ ] Rate limiting per chat (30/s)
- [ ] Body size limit enforced (64KB)
- [ ] Action idempotency locks work across instances
- [ ] Failed updates marked for retry
- [ ] Error responses return 200 to Telegram
- [ ] No sensitive data logged from webhook