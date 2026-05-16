# Audit Scope

**Target:** TOGI (Telegram Open Guard Intelligence) v1.0.0
**Type:** External Security Audit & Release Candidate Review
**Auditor:** External Security Firm (TBD)
**Date:** 2026-Q2

---

## System Under Review

TOGI is a Telegram group security bot with:
- Bot token management via Telegram Bot API webhooks
- Group policy enforcement (moderation, punishment, verification)
- AI-powered detection engine with autonomous agent capabilities
- Dashboard for group administrators
- Async worker processing for content analysis

---

## In Scope

### Core Components

1. **API Service** (`apps/api/`)
   - Webhook endpoint (`/webhooks/telegram`)
   - Authentication and session management
   - Rate limiting middleware
   - RBAC enforcement
   - Health and metrics endpoints

2. **Worker Service** (`apps/worker/`)
   - BullMQ queue processing
   - Async content analysis
   - Report generation
   - Scheduled jobs

3. **Dashboard** (`apps/web/`)
   - React admin interface
   - Group policy management
   - Report viewing

4. **Database** (`packages/db/`)
   - PostgreSQL schema (Drizzle ORM)
   - Migration system

5. **Security Agent** (`packages/security-agent/`)
   - Captcha verification
   - Trust score management
   - Agent core with safety levels

6. **Detection Engine** (`packages/detection-engine/`)
   - Fast path detection
   - Full path analysis
   - Media analysis

7. **Policy Engine** (`packages/policy-engine/`)
   - Policy evaluation
   - Action execution
   - Agent planning

### Security Features

- Webhook signature verification (HMAC-SHA256)
- Replay protection via Redis idempotency
- Action idempotency locks
- Rate limiting (per-user, per-chat, per-IP)
- RBAC with 4 roles: OWNER, SUPERVISOR, MODERATOR, VIEWER
- JWT authentication for dashboard
- CSRF protection for web sessions
- LLM circuit breaker
- Safety level enforcement for autonomous agent
- Privacy retention enforcement

### Data Flows

1. Telegram → Webhook → API → Detection → Action
2. User → Dashboard → API → Database
3. Worker → Queue → Processing → Database/Redis
4. Agent → LLM → Planning → Execution

---

## Out of Scope

1. **Telegram API itself** - Not auditable; assume Telegram infrastructure is trusted
2. **Third-party LLM providers** - Assume OpenAI/Anthropic APIs are trusted
3. **Infrastructure** - Kubernetes, Docker networking, OS-level hardening
4. **Social engineering** - Physical access, phishing, credential theft from auditors
5. **Denial of service** - DoS resilience testing (separate engagement)
6. **Source code of external dependencies** - ioredis, BullMQ, Drizzle, Fastify

---

## Testing Boundaries

### What We Will Test

- Authentication bypass attempts
- RBAC privilege escalation
- Rate limit circumvention
- Webhook replay attacks
- Webhook spoofing (missing signature)
- SQL injection via user input
- XSS in dashboard
- CSRF on state-changing endpoints
- Session hijacking
- Agent safety policy bypass attempts
- LLM prompt injection attempts
- Cross-group data leakage
- Mass false-positive scenarios
- Queue poison message handling
- Redis/DB outage graceful degradation

### What We Will Not Test

- Infrastructure DoS resilience
- Telegram API reliability
- LLM provider uptime
- Long-term data retention compliance (GDPR/CCPA specific)
- Source code of compiled dependencies

---

## Audit Phases

### Phase 1: Architecture Review (1 week)

- Review system design documents
- Interview development team
- Review threat model
- Validate attack surface mapping

### Phase 2: Security Testing (2 weeks)

- Automated vulnerability scanning
- Manual penetration testing
- Authentication/authorization testing
- Data privacy testing
- LLM safety testing

### Phase 3: Reporting (1 week)

- Document findings
- Risk severity classification
- Remediation recommendations
- Final report delivery

---

## Severity Classification

| Severity | Definition | Response SLA |
|----------|------------|--------------|
| CRITICAL | Remote code execution, full system compromise | 24 hours |
| HIGH | Privilege escalation, data breach, safety bypass | 7 days |
| MEDIUM | Security control bypass, information disclosure | 30 days |
| LOW | Minor security issue, hardening recommendation | Next release |
| INFO | Informational, no immediate risk | No SLA |

---

## Evidence Handling

- All test evidence must be encrypted at rest
- Findings reported via secure channel only
- No evidence shared via email
- Evidence retained for 90 days post-audit
- Final report retained for 1 year

---

## Communication

- Primary contact: Development team lead
- Secure communication: Encrypted messaging (Signal)
- Findings channel: Private GitHub issue (invite-only)
- Status updates: Weekly during audit

---

## Success Criteria

Audit passes if:

1. No CRITICAL severity findings
2. No more than 3 HIGH severity findings
3. All MEDIUM findings have documented mitigations
4. Action item tracking begins within 7 days of report
5. 80% of LOW/INFO items addressed in next release