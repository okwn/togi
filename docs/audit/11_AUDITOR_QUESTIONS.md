# Auditor Questions

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

This document contains questions for the external security auditor to investigate during the audit engagement.

---

## Authentication & Authorization

### Q1: JWT Session Management

**Question:** How does TOGI handle concurrent sessions? Can an attacker hijack a session by predicting the session ID?

**Files to Review:**
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/auth.ts`

**What to Test:**
1. Session ID generation randomness
2. Concurrent session limits
3. Session fixation after login

---

### Q2: RBAC Enforcement

**Question:** Is RBAC consistently enforced across all endpoints? Are there any endpoints that bypass role checks?

**Files to Review:**
- `apps/api/src/middleware/auth.ts`
- All route handlers

**What to Test:**
1. Direct object access with insufficient role
2. Privilege escalation via parameter manipulation
3. IDOR (Insecure Direct Object Reference)

---

### Q3: CSRF Protection

**Question:** Is CSRF protection implemented correctly on all state-changing endpoints?

**Files to Review:**
- `apps/api/src/middleware/auth.ts`
- Dashboard route handlers

**What to Test:**
1. CSRF bypass via custom header
2. CSRF token reuse
3. CSRF token extraction from non-httpOnly cookie

---

## Webhook Security

### Q4: Webhook Replay Protection

**Question:** Can an attacker replay old webhook updates to cause duplicate actions or bypass detection?

**Files to Review:**
- `apps/api/src/services/idempotency.ts`
- `apps/api/src/routes/webhook.ts`

**What to Test:**
1. Update ID collision probability
2. Race condition in claim update
3. Lock TTL appropriateness

---

### Q5: Rate Limit Bypass

**Question:** Can rate limits be bypassed using distributed attacks or timing attacks?

**Files to Review:**
- `apps/api/src/services/rate-limit-service.ts`
- `apps/api/src/middleware/security.ts`

**What to Test:**
1. Rate limit race conditions
2. IP rotation effectiveness
3. Token variation detection

---

## Data Security

### Q6: SQL Injection

**Question:** Are all database queries properly parameterized to prevent SQL injection?

**Files to Review:**
- All files using `db.execute()` or raw SQL
- `packages/db/src/schema.ts`

**What to Test:**
1. Input sanitization in raw queries
2. ORM query construction safety

---

### Q7: Cross-Group Data Isolation

**Question:** Can a group admin access data from other groups they don't manage?

**Files to Review:**
- `apps/api/src/routes/groups.ts`
- `apps/api/src/services/` (all services)

**What to Test:**
1. Group ID enumeration
2. RBAC bypass via direct API calls
3. Intelligence sharing data leaks

---

### Q8: Personal Data Access

**Question:** Can users request and receive all their stored data per GDPR requirements?

**Files to Review:**
- `apps/api/src/routes/groups.ts`
- User-related queries

**What to Test:**
1. Data export completeness
2. Data deletion effectiveness

---

## Agent Safety

### Q9: LLM Prompt Injection

**Question:** Can an attacker inject instructions into the LLM prompts to manipulate agent behavior?

**Files to Review:**
- `packages/security-agent/src/agent/core.ts`
- `packages/security-agent/src/llm/`
- `packages/detection-engine/src/classifiers/`

**What to Test:**
1. Prompt injection via message content
2. System prompt override attempts
3. Multi-turn conversation attacks

---

### Q10: Agent Safety Level Bypass

**Question:** Can the agent perform actions beyond its configured safety level?

**Files to Review:**
- `packages/security-agent/src/agent/core.ts`
- `packages/policy-engine/src/engine.ts`

**What to Test:**
1. Safety level enforcement
2. High-impact action approval bypass
3. Rate limit on agent actions

---

### Q11: Agent Run Concurrency

**Question:** Can multiple agent runs execute simultaneously for the same group, causing race conditions?

**Files to Review:**
- `apps/worker/src/utils/distributed-lock.ts`
- `packages/security-agent/src/agent/core.ts`

**What to Test:**
1. Distributed lock effectiveness
2. Timeout on agent run locks
3. Lock cleanup on crash

---

## Infrastructure

### Q12: Redis Data Separation

**Question:** Can Redis keys from one group interfere with another group's data?

**Files to Review:**
- `packages/db/src/redis.ts`
- Key usage in services

**What to Test:**
1. Key collision potential
2. Redis command injection
3. Data isolation in Redis

---

### Q13: Secrets Management

**Question:** Are all secrets (JWT, bot token, DB password) properly secured and not exposed in logs or errors?

**Files to Review:**
- `apps/api/src/server.ts`
- `packages/config/src/index.ts`
- All logging statements

**What to Test:**
1. Log sanitization
2. Error message sanitization
3. Environment variable security

---

## Denial of Service

### Q14: Resource Exhaustion

**Question:** Can an attacker cause resource exhaustion (memory, CPU, disk) via crafted requests?

**Files to Review:**
- `apps/api/src/routes/webhook.ts` (body limit)
- Worker job handlers
- Large payload handling

**What to Test:**
1. Webhook body size limits
2. Job payload size limits
3. Database query complexity limits

---

### Q15: Queue Poisoning

**Question:** Can a malformed job message crash the worker or cause infinite processing?

**Files to Review:**
- `apps/worker/src/processors/`
- Job validation logic

**What to Test:**
1. JSON parsing failure handling
2. Circular reference detection
3. Job timeout enforcement

---

## Privacy

### Q16: Data Retention Enforcement

**Question:** Is the data retention policy actually enforced? Are old records deleted as specified?

**Files to Review:**
- Cron job implementations
- Cleanup queries

**What to Test:**
1. Message fingerprint cleanup (30 days)
2. Violation archiving (1 year)
3. Session cleanup (7 days)

---

### Q17: Intelligence Sharing Privacy

**Question:** Does intelligence sharing leak group-specific information to other groups?

**Files to Review:**
- `packages/security-agent/src/` (intelligence components)
- `threat_indicators` table usage

**What to Test:**
1. Data minimization in shared signals
2. Group consent verification
3. Anonymization effectiveness

---

## Compliance

### Q18: Telegram Platform Compliance

**Question:** Does TOGI comply with Telegram's Terms of Service and Bot API guidelines?

**Areas to Review:**
- Data collection practices
- User notification requirements
- API rate compliance

---

### Q19: GDPR Compliance

**Question:** Does TOGI meet GDPR requirements for EU deployments?

**Areas to Review:**
- Lawful basis documentation
- Data subject rights implementation
- Data transfer mechanisms

---

## Information for Auditor

### Test Accounts

Provide test accounts with different RBAC roles:
- OWNER account
- SUPERVISOR account
- MODERATOR account
- VIEWER account

### Test Environment

- API: `http://localhost:4310`
- Dashboard: `http://localhost:4320`
- Metrics: `http://localhost:4390`

### Key Files

| Component | Key Files |
|-----------|-----------|
| API | `apps/api/src/` |
| Worker | `apps/worker/src/` |
| Security Agent | `packages/security-agent/src/` |
| Detection Engine | `packages/detection-engine/src/` |
| Policy Engine | `packages/policy-engine/src/` |
| Database | `packages/db/src/schema.ts` |

### Critical Security Features

1. Webhook signature verification (THREAT-5)
2. Replay protection (THREAT-4)
3. RBAC (THREAT-7)
4. Agent safety levels (THREAT-8)
5. LLM circuit breaker (THREAT-9)

---

## Contact for Follow-up

Development Team Lead: [Contact information]
Documentation: `docs/audit/` directory
Code: `apps/` and `packages/` directories