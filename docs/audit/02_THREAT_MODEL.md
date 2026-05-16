# Threat Model

**Version:** 1.0.0
**Date:** 2026-05-16
**Status:** DRAFT - External Review Required

---

## Threat Model Methodology

This threat model uses STRIDE methodology:
- **S**poofing identity
- **T**ampering with data
- **R**epudiation
- **I**nformation disclosure
- **D**enial of service
- **E**levation of privilege

Each threat includes:
- Attack vector
- Affected component
- Impact severity
- likelihood
- Existing mitigations
- Missing controls (if any)

---

## THREAT-1: Malicious Telegram User

### Description
A bad actor sends messages with malicious content designed to evade detection or exploit vulnerabilities.

### Attack Vectors

1. **Obfuscated links** - Use homograph attacks, URL shorteners, or encoded characters
2. **Media-based attacks** - Embed malicious content in images/video (future)
3. **Message flooding** - Spam the group with violating content
4. **Social engineering** - Phishing links disguised as legitimate content
5. **New member account rotation** - Create multiple accounts to bypass new user restrictions

### Affected Components
- `apps/api/src/routes/webhook.ts` (Detection engine)
- `packages/detection-engine/` (Fast path)
- `packages/detection-engine/src/detectors/` (Content analysis)

### Existing Mitigations
- Text normalization before hash comparison
- Domain rules with regex support
- Link extraction and analysis
- New member probation period
- Trust score tracking
- Captcha verification for new users

### Impact
- **HIGH** - Group compromised with malicious content
- User trust erosion

### Likelihood
- **MEDIUM** - Common attack pattern

### Missing Controls
- Media analysis not fully implemented (see `packages/detection-engine/src/detectors/media-analysis/`)
- No account rotation detection beyond new member signals

---

## THREAT-2: Malicious Group Admin

### Description
A group admin with OWNER/SUPERVISOR role abuses their privileges.

### Attack Vectors

1. **Policy weakening** - Set policy to RELAXED or disable protections
2. **False positives** - Manually warn/ban legitimate users
3. **RBAC manipulation** - Promote malicious users to admin
4. **Data exfiltration** - View audit logs and reports for intelligence gathering
5. **Agent abuse** - Configure autonomous agent to perform harmful actions

### Affected Components
- `apps/api/src/routes/groups.ts` (Policy management)
- `apps/api/src/middleware/auth.ts` (RBAC)
- `packages/policy-engine/` (Policy evaluation)

### Existing Mitigations
- RBAC with 4-tier role system
- Audit logs for all admin actions
- OWNER role required for policy changes
- Agent actions require human approval by default

### Impact
- **HIGH** - Insider threat, difficult to detect
- Group users suffer unfair moderation

### Likelihood
- **LOW** - Requires compromised admin account

### Missing Controls
- No audit log anomaly detection
- No dual-admin requirement for critical actions
- No admin action review workflow

---

## THREAT-3: Compromised Bot Token

### Description
Attackers obtain the Telegram bot token and use it to access the API.

### Attack Vectors

1. **Token exfiltration** - Steal token from environment/config
2. **Man-in-the-middle** - Intercept token during configuration
3. **Git history exposure** - Token committed to version control

### Affected Components
- `apps/api/src/server.ts` (Telegram client initialization)
- Environment configuration

### Existing Mitigations
- Webhook secret for inbound verification
- Production validation: bot token required
- No token logging

### Impact
- **CRITICAL** - Full bot compromise
- Attacker can read messages, ban users, extract data

### Likelihood
- **LOW** - Token is secret; Telegram rotates on suspected compromise

### Missing Controls
- Token rotation mechanism
- Token exposure monitoring (GitHub secret scanning)
- Multiple bot support for key rotation

---

## THREAT-4: Replay Attack

### Description
Attacker replays a previously processed webhook update to cause duplicate actions or bypass detection.

### Attack Vectors

1. **Message replay** - Resend a valid message update
2. **Member update replay** - Replay chat member updates
3. **Callback query replay** - Replay button clicks

### Affected Components
- `apps/api/src/routes/webhook.ts` (Webhook handler)
- `apps/api/src/services/idempotency.ts` (Idempotency service)

### Existing Mitigations
- Redis-based idempotency with 24h TTL (`update_state:{updateId}`)
- Processing lock with 30s TTL (`update_lock:{updateId}`)
- Lua script for atomic claim update (Phase 13 fix)

