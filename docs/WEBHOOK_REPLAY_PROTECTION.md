# Webhook Replay Protection

## Update Idempotency

Every Telegram update has a unique `update_id`. TOGI tracks the processing state of each update in Redis:

```
update_state:{updateId} = RECEIVED | PROCESSING | PROCESSED | FAILED_RETRIABLE | FAILED_FINAL
update_lock:{updateId} = <pid>  (30s TTL)
```

**Duplicate update (PROCESSED):** Return 200 immediately without reprocessing.

**Concurrent update (PROCESSING):** Return 200, let the first processor finish.

**Retriable failure:** Allow re-processing after 30s lock expiry.

## Webhook Secret Token

All webhook requests must include `X-Telegram-Bot-Api-Secret-Token` matching `TELEGRAM_WEBHOOK_SECRET`. Requests without a valid token are rejected with 401.

## Request Body Size Limit

Maximum update body size: 64KB (`WEBHOOK_BODY_MAX_BYTES`). Oversized payloads return 413.

## Action Idempotency

Destructive Telegram actions (delete, ban, mute, warn) are locked by:
```
action_lock:{chatId}:{messageId}:{actionType}  (5min TTL)
```
Duplicate action attempts within 5 minutes are skipped silently.

## Webhook Per-Chat Rate Limit

Each chat is limited to 30 updates/second (Telegram's hard limit). Updates exceeding this return 200 but are marked `rateLimited: true`.

## State Machine

```
RECEIVED → PROCESSING → PROCESSED
                   ↘ FAILED_RETRIABLE → (retry) → PROCESSING
                   ↘ FAILED_FINAL (no more retries)
```

## Security Headers

All webhook responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

## No Wildcard CORS

Webhook endpoint does not support CORS (not needed for Telegram callbacks).