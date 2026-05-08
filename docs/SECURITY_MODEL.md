# SECURITY_MODEL.md

## Bot Token Safety

The Telegram bot token is the sole authentication mechanism. Protection measures:

1. **Never commit to version control** - Stored only in `.env.local`
2. **Rotate immediately if compromised** - Use @BotFather to revoke
3. **Set payment limit** - Via @BotFather to prevent abuse
4. **Enable 2FA** - On bot management account
5. **Never log token** - Sanitize all logs

## Webhook Security

### Verification Process
Every incoming webhook must be verified:

```
1. Check X-Telegram-Init-Time header exists
2. Verify within 24 hours of current time
3. Validate against Telegram API (optional but recommended)
4. Reject if signature missing or invalid
```

### Replay Protection
- Store last 1000 update IDs in Redis
- Reject updates with ID <= last processed
- TTL: 24 hours

## Raw Message Minimization

Messages are processed and discarded, not stored:

```
Webhook receives message
        │
        ▼
Parse message content (text, URLs, entities)
        │
        ▼
Run fast path detection
        │
        ▼
If blocked → Log action with reason (no raw content)
        │
        ▼
Discard original message data
```

Raw message text is never persisted to database.

## Audit Log Security

Every moderation action creates an audit entry:

```typescript
interface AuditEntry {
  id: string;
  groupId: string;
  userId: string;
  action: 'ban' | 'mute' | 'warn' | 'delete' | 'kick';
  reason: string; // Human-readable explanation
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    policyId: string;
    trigger: string; // What matched
    duration?: number;
  };
  createdAt: Date;
  // Note: NO raw message content stored
}
```

## Rate Limiting Security