### Impact
- **MEDIUM** - Duplicate actions, wasted resources
- Potential for double-punishment

### Likelihood
- **MEDIUM** - Common attack if webhook secret is known

### Missing Controls
- None significant - atomic Lua script provides strong protection

---

## THREAT-5: Webhook Spoofing

### Description
Attacker sends fake webhook updates without knowing the secret token.

### Attack Vectors

1. **Direct API calls** - POST to webhook endpoint without Telegram
2. **Signature forgery** - Attempt to guess HMAC secret
3. **IP spoofing** - Impersonate Telegram servers

### Affected Components
- `apps/api/src/routes/webhook.ts` (Webhook verification)

### Existing Mitigations
- `x-telegram-bot-api-secret-token` header validation
- Secret token set in production (enforced)
- Invalid secret → 401 Unauthorized

### Impact
- **HIGH** - If secret is weak or not set
- Service disruption, false positives

### Likelihood
- **LOW** - Secret is strong by default (32+ char random)

### Missing Controls
- Telegram IP whitelist (Telegram publishes IP ranges)
- Webhook certificate validation (self-signed cert)

---

## THREAT-6: Dashboard Account Takeover

### Description
Attacker gains access to an admin's dashboard account.

### Attack Vectors

1. **Credential stuffing** - Reuse breached passwords
2. **Session hijacking** - Steal JWT cookie
3. **CSRF attack** - Perform actions via browser
4. **Phishing** - Fake login page

### Affected Components
- `apps/api/src/middleware/auth.ts` (Authentication)
- `apps/api/src/routes/auth.ts` (Login)
- `apps/web/` (Dashboard UI)

### Existing Mitigations
- JWT authentication with configurable expiry
- CSRF token validation on state-changing endpoints
- HttpOnly, Secure, SameSite=Strict cookies
- Rate limiting on login attempts (5 failed per 15min)

### Impact
- **HIGH** - Full admin access to group
- RBAC privileges inherited

### Likelihood
- **MEDIUM** - Common web attack vector

### Missing Controls
- Multi-factor authentication (MFA)
- Session invalidation on password change
- Login anomaly detection

---

## THREAT-7: RBAC Bypass

### Description
Attacker or malicious user escalates privileges beyond their role.

### Attack Vectors

1. **Role enumeration** - Find ways to grant higher roles
2. **Permission inference** - Abuse weak permission checks
3. **JWT claim manipulation** - Modify role claims in token

### Affected Components
- `apps/api/src/middleware/auth.ts` (RBAC middleware)
- `packages/auth/` (Permission definitions)

### Existing Mitigations
- Server-side role lookup from database
- Permission checks on every endpoint
- OWNER role required for sensitive operations

### Impact
- **HIGH** - Privilege escalation to admin level

### Likelihood
- **LOW** - Role is server-side, not in JWT claims

### Missing Controls
- None significant - role is always from DB

---

## THREAT-8: Mass False-Positive Punishment

### Description
A bug or misconfiguration causes TOGI to punish many legitimate users incorrectly.

### Attack Vectors

1. **Policy misconfiguration** - Admin sets too strict thresholds
2. **Detection bug** - Classifier marks legitimate content as violation
3. **Domain rules over-blocking** - Block legitimate domains
4. **Queue cascade** - Mass report generation

### Affected Components
- `packages/detection-engine/` (Detection logic)
- `packages/policy-engine/` (Policy evaluation)
- `apps/api/src/routes/webhook.ts` (Action execution)

### Existing Mitigations
- REVIEW action for uncertain detections (queues for human review)
- Human approval required for autonomous agent actions
- Audit logs track all punishments
- Agent safety level restricts auto-actions

### Impact
- **MEDIUM** - Legitimate users banned/muted
- Reputation damage to bot

### Likelihood
- **MEDIUM** - Can happen with misconfiguration

### Missing Controls
- Dry-run mode for policy changes
- Rate limit on auto-punishments
- Anomaly detection on punishment spike

---

## THREAT-9: LLM Prompt Injection

### Description
Attacker crafts messages that manipulate the LLM to perform unintended actions or leak information.

### Attack Vectors

1. **Context injection** - Embed instructions in message text
2. **Role confusion** - Make model assume different role
3. **Jailbreaking** - Use advanced prompts to bypass safety

