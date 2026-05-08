# Phase 07: Raid Mode, New Member Protection, and Verification/Review Foundations

## Overview

Phase 07 implements protection against sudden attacks and suspicious new members through:
- New member probation system
- Join spike detection
- Raid mode with auto-lockdown
- Group lockdown controls
- Lightweight verification challenge
- Admin review queue

## New Member Protection

### Probation System

When a user joins a group, they enter a probation period controlled by policy:

```typescript
newMemberProtection: {
  enabled: true,
  probationMinutes: 5,        // Duration of probation
  blockLinksDuringProbation: true,
  blockMediaDuringProbation: false,
  blockMentionsDuringProbation: false,
  firstMessageStrictMode: true,   // Stricter rules on first message
  verificationRequired: false,   // Verification challenge
}
```

### Probation Flow

1. **User Joins** → Record join timestamp in Redis (`probation:{chatId}:{userId}`)
2. **Probation Active** → Block links/media/mentions based on policy
3. **First Violation** → Restrict user (mute until probation ends)
4. **Verification Required** → Send inline button challenge, timeout after 5 minutes
5. **Probation Ends** → User marked as regular member

### Redis Keys

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `probation:{chatId}:{userId}` | Probation state | 24h |
| `verified:{chatId}:{userId}` | Verified users | 24h |
| `verify_challenge:{chatId}:{userId}` | Active challenge | 5min |

## Raid Mode

### Triggers

Raid mode activates when any threshold is breached:

| Trigger | Threshold | Window |
|---------|-----------|--------|
| Join spike | Configurable (default 15) | 60s |
| Duplicate messages | >50 messages | 30s |
| New users posting links | >20 | 30s |
| Blocked domains | >10 | 30s |
| Flood violations | >30 | 30s |
| Mentions | >100 | 30s |

### Raid Policy

```typescript
raidProtection: {
  enabled: true,
  joinSpikeThreshold: 15,
  windowSeconds: 60,
  autoLockdown: true,           // Automatically lockdown group
  lockdownMinutes: 30,
  restrictNewMembers: true,      // Restrict new joins during raid
  alertAdmins: true,
  paranoidDuringRaid: false,    // Use PARANOID thresholds during raid
}
```

### Raid State (Redis)

```typescript
{
  active: true,
  startedAt: 1715000000000,
  reason: "JOIN_SPIKE",
  expiresAt: 1715001800000,
  triggerStats: {
    joins: 23,
    messages: 0,
    links: 0,
    newUsersLinks: 0,
    mentions: 0
  }
}
```

## Lockdown

### Auto-Lockdown

When raid is detected and `autoLockdown: true`:
1. Call `TelegramActionExecutor.setLockdown()` to restrict all members
2. Schedule unlock after `lockdownMinutes`
3. Worker handles scheduled unlock via delayed job

### Manual Unlock

- `/unlockdown` command overrides raid lockdown
- Removes `lockdown:{chatId}` Redis key
- Restores chat permissions via `TelegramActionExecutor.unsetLockdown()`

### Lockdown Redis Key

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `lockdown:{chatId}` | Active lockdown | `lockdownMinutes` |

## Verification Challenge

### Flow

1. New user joins with `verificationRequired: true`
2. Bot sends challenge message with inline button: "[ I'm human ]"
3. User clicks button → Callback query handled
4. If verified: Mark in Redis, allow full access
5. If timeout (5min): Restrict user until manually approved

### Implementation

```typescript
// Create challenge
const challenge = await createVerifyChallenge(chatId, userId);

// Send inline button
await bot.api.sendMessage(chatId, `Welcome! Verify:`, {
  reply_markup: {
    inline_keyboard: [[{ text: "I am human", callback_data: `verify:${challenge}` }]]
  }
});

// Handle callback
if (callback_data.startsWith('verify:')) {
  await markUserVerified(chatId, userId);
}
```

### Future Captcha Plans

See `docs/ROADMAP.md` for planned captcha enhancements:
- Math problems (e.g., "What is 3 + 5?")
- Emoji selection (select all 🐱 from 🐕🐱🐰)
- Image-based challenges
- SMS/email verification for high-security groups

