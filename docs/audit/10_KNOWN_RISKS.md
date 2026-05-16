# Known Risks

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

This document lists known risks, limitations, and unresolved issues. These are categorized by severity and impact on release readiness.

---

## Critical Risks (Block Release)

### 1. No Load Testing Validation

**Risk:** Performance targets (50ms webhook, 5ms fast path) are NOT validated

**Impact:** Unknown behavior under production load

**Mitigation:** Pre-release load testing required

**Status:** PENDING - Load testing not performed

---

### 2. No External Security Audit

**Risk:** Undiscovered vulnerabilities in codebase

**Impact:** Unknown security issues

**Mitigation:** External security audit before public beta

**Status:** PENDING - Audit scheduled

---

### 3. Privacy Retention Jobs Not Implemented

**Risk:** Data retention policy not enforced (30-day fingerprints, 1-year violations)

**Impact:** Data may be stored indefinitely

**Mitigation:** Implement cron jobs for data cleanup

**Status:** DOCUMENTED AS BLOCKER

---

## High Risks (Review Before Release)

### 4. LLM Prompt Injection Not Tested

**Risk:** No validation of prompt injection resistance

**Impact:** Agent may be manipulated via crafted messages

**Mitigation:** Input sanitization + output validation in place, but not tested

**Status:** PARTIAL - Mitigations exist, not tested

### 5. Cross-Group Privacy Leakage Not Tested

**Risk:** No verification of group data isolation

**Impact:** Intelligence sharing may leak between groups

**Mitigation:** RBAC isolation exists, not verified

**Status:** PARTIAL - Isolation exists, not tested

### 6. No MFA for Dashboard

**Risk:** Account takeover possible with stolen credentials

**Impact:** High-impact account compromise

**Mitigation:** None - single factor auth only

**Status:** KNOWN - MFA not in scope for v1.0

### 7. Media Analysis Partial Implementation

**Risk:** Image/video analysis not fully implemented

**Impact:** Malicious media may bypass detection

**Mitigation:** Media type logged, analysis queued for future

**Status:** KNOWN - Feature incomplete

---

## Medium Risks (Monitor)

### 8. Single Redis Instance

**Risk:** Redis failure causes degraded mode

**Impact:** Rate limiting and caching disabled in fail_open mode

**Mitigation:** `REDIS_DEGRADED_MODE=fail_closed` option available

**Status:** ACCEPTED - Redis Cluster not in scope v1.0

### 9. Single PostgreSQL Instance

**Risk:** Database failure causes service outage

**Impact:** All operations fail

**Mitigation:** pgBouncer for connection pooling, read replicas not implemented

**Status:** ACCEPTED - HA not in scope v1.0

### 10. No Telegram IP Whitelist

**Risk:** Webhook could theoretically receive spoofed requests

**Impact:** If secret compromised, attacker could send fake updates

**Mitigation:** Secret required, but no IP verification

**Status:** ACCEPTED - Telegram IPs could change

### 11. Agent Action Rate Limit is Per-Group

**Risk:** Malicious admin could bypass by affecting multiple groups

**Impact:** Rate limit per group, not per admin

**Mitigation:** Trust score tracking exists, not enforced at group level

**Status:** ACCEPTED - Multi-group abuse not primary threat

---

## Low Risks (Document)

### 12. Session Revocation Not Immediate

**Risk:** Logout doesn't immediately invalidate session

**Impact:** Small window where logged-out user could act

**Mitigation:** Session expiry at 7 days max

**Status:** ACCEPTABLE

### 13. No Audit Log Immutable Storage

**Risk:** Admin could modify audit logs to cover tracks

**Impact:** Forensic investigation may be compromised

**Mitigation:** None - requires write-once storage

**Status:** ACCEPTED - Basic logging only

### 14. JWT Secret Rotation Manual

**Risk:** Secret rotation requires service restart

**Impact:** Rotation may be delayed or forgotten

**Mitigation:** Annual rotation recommended, not automated

**Status:** ACCEPTED - Manual process

### 15. No Rate Limit Anomaly Detection

**Risk:** Rate limit bypass patterns not detected

**Impact:** Sophisticated attackers may bypass limits

**Mitigation:** Basic rate limiting exists, anomaly detection not implemented

**Status:** ACCEPTED - Basic protection only

---

## Risk Summary

| ID | Risk | Severity | Status | Action |
|----|------|----------|--------|--------|
| KR-01 | No load testing | CRITICAL | PENDING | Must perform before release |
| KR-02 | No external audit | CRITICAL | PENDING | Must schedule audit |
| KR-03 | Privacy retention jobs | CRITICAL | BLOCKER | Must implement or document |
| KR-04 | LLM prompt injection | HIGH | PARTIAL | Test before release |
| KR-05 | Cross-group privacy | HIGH | PARTIAL | Test before release |
| KR-06 | No MFA | HIGH | ACCEPTED | Not in v1.0 scope |
| KR-07 | Media analysis | HIGH | ACCEPTED | Not fully implemented |
| KR-08 | Single Redis | MEDIUM | ACCEPTED | HA not in v1.0 |
| KR-09 | Single PostgreSQL | MEDIUM | ACCEPTED | HA not in v1.0 |
| KR-10 | No IP whitelist | MEDIUM | ACCEPTED | Telegram IPs dynamic |
| KR-11 | Rate limit per-group | LOW | ACCEPTED | Acceptable |
| KR-12 | Session revocation delay | LOW | ACCEPTABLE | Small window |
| KR-13 | Audit log mutable | LOW | ACCEPTED | Future enhancement |
| KR-14 | JWT rotation manual | LOW | ACCEPTED | Annual process |
| KR-15 | No anomaly detection | LOW | ACCEPTED | Basic protection |

---

## Required Before Release

1. **Load testing** - Measure actual performance
2. **Privacy retention cron jobs** - Implement or explicitly document as blocker
3. **LLM prompt injection test** - Verify sanitization works
4. **Cross-group isolation test** - Verify RBAC isolation

---

## Required Before Public Beta

1. **External security audit** - Full penetration test
2. **MFA consideration** - Plan for future implementation
3. **Media analysis roadmap** - Plan for full implementation