# Privacy Model

## Overview

TOGI is designed with privacy as a core principle. This document outlines what data we collect, how we process it, and how long we retain it.

## Data We Collect

### Telegram User Data

We store minimal user data:

| Data | Stored As | Purpose |
|------|----------|---------|
| Telegram User ID | `bigint` | Unique identification |
| Username | `varchar(255)` | Display purposes |
| First Name | `varchar(255)` | Display purposes |
| Last Name | `varchar(255)` | Optional, rarely used |
| Language Code | `varchar(10)` | i18n support |

**We do NOT store:**
- Phone numbers
- Profile photos
- Bio/description
- User messages
- Private messages

### Group Data

| Data | Stored As | Purpose |
|------|----------|---------|
| Telegram Chat ID | `bigint` | Unique identification |
| Group Title | `varchar(255)` | Display |
| Group Type | `varchar(50)` | supergroup/channel detection |
| Status | `varchar(20)` | Active/Left |

## Message Processing

### What Happens to Messages

1. **Webhook receives update**
2. **Parse message** - extract text, links, entities
3. **Normalize** - create safe event metadata
4. **Run detection** - fast path analysis
5. **Take action** - delete/warn/mute/ban if needed
6. **Discard original** - raw message is NOT stored

### What We Store

Instead of raw messages, we store:

```typescript
interface MessageFingerprint {
  id: string;              // UUID
  groupId: string;         // Reference
  textHash: string;       // SHA-256 hash
  linkDomains: string[];  // Extracted domains
  riskScore: number;       // 0-100
  createdAt: timestamp;
}
```

**Key point:** `textHash` is a one-way hash. We cannot recover the original message content.

### Text Hashing

Messages are hashed using SHA-256 before storage:

```typescript
import { createHash } from 'crypto';

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
```

This allows:
- Duplicate detection
- Pattern analysis
- Privacy preservation (original text unrecoverable)

## Audit Logs

Audit logs store moderation actions, NOT content:

```typescript
interface AuditLog {
  id: string;
  groupId: string;
  actorTelegramUserId: number;
  action: 'DELETE' | 'WARN' | 'MUTE' | 'BAN' | 'KICK' | 'LOCKDOWN' | 'POLICY_UPDATE';
  targetType: 'USER' | 'MESSAGE' | 'GROUP' | 'POLICY';
  targetId: string;
  metadata: {
    reason?: string;
    riskScore?: number;
    labels?: string[];
  };
  createdAt: timestamp;
}
```

**No raw message content is ever stored in audit logs.**

## Violations

Violations track moderation events:

```typescript
interface Violation {
  id: string;
  groupId: string;
  telegramUserId: number;
  telegramMessageId: number;
  violationType: string;    // e.g., 'SPAM', 'LINK'
  severity: string;         // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  riskScore: number;
  action: string;          // 'DELETE', 'DELETE_WARN', etc.
  reason: string;          // Human-readable explanation
  labels: string[];       // Detection labels
  createdAt: timestamp;
}
```

Again, no raw message content.

## Data Retention

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Message Fingerprints | 7 days | Short-term duplicate detection |
| Audit Logs | 90 days | Compliance and review |
| Violations | 90 days | Moderation history |
| Group Policies | Indefinite | Until group deletion |
| User Accounts | Until group deletion | Required for operation |
| Review Queue Items | 24 hours | Auto-expire for review |

### Retention Enforcement

Redis keys use TTL to auto-expire:
- Probation state: 24 hours
- Rate limit windows: 60 seconds - 10 minutes
- Raid state: 1 hour
- Action locks: 5 minutes

Database retention enforced by scheduled cleanup job.

## User Rights

### Data Access

Users can request:
- What data we store about them
- Export of their data
- Deletion of their data (where technically feasible)

### How to Request Data

Email: privacy@togi.example.com (placeholder)

### Data Deletion

We can delete:
- User records from our database
- Violation records associated with user
- Audit log entries where user is target

We cannot delete:
- Message fingerprints (hashed, anonymized)
- Archived audit logs (compliance requirement)

## Privacy by Design

### Principles

1. **Minimization** - Only collect what we need
2. **Anonymization** - Hash sensitive data where possible
3. **TTL** - Auto-expire temporary data
4. **No content storage** - Never store raw messages
5. **Limited access** - Admin actions logged and auditable

### Implementation

- Raw messages never written to database
- Text hashed before fingerprint storage
- Redis TTL on all temporary state
- Audit logs structured, not freeform
- Error messages sanitized

## Third-Party Services

### Telegram API

We use Telegram's API to:
- Send messages
- Restrict/ban users
- Check permissions

Telegram's privacy policy applies to data processed by Telegram servers.

### OpenAI (Optional)

If AI classification is enabled:
- Message text sent to OpenAI API
- OpenAI's privacy policy applies
- Can be disabled via `AI_PROVIDER=none`

### Redis/PostgreSQL

User data stored in:
- Redis (temporary state, caching)
- PostgreSQL (persistent storage)

Each has their own privacy/security policies.

## Compliance Notes

### GDPR

- User consent not explicitly required for Telegram bot operation
- Users can request data access/deletion
- Data retention documented and enforced

### Telegram Privacy Policy

Users should review Telegram's privacy policy at telegram.org/privacy

## Future Enhancements

1. **User data portal** - Self-service data export/deletion
2. **Encryption at rest** - PostgreSQL transparent encryption
3. **Audit log archival** - Move old logs to cold storage
4. **Consent management** - Explicit consent for optional features
