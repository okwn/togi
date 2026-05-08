# Security Checklist

## Pre-Deployment

### Secrets Management
- [ ] `TELEGRAM_BOT_TOKEN` stored securely, never in git
- [ ] `TELEGRAM_WEBHOOK_SECRET` is at least 32 characters
- [ ] `JWT_SECRET` is at least 32 characters, unique per environment
- [ ] `POSTGRES_PASSWORD` is strong (min 16 chars, mixed case, numbers, symbols)
- [ ] `REDIS_PASSWORD` is set for production
- [ ] No secrets in environment variables that get committed to git
- [ ] `.env.local` is in `.gitignore`

### Token Handling
- [ ] Bot token redacted in all logs
- [ ] Webhook secret never logged
- [ ] Database credentials never in logs
- [ ] Error messages don't expose internal details

## Webhook Security
- [ ] `X-Telegram-Bot-Api-Secret-Token` header verified on every request
- [ ] Invalid secrets return 401 without leaking details
- [ ] Request size limited to prevent DoS
- [ ] Webhook returns 200 even on processing errors (prevents Telegram retry storms)

## Authentication & Authorization
- [ ] Dashboard requires authentication in production
- [ ] Telegram Login Widget implemented (or documented plan exists)
- [ ] Admin-only commands check Telegram admin status via API
- [ ] Non-admin users cannot execute `/ban`, `/mute`, `/lockdown`
- [ ] Admin protection: bot never auto-punishes group admins
- [ ] Local DB role is not sole authority for admin status

## Rate Limiting
- [ ] Per-group action rate limits configured
- [ ] Per-user command rate limits configured
- [ ] Global Telegram API throttle in place (25 req/sec per chat)
- [ ] Rate limit violations return appropriate errors
- [ ] Rate limit state stored in Redis

## Abuse Prevention
- [ ] Action loops prevented (same action on same user within window)
- [ ] Bot ignores its own messages to prevent loops
- [ ] No endless response chains
- [ ] Replay protection: update IDs tracked in Redis

## Input Validation
- [ ] All user input validated with Zod schemas
- [ ] Policy changes validated before applying
- [ ] Invalid thresholds rejected (e.g., negative values)
- [ ] PARANOID mode requires confirmation before enabling
- [ ] Policy versioning implemented

## Data Privacy
- [ ] Raw message text NOT stored by default
- [ ] Text hashes stored instead
- [ ] Audit logs contain only metadata, not content
- [ ] Labels, reasons, risk scores stored, not original text
- [ ] Retention policy documented and implemented
- [ ] User data minimized (only store Telegram ID + username)

## Audit Logging
- [ ] All destructive actions logged (delete, mute, ban, kick)
- [ ] All policy changes logged with version
- [ ] All lockdown/unlockdown events logged
- [ ] All domain rule changes logged
- [ ] Logs include: actor, target, reason, timestamp
- [ ] Logs do NOT include raw message content
- [ ] Audit logs immutable

## Error Handling
- [ ] Telegram API errors don't crash worker/API
- [ ] DB failures return safe 500 errors
- [ ] Redis failures degrade gracefully (fail open where appropriate)
- [ ] Structured error codes used
- [ ] No stack traces in production responses

## Observability
- [ ] Health check endpoint (`/health`)
- [ ] Readiness check endpoint (`/ready`)
- [ ] Request IDs in all logs
- [ ] Metrics endpoint exposed
- [ ] Webhook count metric
- [ ] Action count metric
- [ ] Violation count metric
- [ ] Telegram API error count metric
- [ ] Queue depth metric
- [ ] Worker failure count metric

## Docker Security
- [ ] Containers use project-specific names (`togi-api`, not `api`)
- [ ] Restart policy is safe (`unless-stopped` or `on-failure`)
- [ ] Health checks configured for all services
- [ ] Ports driven by environment variables
- [ ] No hardcoded credentials in Dockerfiles
- [ ] Non-root user in containers (if possible)

## Compliance
- [ ] Data retention policy documented
- [ ] User data can be deleted on request (GDPR)
- [ ] Audit logs retained appropriately
- [ ] No PII in logs

## Testing Security
- [ ] Webhook secret required in production tests
- [ ] Token redaction tested
- [ ] Unauthorized command denial tested
- [ ] Admin protection tested
- [ ] Policy validation tested
- [ ] Rate limit behavior tested
- [ ] Error handling tested

## Known Gaps (Document for Later)

1. **Telegram Login Widget** - Not yet implemented, planned for Phase 09
2. **Per-IP rate limiting** - Not yet implemented on API endpoints
3. **Math captcha** - Future enhancement for verification
4. **Email/SMS verification** - Future high-security option
5. ** penetration testing** - Needs external security audit
6. **Secrets rotation** - No automated rotation mechanism
7. **IP blocking** - Logs IPs but doesn't block by default

## Verification Commands

```bash
# Test webhook secret requirement
curl -X POST http://localhost:4310/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1}'

# Should return 401 without valid secret in production

# Test token redaction
grep -r "TELEGRAM_BOT_TOKEN" /home/oguz/Masaüstü/Togi --include="*.log" | wc -l
# Should be 0

# Test rate limiting
for i in {1..20}; do
  curl http://localhost:4310/api/groups
done
# Final requests should be rate limited
```
