# PHASE_04_ACTION_EXECUTOR.md - Telegram Action Executor

## Objectives

- [x] TelegramActionExecutor class with idempotency
- [x] Admin protection checks
- [x] Mute/restrict with presets
- [x] Warn escalation system
- [x] Manual moderation commands
- [x] Redis-based action locks
- [x] Error handling with retriable flags
- [x] Integration with webhook handler

## Architecture

```
Detection Result → TelegramActionExecutor.executeDecision()
                          │
                          ▼
                    ┌─────────────────┐
                    │  Admin Check    │── If admin → BLOCK
                    └─────────────────┘
                          │
                          ▼
                    ┌─────────────────┐
                    │  Action Lock    │── If locked → IDEMPOTENT
                    └─────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  DELETE  │   │  WARN    │   │ RESTRICT │
    └──────────┘   └──────────┘   └──────────┘
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  BAN     │   │  KICK    │   │ LOCKDOWN │
    └──────────┘   └──────────┘   └──────────┘
```

## ActionExecutor API

### Core Methods

```typescript
class TelegramActionExecutor {
  constructor(bot: Bot, redisClient: RedisClient)

  // Individual actions
  async deleteMessage(input: DeleteMessageInput): Promise<ActionResult>
  async warnUser(input: WarnUserInput): Promise<ActionResult>
  async restrictUser(input: RestrictUserInput): Promise<ActionResult>
  async banUser(input: BanUserInput): Promise<ActionResult>
  async kickUser(input: KickUserInput): Promise<ActionResult>
  async setLockdown(input: LockdownInput): Promise<ActionResult>
  async unsetLockdown(input: LockdownInput): Promise<ActionResult>
  async sendAdminAlert(input: AdminAlertInput): Promise<ActionResult>

  // Decision executor
  async executeDecision(input: ExecuteDecisionInput): Promise<ActionResult>

  // Helpers
  async isUserAdmin(chatId: number, userId: number): Promise<boolean>
}
```

### Input Types

```typescript
interface DeleteMessageInput {
  chatId: number;
  messageId: number;
  reason?: string;
}

interface WarnUserInput {
  chatId: number;
  userId: number;
  reason?: string;
}

interface RestrictUserInput {
  chatId: number;
  userId: number;
  untilDate?: Date;
  permissions?: ChatPermissions;
}

interface BanUserInput {
  chatId: number;
  userId: number;
  reason?: string;
}

interface ExecuteDecisionInput extends ActionInput {
  recommendedAction: RecommendedAction;
  riskScore: number;
}
```

### ActionResult Shape

```typescript
interface ActionResult {
  ok: boolean;
  action: string;
  telegramMethod?: string;
  errorCode?: string;
  errorMessage?: string;
  retriable: boolean;
}
```

## Idempotency

Every action acquires a Redis lock before execution:

```
action_lock:{chatId}:{messageId}:{action}
```

- TTL: 300 seconds (5 minutes)
- If lock exists, returns `{ ok: true, errorMessage: 'Already attempted' }`
- Released in finally block after execution

## Admin Protection

Before any punishment action (warn, restrict, ban, kick):

```typescript
if (await isUserAdmin(chatId, userId)) {
  return { ok: false, errorMessage: 'Cannot punish group admin' };
}
```

## Mute Presets

```typescript
const MUTE_PRESETS = {
  '5_MINUTES': 5 * 60 * 1000,
  '30_MINUTES': 30 * 60 * 1000,
  '1_HOUR': 60 * 60 * 1000,
  '24_HOURS': 24 * 60 * 60 * 1000,
};
```

Default mute duration: 30 minutes if not specified.

## Decision Mapping

| Detection Action | Executor Methods |
|------------------|------------------|
| DELETE | deleteMessage |
| DELETE_WARN | deleteMessage + warnUser |
| DELETE_MUTE | deleteMessage + restrictUser (1h) |
| DELETE_BAN | deleteMessage + banUser |
| WARN | warnUser |
| MUTE | restrictUser (30m default) |
| BAN | banUser |
| KICK | kickUser |
| ALLOW | no-op, return ok |
| LOG | no-op, return ok |
| REVIEW | sendAdminAlert |

## Manual Commands

| Command | Action | Example |
|---------|--------|---------|
| /warn @user [reason] | warnUser | /warn @spammer spam |
| /mute @user [duration] [reason] | restrictUser | /mute @troll 30m |
| /ban @user [reason] | banUser | /ban @scammer phishing |
| /unban @user | unbanChatMember | /unban @olduser |
| /lockdown | setChatPermissions(all false) | /lockdown |
| /unlockdown | setChatPermissions(all true) | /unlockdown |

## Error Handling

### Retriable Errors (retry after delay)
- 429: Too Many Requests
- 500: Internal Server Error
- 502: Bad Gateway
- 503: Service Unavailable
- 504: Gateway Timeout

### Non-Retriable Errors (log and skip)
- 400: Bad Request (missing permissions, invalid input)
- 403: Forbidden (not admin, can't perform action)
- 404: Not Found (message/user not found)

### Special Cases
- Message already deleted: Return `{ ok: true }` (idempotent)
- User is admin: Return `{ ok: false }` with admin protection error

## Integration

In webhook handler:

```typescript
const actionExecutor = new TelegramActionExecutor(bot.Bot, redis);

// Fast path detection result
const result = await runFastPath(context, policyConfig);

if (result.detection.recommendedAction !== 'ALLOW') {
  const input = {
    chatId,
    userId,
    messageId,
    reason: detection.reasons.join('; '),
    riskScore: detection.riskScore,
    recommendedAction: detection.recommendedAction,
  };
  await actionExecutor.executeDecision(input);
}
```

## Status: COMPLETED