## Review Queue

### DB Table

```sql
CREATE TABLE review_queue (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  item_type VARCHAR(20) NOT NULL, -- 'message' | 'user'
  item_id BIGINT,
  telegram_user_id BIGINT,
  telegram_message_id BIGINT,
  reason TEXT NOT NULL,
  reason_type VARCHAR(50) NOT NULL,
  labels JSONB DEFAULT [],
  risk_score INT,
  status VARCHAR(20) DEFAULT 'PENDING',
  reviewed_by BIGINT,
  reviewed_at TIMESTAMP,
  review_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Status Flow

```
PENDING → APPROVED (allow content/user)
PENDING → REJECTED (remove content/ban user)
PENDING → EXPIRED (auto-expire after 24h)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/review-queue` | List items by status |
| POST | `/api/groups/:id/review-queue/:itemId/approve` | Approve item |
| POST | `/api/groups/:id/review-queue/:itemId/reject` | Reject item |

## UI Components

### RaidStatusBanner

Displayed on group overview page when raid is active:
- Shows trigger stats (joins, messages, links, etc.)
- Countdown to expiry
- "Unlock Group" button for manual override

### Review Queue Page

Located at `/dashboard/groups/[groupId]/review`:
- Filter tabs: PENDING | APPROVED | REJECTED
- Item cards with reason, labels, risk score
- Approve/Reject buttons for pending items
- Clear explanation of why item was flagged

## Bot Commands

| Command | Description |
|---------|-------------|
| `/raid_status` | Show current raid state |
| `/lockdown` | Manually lockdown group |
| `/unlockdown` | Remove lockdown (override raid) |
| `/verify` | Trigger verification challenge |

## Tests

### Probation Tests

```typescript
describe('New Member Probation', () => {
  it('should mark user in probation on join', async () => {
    await setUserInProbation(chatId, userId, 5);
    const inProbation = await isUserInProbation(chatId, userId);
    expect(inProbation).toBe(true);
  });

  it('should allow links after probation ends', async () => {
    // Set probation with 1ms duration for testing
    await setUserInProbation(chatId, userId, 0);
    // Wait for expiry
    await delay(10);
    const info = await getProbationInfo(chatId, userId);
    expect(info?.probationUntil).toBeLessThan(Date.now());
  });
});
```

### Raid Detection Tests

```typescript
describe('Join Spike Detection', () => {
  it('should detect spike when threshold exceeded', async () => {
    const result = await recordJoin(chatId, { threshold: 5, windowSeconds: 60 });
    expect(result.count).toBe(1);
    expect(result.isSpike).toBe(false);

    // Simulate 4 more joins
    for (let i = 0; i < 4; i++) {
      await recordJoin(chatId, { threshold: 5, windowSeconds: 60 });
    }

    const finalResult = await recordJoin(chatId, { threshold: 5, windowSeconds: 60 });
    expect(finalResult.isSpike).toBe(true);
  });
});
```

### Lockdown Tests

```typescript
describe('Lockdown', () => {
  it('should activate lockdown state', async () => {
    await setLockdown(chatId, 30);
    const inLockdown = await isChatInLockdown(chatId);
    expect(inLockdown).toBe(true);
  });

  it('should deactivate on manual unlock', async () => {
    await setLockdown(chatId, 30);
    await removeLockdown(chatId);
    const inLockdown = await isChatInLockdown(chatId);
    expect(inLockdown).toBe(false);
  });
});
```

## Performance Considerations

- Redis keys use TTL to prevent memory bloat
- Raid state auto-expires after 1 hour max
- Probation keys expire after 24 hours max
- Join spike window uses sorted sets for O(log N) operations
- Review queue items auto-expire after 24 hours

## Security Notes

- Probation state stored in Redis, not DB, for speed
- Verification challenges expire after 5 minutes
- Manual `/unlockdown` always overrides auto-lockdown
- Raid state persisted to survive worker restarts
- Admin review actions are themselves audited