### Affected Components
- `packages/security-agent/src/agent/core.ts` (Agent core)
- `packages/security-agent/src/llm/` (LLM providers)
- `packages/detection-engine/src/classifiers/` (Classification)

### Existing Mitigations
- Prompt structure isolation
- Circuit breaker on LLM failures
- Safety level restrictions on agent
- Human approval for high-impact actions

### Impact
- **HIGH** - Agent performs harmful actions
- Data exfiltration possible

### Likelihood
- **MEDIUM** - Common for LLM-integrated systems

### Missing Controls
- Input sanitization before LLM prompts
- Prompt injection detection
- LLM output validation

---

## THREAT-10: Cross-Group Privacy Leakage

### Description
Data from one group is inadvertently disclosed to users of another group.

### Attack Vectors

1. **Intelligence sharing** - Threat indicators leak between groups
2. **Report exposure** - Group data in shared reports
3. **Admin cross-access** - Admin sees data from non-admin groups
4. **Recommendations leak** - Agent recommendations expose group data

### Affected Components
- `packages/security-agent/` (Intelligence sharing)
- `apps/api/src/routes/groups.ts` (Report access)
- `packages/policy-engine/src/reports/` (Report generation)

### Existing Mitigations
- Group-based RBAC isolation
- Privacy settings per group
- `contributeAnonymousSignals` flag control
- `consumeGlobalWatchlist` flag control

### Impact
- **HIGH** - Privacy violation
- Groups may not trust intelligence sharing

### Likelihood
- **LOW** - Isolation exists but not fully tested

### Missing Controls
- Privacy audit for intelligence system
- Data minimization in shared signals
- Group consent mechanism for intelligence sharing

---

## THREAT-11: Redis/DB Outage

### Description
Redis or PostgreSQL becomes unavailable, affecting core functionality.

### Attack Vectors

1. **Redis connection loss** - Rate limiting fails, idempotency lost
2. **PostgreSQL connection loss** - All data operations fail
3. **Split-brain** - Cache inconsistency under network partition

### Affected Components
- `packages/db/src/redis.ts` (Redis client)
- `packages/db/src/index.ts` (DB client)

### Existing Mitigations
- `REDIS_DEGRADED_MODE` config: `fail_open` or `fail_closed`
- `DB_DEGRADED_MODE` config: `fail_open` or `fail_closed`
- Graceful degradation (skip caching, reject auth)
- Health check endpoint shows dependency status

### Impact
- **MEDIUM** - Service degraded but not down
- Potential for rate limit bypass during fail_open

### Likelihood
- **LOW** - Typical infrastructure issue

### Missing Controls
- Redis Sentinel/Cluster for HA
- PostgreSQL read replicas
- Circuit breaker for database operations

---

## THREAT-12: Telegram API Outage

### Description
Telegram API becomes unavailable or rate-limited, preventing TOGI from functioning.

### Attack Vectors

1. **API ban** - Telegram blocks bot due to policy violation
2. **Rate limiting** - Too many requests trigger Telegram limits
3. **Service disruption** - Telegram API downtime

### Affected Components
- `apps/api/src/routes/webhook.ts` (Outbound actions)
- `packages/telegram-client/` (Telegram API wrapper)

### Existing Mitigations
- Retry with exponential backoff on failures
- Circuit breaker after 5 consecutive failures
- Failed update marked for retry
- Health check shows Telegram connectivity

### Impact
- **MEDIUM** - Bot cannot take actions
- Messages not processed

### Likelihood
- **LOW** - Telegram is generally reliable

### Missing Controls
- Fallback to manual admin actions
- Dead letter queue for failed Telegram actions
- Admin notification on API issues

---

## THREAT-13: Worker Queue Poison Message

### Description
A malformed or malicious job message causes worker failure or crash.

### Attack Vectors

1. **Malformed job data** - JSON parsing failure
2. **Oversized payload** - Memory exhaustion
3. **Circular references** - Infinite loop in processing
4. **Reentrancy attack** - Job triggers itself

### Affected Components
- `apps/worker/src/workers/setup.ts` (Worker handlers)
- `apps/worker/src/processors/` (Job processors)

### Existing Mitigations
- JSON schema validation on job data
- Job timeout (30s default)
- Failed jobs moved to dead letter queue
- Max attempts (3) with exponential backoff

### Impact
- **MEDIUM** - Worker crash, job backlog
- Potential memory issues

### Likelihood
- **LOW** - Jobs come from trusted sources (API)

