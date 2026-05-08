# TECH_DEBT.md

## Known Issues

### High Priority (Before v1.0)

- [ ] No input validation on webhook payloads (Phase 09)
- [ ] Missing authentication on some API endpoints (Phase 09)
- [ ] Policy engine has no versioning (Phase 03 - COMPLETED in Phase 08)
- [ ] Webhook signature verification (Phase 01 - COMPLETED in Phase 08)

### Medium Priority (Before v1.1)

- [x] No connection pooling for Redis (Phase 07)
- [ ] Worker retries are not exponential backoff (Phase 06)
- [x] Missing indexes on `audit_log.created_at` (Phase 02)
- [x] No API pagination for audit logs (Phase 05)
- [x] No rate limiting on dashboard endpoints (Phase 08 - COMPLETED)

### Low Priority (Before v1.2)

- [ ] Shared types duplicated between packages
- [ ] No structured logging format
- [ ] Missing health check for Redis
- [ ] Dashboard not responsive on mobile
- [ ] No dark mode in dashboard

## Phase 08 Security Hardening Completed

### Secrets Management
- [x] Bot token validation added
- [x] Webhook secret validation added
- [x] Database credentials not exposed in errors
- [x] Env validation with Zod

### Admin Authorization
- [x] `/warn`, `/mute`, `/ban`, `/lockdown`, `/unlockdown` verify Telegram admin status
- [x] Rate limiting on commands per user
- [x] Action loop prevention
- [x] Bot ignores its own messages

### Abuse Prevention
- [x] Per-group action rate limits
- [x] Per-user command rate limits
- [x] Global Telegram API throttle
- [x] Action loops prevented

### Error Handling
- [x] Structured error codes
- [x] Telegram API errors caught and handled
- [x] Redis failures degrade gracefully

### Observability
- [x] Health check endpoint
- [x] Metrics endpoint on worker

## Architecture Decisions to Revisit

### 1. Redis for Session Storage
Current: Plain Redis for session data
Consider: Encrypted JWT or Redis with AUTH
Decision: v1.2

### 2. Synchronous Policy Evaluation
Current: All policies evaluated synchronously
Consider: Async evaluation for complex rules
Decision: v1.1

### 3. PostgreSQL for All Data
Current: All persistent data in PostgreSQL
Consider: Redis for hot data, PG for cold
Decision: Already hybrid (Redis cache, PG persist)

### 4. Long Polling vs Webhooks
Current: Webhooks only
Consider: Fallback to long polling for resilience
Decision: v1.2

## Dependencies to Monitor

| Dependency | Current | Consider Upgrade | Blocked By |
|------------|---------|------------------|------------|
| Node.js | 20 LTS | 22 LTS | - |
| Fastify | 4.x | 5.x | Plugin compat |
| BullMQ | 5.x | 6.x | - |
| ioredis | 5.x | 6.x | - |
| pg | 8.x | 8.x | - |

## Performance Optimizations

### Planned for v1.1
1. Connection pooling with pgBouncer
2. Redis cluster mode for production
3. CDN for static assets
4. Database read replicas

### Planned for v1.2
1. API response caching
2. Worker job batching
3. Batch database writes
4. Message compression in Redis

## Testing Gaps

### Before v1.0
- [ ] Load testing script
- [ ] E2E tests for webhook flow
- [ ] Integration tests for policy engine
- [ ] Chaos testing for worker resilience
- [ ] Security tests (Phase 09)

### Before v1.1
- [ ] Property-based testing for detection
- [ ] Mutation testing
- [ ] Contract tests for API

## Refactoring Candidates

### packages/shared
Current: Flat utility exports
Consider: Namespaced by feature
Decision: v1.1

### packages/config
Current: env + secrets mixed
Consider: Separate config packages
Decision: v1.2

## Deprecation Plan

- [ ] Remove `longpoll` fallback after v1.0 (webhooks stable)
- [ ] Remove legacy `fastpath` module after v0.5
- [ ] Remove `pg-monitor` after v0.7

## Known Production Gaps

1. **Telegram Login Widget** - Not yet implemented
2. **Per-IP rate limiting** - Logs IPs but doesn't block
3. **Math captcha** - Future enhancement
4. **Penetration testing** - Needs external audit
5. **Secrets rotation** - No automated rotation
6. **User data portal** - Self-service export/deletion
7. **Encryption at rest** - PostgreSQL transparent encryption
