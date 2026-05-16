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
**STATUS: NOT IMPLEMENTED — SECURITY GAP**

- Store last 1000 update IDs in Redis
- Reject updates with ID <= last processed
- TTL: 24 hours

**Implementation Required:** Add `webhook:processed-ids` Redis set in `apps/api/src/routes/webhook.ts`

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

| Endpoint | Limit | Window | Status |
|----------|-------|--------|---------|
| `/webhook/telegram` | 1000 req/s | per second | ✅ Implemented |
| `/api/*` | 100 req/s | per second | ✅ Implemented |
| Per IP | NOT IMPLEMENTED | - | ❌ GAP |
| Per user actions | 10/s | per second | ✅ Implemented |

## Input Sanitization

All user input is sanitized:
- SQL queries use parameterized statements (Drizzle ORM)
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
  permissions: number;      // 0-25
  protections: number;     // 0-30
  lists: number;            // 0-10
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
|------|-------------|----------------------|
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

| Metric | Target | Status |
|--------|--------|--------|
| Risk decision p95 | < 20ms | **NOT VALIDATED** |
| Redis operations p95 | < 50ms | **NOT VALIDATED** |
| No AI calls | true | ✅ |
| No external reputation calls | true | ✅ |

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

---

## Phase 02 Hardening (v0.2.0)

### Rate Limiting Tiers
Redis-backed sliding-window rate limiting with 7 distinct tiers:
- **Public auth**: 10 req/min per IP, with abuse tracking (5 failures → 1h block)
- **Dashboard API**: 100 req/min per session
- **Policy mutations**: 10 changes/5min per group
- **Domain rule ops**: 20 ops/min per group
- **Review queue ops**: 30 ops/min per group
- **Webhook per-chat**: 30 updates/sec per chat (Telegram hard limit)

### Webhook Replay Protection Architecture
Update state machine in Redis:
```
update_state:{updateId} = RECEIVED → PROCESSING → PROCESSED
                                    ↘ FAILED_RETRIABLE → (retry)
                                    ↘ FAILED_FINAL
```
- Duplicate (PROCESSED): Return 200 without reprocessing
- Concurrent (PROCESSING): Return 200, let first processor finish
- Lock TTL: 30s to prevent thundering herd on retries

### Action Idempotency Locks
Destructive Telegram actions locked by `action_lock:{chatId}:{messageId}:{actionType}` (5min TTL) to prevent duplicate operations.

### Security Headers
All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` (configurable)

### CORS Allowlist
- API: No wildcard, explicit allowlist per environment
- Webhook: No CORS (not needed for Telegram callbacks)
- Dashboard: Credentialed requests with explicit origin validation

### Degraded Mode Behavior
When Redis is unavailable:
- Dashboard mutations: `fail_closed` (blocks writes by default)
- Webhook processing: `fail_open` (allows minimal processing by default)
- Configurable via `REDIS_DEGRADED_MODE` env var

---

## Security Audit Findings (2026-05-16)

### CRITICAL
1. **Production auth not implemented** — Dashboard unusable in production
2. **Webhook replay protection missing** — SECURITY_MODEL.md specifies but code doesn't implement
3. **No Dockerfiles** — Cannot containerize for deployment

### HIGH
4. **Per-IP rate limiting not implemented** — `ipLoggingMiddleware` logs but doesn't block
5. **RBAC not enforced** — groupAdmins table exists but no middleware verification
6. **Command target resolution broken** — `/warn @username` can't resolve targets

### MEDIUM
7. **No CI/CD pipeline** — No automated tests on PR
8. **BullMQ processors untested** — 5 processors exist but never validated
9. **Policy not cached** — DB query on every message
10. **Redis single instance** — SPOF, no Cluster

### LOW
11. **Rate limit headers missing** — No X-RateLimit-* response headers
12. **Slow mode incomplete** — Lockdown works, slow mode not implemented
13. **Homoglyph detection missing** — IDN attacks possible
14. **No Prometheus on API** — PERFORMANCE_MODEL.md specifies but not implemented

---

## Security Checklist

```
PRE-RELEASE (v0.2.0):
[ ] Telegram Login Widget auth implemented
[ ] Webhook replay protection implemented
[ ] Per-IP rate limiting enforced
[ ] RBAC middleware verifying group admin
[ ] Dockerfiles created for all apps
[ ] CI/CD pipeline with test automation

ONGOING:
[ ] Bot token never logged
[ ] Raw messages never stored
[ ] Audit logs retained max 90 days
[ ] Session tokens expire 24h
[ ] Secrets in .env only, not committed

---

## Threat Intelligence (Phase 07)

### Architecture
- User risk profiles aggregated globally, but only non-content data stored
- Group user profiles isolated per group (never shared)
- Threat indicators use hashed values, not raw content
- Cross-group promotion requires multiple independent sources

### Privacy Guarantees
- NO raw message text ever leaves a group
- NO user identifiers in threat indicator shares
- NO group-specific data exposed to other groups
- All domain/URL/text values are SHA256 hashed before sharing

### Trust Score System
- New users start at trust score 50
- Trust increases with positive behavior
- Trust decreases with violations
- High trust scores can reduce false positive risk scores by up to 15 points
- Group admins always have maximum trust

### Cross-Group Threat Sharing
- Indicators promoted from local to global when:
  - Same domain/hash seen in 3+ groups
  - Risk score meets threshold (70 for BLOCK, 40 for WATCH)
- Auto-block only enabled in STRICT/PARANOID modes
- Groups can opt out of either consuming or contributing
```