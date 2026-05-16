# Data Privacy

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

TOGI collects and processes user data to provide security services. This document outlines data handling practices and privacy controls.

---

## Data Categories

### 1. Telegram User Data

**Collected:**
- Telegram User ID (numeric)
- Username (optional)
- First name
- Last name
- Language code

**Purpose:** User identification and trust tracking

**Retention:** Indefinite (until user deletion request)

### 2. Group Data

**Collected:**
- Telegram Chat ID (numeric)
- Group title
- Group type (supergroup/group)
- Bot admin status

**Purpose:** Group configuration and policy management

**Retention:** Until group deletion or bot removal

### 3. Message Data

**Collected:**
- Message ID (numeric)
- Text content (hashed for duplicate detection)
- Text hash (SHA256)
- Link domains (extracted)
- Media type indicator

**Purpose:** Content moderation and duplicate detection

**Retention:**
- Original text: Not stored (only hash)
- Fingerprints: 30 days (configurable)
- Link domains: 90 days

### 4. Violation Data

**Collected:**
- Violation type
- Severity level
- Risk score
- Action taken
- Reason

**Purpose:** Security tracking and policy enforcement

**Retention:** 1 year, then archived for 2 years

### 5. Audit Logs

**Collected:**
- Action performed
- Actor (Telegram user ID)
- Target (user/group ID)
- Timestamp
- Metadata

**Purpose:** Security audit trail

**Retention:** 3 years

### 6. Trust Scores

**Collected:**
- Global risk score
- Violation counts
- First/last seen timestamps
- Labels (spam, malicious, etc.)

**Purpose:** User risk assessment

**Retention:** Until user requests deletion

---

## Privacy Controls

### Cross-Group Data Isolation

**Implementation:** Each group has isolated data

```typescript
// Group admin can only access their group's data
const admins = await db
  .select()
  .from(groupAdmins)
  .where(and(
    eq(groupAdmins.groupId, groupId),
    eq(groupAdmins.telegramUserId, userId)
  ));
```

**Enforcement:** All queries include group ID filter

### Intelligence Sharing Controls

Groups can opt in/out of cross-group intelligence:

```typescript
const settings = await db
  .select()
  .from(groupIntelligenceSettings)
  .where(eq(groupIntelligenceSettings.groupId, groupId));

// consumeGlobalWatchlist: Share threat data with other groups
// contributeAnonymousSignals: Contribute to global threat database
```

**Default:** Both enabled, but configurable per group

### Data Minimization

**Principles:**
1. Store only necessary data
2. Hash sensitive content where possible
3. Use aggregates instead of raw data for reporting
4. Delete data when no longer needed

---

## Data Retention

### Retention Schedule

| Data Type | Active Period | Archived Period | Total |
|-----------|---------------|-----------------|-------|
| User profiles | Until deletion | 2 years | Indefinite |
| Group data | Active | 1 year | Until deletion |
| Violations | 1 year | 2 years | 3 years |
| Audit logs | 3 years | - | 3 years |
| Message fingerprints | 30 days | - | 30 days |
| Captcha data | 5 minutes | - | 5 minutes |
| Sessions | 7 days | - | 7 days |

### Automated Cleanup

**Cron Jobs:**
1. Daily: Clean expired sessions
2. Weekly: Archive old violations
3. Monthly: Clean old message fingerprints

**Implementation:**
```typescript
// Message fingerprint cleanup
await db.delete(messageFingerprints)
  .where(lt(messageFingerprints.createdAt, subDays(new Date(), 30)));

// Session cleanup
await db.delete(sessions)
  .where(lt(sessions.expiresAt, new Date()));
```

---

## User Rights

### Data Access

Users can request:
1. Export of their data (GDPR Article 15)
2. Correction of inaccurate data (GDPR Article 16)
3. Deletion of their data (GDPR Article 17)

**Request Process:**
1. Contact group admin or TOGI support
2. Verify identity via Telegram
3. Provide data within 30 days

### Opt-Out

Users can:
1. Leave group to stop data collection
2. Request data deletion via support
3. Disable intelligence sharing (group admin)

---

## Sensitive Data Handling

### Telegram Token

- Stored as environment variable
- Never logged
- Never displayed in UI
- Rotated on suspected compromise

### JWT Secret

- Minimum 32 characters
- Stored as environment variable
- Never logged
- Rotated annually

### PostgreSQL Password

- Stored as environment variable
- Used only for DB connection
- Never logged

---

## Privacy by Design

### Data Flow

```
Telegram Update
      ↓
Parse & Normalize
      ↓
Hash Sensitive Data
      ↓
Store Minimal Data
      ↓
Apply Retention Policy
```

### Isolation

- Database schema enforces tenant isolation
- Redis keys namespaced by group
- No cross-group admin access

### Transparency

- Users can see their trust score
- Admins can see violation history
- Group policies visible to all admins

---

## Compliance Considerations

### GDPR (EU)

- Lawful basis: Legitimate interest (security)
- Data subject rights: Supported
- Data transfer: US-based (adequacy decision)
- DPO: Not required (low risk)

### CCPA (California)

- Right to know: Supported
- Right to delete: Supported
- Opt-out of sale: Not applicable (no data sale)

### Telegram Platform Policy

- Comply with Telegram Terms of Service
- User consent for data processing via bot usage
- No data sharing with third parties

---

## Audit Checklist

- [ ] Data minimization practiced
- [ ] Cross-group isolation enforced
- [ ] Retention policies defined and enforced
- [ ] User deletion requests honored
- [ ] Sensitive data not logged
- [ ] Intelligence sharing is opt-in
- [ ] Data access logged for audit
- [ ] Privacy policy published