### Missing Controls
- Job data size limits
- Resource limits per job type
- Job validation before processing

---

## THREAT-14: Rate Limit Bypass

### Description
Attacker circumvents rate limiting to perform DoS or spam.

### Attack Vectors

1. **IP rotation** - Use multiple IPs to bypass per-IP limits
2. **Token variation** - Rotate user tokens
3. **Queue priority abuse** - Flood high-priority queues
4. **Timing attacks** - Exploit race conditions in rate limit checks

### Affected Components
- `apps/api/src/middleware/security.ts` (Rate limit middleware)
- `apps/api/src/services/rate-limit-service.ts` (Rate limit service)

### Existing Mitigations
- Multiple rate limit dimensions (per-user, per-chat, per-IP)
- Redis-based distributed rate limiting
- Configurable windows and max values

### Impact
- **MEDIUM** - Service disruption, spam possible

### Likelihood
- **MEDIUM** - Common attack vector

### Missing Controls
- Adaptive rate limiting under load
- Anomaly detection on rate limit patterns
- CAPTCHA challenge for rate-limited users

---

## THREAT-15: Insider Admin Abuse

### Description
A TOGI system administrator (not group admin) abuses their infrastructure access.

### Attack Vectors

1. **Database access** - Read/modify any group data
2. **Configuration change** - Weaken security settings
3. **Secret access** - Obtain bot token, JWT secret
4. **Log manipulation** - Cover tracks after abuse

### Affected Components
- Infrastructure (not application code)
- Database direct access
- Environment configuration

### Existing Mitigations
- Principle of least privilege for ops team
- Audit logs for admin actions
- Separation of duties (dev vs. ops)
- Secrets management (not in repo)

### Impact
- **CRITICAL** - Full system compromise
- Data breach, service disruption

### Likelihood
- **LOW** - Requires trusted insider

### Missing Controls
- Immutable audit logs (write-once storage)
- 2-person rule for secret access
- Background verification for ops team
- Security awareness training

---

## Threat Summary

| ID | Threat | Severity | Likelihood | Mitigation Status |
|----|--------|----------|------------|-------------------|
| THREAT-1 | Malicious Telegram User | HIGH | MEDIUM | PARTIAL |
| THREAT-2 | Malicious Group Admin | HIGH | LOW | PARTIAL |
| THREAT-3 | Compromised Bot Token | CRITICAL | LOW | ADEQUATE |
| THREAT-4 | Replay Attack | MEDIUM | MEDIUM | ADEQUATE |
| THREAT-5 | Webhook Spoofing | HIGH | LOW | ADEQUATE |
| THREAT-6 | Dashboard Account Takeover | HIGH | MEDIUM | PARTIAL |
| THREAT-7 | RBAC Bypass | HIGH | LOW | ADEQUATE |
| THREAT-8 | Mass False-Positive Punishment | MEDIUM | MEDIUM | PARTIAL |
| THREAT-9 | LLM Prompt Injection | HIGH | MEDIUM | PARTIAL |
| THREAT-10 | Cross-Group Privacy Leakage | HIGH | LOW | PARTIAL |
| THREAT-11 | Redis/DB Outage | MEDIUM | LOW | PARTIAL |
| THREAT-12 | Telegram API Outage | MEDIUM | LOW | PARTIAL |
| THREAT-13 | Worker Queue Poison Message | MEDIUM | LOW | ADEQUATE |
| THREAT-14 | Rate Limit Bypass | MEDIUM | MEDIUM | PARTIAL |
| THREAT-15 | Insider Admin Abuse | CRITICAL | LOW | PARTIAL |

---

## Security Controls Matrix

| Control | THREAT-1 | THREAT-3 | THREAT-4 | THREAT-5 | THREAT-6 | THREAT-9 |
|---------|----------|----------|----------|----------|----------|----------|
| Webhook signature verification | | ✓ | | ✓ | | |
| Replay protection (Redis) | | | ✓ | | | |
| Rate limiting | ✓ | | | | ✓ | |
| JWT + HttpOnly cookies | | | | | ✓ | |
| RBAC | | | | | ✓ | ✓ |
| LLM circuit breaker | | | | | | ✓ |
| Agent safety levels | | | | | | ✓ |
| Audit logging | | | | | | |

---

## Next Steps

1. Review threat model with security team
2. Validate existing mitigations
3. Implement missing controls
4. Schedule penetration testing
5. Create incident response plan