Redis-based rate limiting prevents abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/webhook/telegram` | 1000 req/s | per second |
| `/api/*` | 100 req/s | per second |
| Per user actions | 10/s | per second |

## Input Sanitization

All user input is sanitized:
- SQL queries use parameterized statements
- XSS prevention in dashboard
- Telegram entities parsed, not raw HTML

## Privacy Considerations

- Telegram user data stored only as Telegram ID + username
- Full name stored only if explicitly needed
- Audit logs retained max 90 days
- Session tokens expire after 24 hours
- All PII encrypted at rest

## Telegram-Specific Security

### Bot Must Be Admin
Full protection requires bot admin status:
- Can delete messages
- Can restrict/kick/ban users
- Can change group permissions
- Can process join requests

### Privacy Mode Limitations
Bots in privacy mode **cannot** see:
- Other bots' messages
- Messages from private groups they're not admin in
- Messages older than when bot was added (sometimes)

### Bot Message Visibility
Bots generally cannot see messages from other bots - this is a Telegram limitation, not a bug.

## Fail Secure Design

- **Webhook fails**: Return 200 (avoid Telegram retry spam), log error
- **Redis fails**: Fail open with warning (allow but log)
- **DB fails**: Queue actions for later, return success
- **Telegram API fails**: Queue for retry, return success

## Security Score Calculation

Group security score (0-100) based on:

| Factor | Max Points | Description |
|--------|------------|-------------|
| Bot Admin Status | 20 | Bot must be admin for full protection |
| Bot Permissions | 25 | Delete, restrict, invite, manage video chats |
| Protections Enabled | 30 | Spam, flood, link, new member, threat, raid |
| Blocklist/Allowlist | 10 | Domain rules configured |
| Audit Logging | 15 | Audit logging enabled |

```
total = min(botAdminStatus + permissions + protections + lists + audit, 100)
```

### Security Score Breakdown

```typescript
interface SecurityScore {
  total: number;           // 0-100
  botAdminStatus: number;  // 0-20
  permissions: number;     // 0-25
  protections: number;     // 0-30
  lists: number;           // 0-10
  audit: number;           // 0-15
  breakdown: {
    hasDeletePermission: boolean;
    hasRestrictPermission: boolean;
    hasJoinRequestPermission: boolean;
    floodProtectionEnabled: boolean;
    linkProtectionEnabled: boolean;
    newMemberProtectionEnabled: boolean;
    raidProtectionEnabled: boolean;
    hasBlocklist: boolean;
    hasAllowlist: boolean;
    auditLoggingEnabled: boolean;
  };
}
```

## Policy Modes

TOGI supports 5 policy modes with different sensitivity levels:

| Mode | Description | New Member Probation |
|------|-------------|---------------------|
| RELAXED | Low sensitivity, warn before delete | 2 minutes |
| BALANCED | Recommended default | 5 minutes |
| STRICT | High sensitivity | 15 minutes |
| PARANOID | Maximum protection | 30 minutes |
| CUSTOM | User-defined configuration | Varies |

### Policy Configuration Sections

- **spamProtection**: Delete threshold, window, warn count
- **floodProtection**: Max messages, media multiplier
- **linkProtection**: Shortener handling, blocklist/allowlist
- **newMemberProtection**: Probation period, restrictions
- **threatProtection**: Scam/threat pattern actions
- **raidProtection**: Join window, max joins, auto-protect
- **actionPolicy**: Warn/mute/ban limits, durations
- **adminAlerts**: Severity threshold, notification settings

## Fast Path Detection Engine

The fast path detection engine provides sub-20ms threat detection without AI or external API calls.

### Performance Targets

| Metric | Target |
|--------|--------|
| Risk decision p95 | < 20ms |
| Redis operations p95 | < 50ms |
| No AI calls | true |
| No external reputation calls | true |

### Detection Labels

| Label | Description | Typical Score |
|-------|-------------|---------------|
| SPAM | Spam content detected | 30-60 |
| FLOOD | Message flood detected | 30-60 |
| DUPLICATE | Repeated message | 35-50 |
| LINK | Contains URL | varies |
| SHORTENER | URL shortener detected | 45 |
| BLOCKED_DOMAIN | Blocklisted domain | 90 |
| NEW_USER_LINK | New user posting links | 50 |
| SCAM_PATTERN | Scam pattern match | 70 |
| THREAT | Threat detected | 75 |
| HARASSMENT | Harassment detected | 45 |
| MENTION_SPAM | Excessive mentions | 35-60 |
| MEDIA_FLOOD | Media burst detected | 40 |
| RAID_SIGNAL | Raid activity detected | 80 |

### Decision Thresholds

Score ranges by policy mode:

| Mode | ALLOW | WARN | DELETE | DELETE_MUTE | DELETE_BAN |
|------|-------|------|--------|--------------|------------|
| RELAXED | 0-39 | 40-59 | 60-79 | 80-89 | 90-100 |
| BALANCED | 0-29 | 30-49 | 50-69 | 70-89 | 90-100 |
| STRICT | 0-19 | 20-39 | 40-59 | 60-79 | 80-100 |
| PARANOID | 0-9 | 10-29 | 30-49 | 50-69 | 70-100 |

### Implementation Rules

- Detectors **must not** call Telegram API
- Detectors **must not** call external APIs
- Detectors **must only** use:
  - Normalized event data
  - Effective group policy
  - Redis hot state
  - Local static lists
- URL parsing **must not** crash on malformed URLs
- Normalize text for Turkish and English patterns
- Add basic obfuscation handling (repeated letters, spaces, mixed symbols)
- Never store raw message text in DB by default

## Async Worker Pipeline Security

The async worker handles sensitive operations separately from the fast path:

### Audit Event Isolation
- Audit events are queued asynchronously to not block fast-path decisions
- Audit logs include group ID, actor, action, target - NO raw message content
- Database writes use connection pooling to prevent exhaustion

### Domain Intelligence
- URL analysis runs in worker queue, not in webhook handler
- Punycode/homograph detection prevents IDN attacks
- Domain spikes tracked in Redis with TTL to prevent memory exhaustion

### Raid Correlation
- Raid signals correlated across groups to detect coordinated attacks
- Auto-lockdown configurable via RAID_AUTO_LOCKDOWN=true
- Lockdown thresholds: 50 users or 100 messages within 30 seconds
- Prevents botnet-style coordinated spam attacks

### Action Retry Security
- Failed Telegram actions queued for retry with exponential backoff
- Maximum 10 retry attempts per action
- Prevents action loss during transient Telegram API failures

### Worker Failure Isolation
- Worker failures do NOT block webhook fast-path
- API returns 200 immediately, worker processes async
- Metrics track job failures separately for alerting
