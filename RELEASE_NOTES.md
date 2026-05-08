# Release Notes - v0.1.0 MVP

## Version Overview

**TOGI v0.1.0** is the first MVP release of the Telegram Guard Interface platform.

## MVP Scope

This release establishes the core architecture for an async-first Telegram moderation bot with:
- Sub-20ms fast-path detection
- Background worker processing
- Web dashboard for group management
- Privacy-preserving design

## Implemented Features

### Core Protection Engine
- [x] **Fast Path Detection** - Rule-based detection without AI, sub-20ms latency
- [x] **Flood Protection** - Message rate limiting with configurable thresholds
- [x] **Spam Detection** - Pattern matching for spam content
- [x] **Link Protection** - Shortener detection, blocked domains, suspicious TLDs
- [x] **Duplicate Detection** - Message fingerprinting to catch repeated content
- [x] **Mention Spam** - Excessive mention detection
- [x] **Media Flood** - Burst of media messages detection

### New Member Protection
- [x] **Probation System** - Configurable probation period for new joiners
- [x] **Link Blocking During Probation** - Prevent new users from posting links
- [x] **Media Blocking During Probation** - Restrict media posting
- [x] **Verification Challenge** - Lightweight "I am human" button

### Raid Protection
- [x] **Join Spike Detection** - Redis sorted set-based threshold detection
- [x] **Raid Mode** - Automatic mode activation on threshold breach
- [x] **Auto-Lockdown** - Automatic group lockdown during raids
- [x] **Manual Unlock** - Admin override for raid lockdown

### Policy System
- [x] **Four Policy Modes** - RELAXED, BALANCED, STRICT, PARANOID
- [x] **Configurable Thresholds** - Per-mode tuning
- [x] **Policy Versioning** - Audit trail for policy changes
- [x] **Security Score** - 0-100 quantification of group security

### Action Execution
- [x] **Delete Message** - Remove violating messages
- [x] **Warn User** - Send warning notification
- [x] **Mute User** - Temporary restriction with duration
- [x] **Ban User** - Permanent removal
- [x] **Kick User** - Ban + immediate unban
- [x] **Lockdown** - Restrict all group members
- [x] **Idempotency** - Action locks prevent duplicates

### Async Worker Pipeline
- [x] **BullMQ Queues** - 5 queues: async-analysis, action-retry, audit-events, domain-intel, raid-correlation
- [x] **Graceful Shutdown** - Drain jobs before exit
- [x] **Retry Logic** - Configurable retry attempts
- [x] **Metrics Endpoint** - Prometheus-compatible metrics

### Dashboard
- [x] **Group Overview** - Security score, recent actions, bot status
- [x] **Policy Editor** - Visual policy configuration
- [x] **Domain Rules** - Block/allow list management
- [x] **Audit Logs** - Searchable moderation history
- [x] **Review Queue** - Pending items for admin review
- [x] **Raid Status Banner** - Visual raid indicator

### Security Hardening
- [x] **Webhook Verification** - X-Telegram-Bot-Api-Secret-Token validation
- [x] **Admin Authorization** - Telegram admin status verification
- [x] **Rate Limiting** - Per-group, per-user, global API
- [x] **Action Loop Prevention** - Block repeated actions
- [x] **Env Validation** - Zod schema for all env vars
- [x] **Structured Errors** - Consistent error code format
- [x] **Privacy Model** - No raw message storage

### Observability
- [x] **Health Check Endpoint** - `/health`
- [x] **Worker Metrics** - Prometheus format on port 4390
- [x] **Request IDs** - All logs tagged with request ID
- [x] **Structured Logging** - JSON logs for production

## Architecture Highlights

### Fast Path
The fast path uses only Redis for state and local rules for detection, achieving sub-20ms p95 latency. No database calls, no external API calls during detection.

### Async Processing
Deep analysis (AI classification, domain intelligence, raid correlation) happens in background workers via BullMQ queues, ensuring the webhook responds within 200ms.

### Privacy by Design
- Raw messages never stored
- Text hashed before fingerprinting
- All operations are logged as metadata only
- Redis TTL for temporary state

## Database Schema

### Core Tables
- `users` - Telegram user info (minimal)
- `groups` - Group configuration
- `group_policies` - Versioned policy storage
- `violations` - Moderation events
- `punishments` - Active restrictions
- `audit_logs` - All actions with metadata
- `domain_rules` - Block/allow lists
- `message_fingerprints` - Hashed for duplicate detection
- `review_queue` - Admin review items

### Redis Keys
- `rate:user:{chatId}:{userId}` - User rate limits
- `duplicate:{chatId}:{hash}` - Message fingerprints
- `probation:{chatId}:{userId}` - New member state
- `raid_state:{chatId}` - Active raid state
- `lockdown:{chatId}` - Active lockdown
- `action_lock:{chatId}:{msgId}:{action}` - Idempotency

## Known Limitations

### Security
1. **Dashboard Auth** - Uses dev auth header only, Telegram Login Widget not implemented
2. **Per-IP Rate Limiting** - Logs IPs but doesn't block requests
3. **Secrets Rotation** - No automated rotation mechanism

### Features
1. **Captcha** - Only "I am human" button, no math/emoji captcha
2. **User Data Portal** - Self-service export/deletion not available
3. **Multi-language** - Only English, Turkish partially supported
4. **Cross-group Intelligence** - Not yet implemented

### Technical
1. **No Load Testing** - Performance validated manually
2. **No E2E Tests** - Unit tests only
3. **Dockerfile** - API/Web/Worker Dockerfiles need creation

## Next Steps (v0.2.0)

### Priority 1 - Production Hardening
- [ ] Implement Telegram Login Widget for dashboard
- [ ] Add per-IP rate limiting
- [ ] External security audit
- [ ] Secrets rotation mechanism

### Priority 2 - Enhanced Detection
- [ ] Math captcha for verification
- [ ] Emoji captcha for verification
- [ ] Cross-group threat intelligence
- [ ] Advanced analytics dashboard

### Priority 3 - Scale
- [ ] Connection pooling (pgBouncer)
- [ ] Redis Cluster support
- [ ] Horizontal scaling
- [ ] Database read replicas

## Migration Notes

v0.1.0 is a fresh installation. No migration path from previous versions.

## Breaking Changes

None - this is the first release.

## Deprecation Notes

None - this is the first release.
