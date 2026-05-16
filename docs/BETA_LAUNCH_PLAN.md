# Beta Launch Plan

**Version:** 1.0.0-rc.1
**Date:** 2026-05-16
**Status:** DRAFT

---

## Overview

TOGI v1.0.0-beta launch strategy for controlled public beta with real groups.

---

## Launch Phases

### Phase 0: Shadow Mode (Week 1-2)

**Objective:** Validate system works without affecting real moderation

**Scope:**
- 1-3 trusted internal test groups
- Bot observes but does NOT take actions
- All decisions logged for review

**Criteria to Proceed:**
- [ ] Webhook processing stable (< 1% errors)
- [ ] Detection engine produces reasonable results
- [ ] No false positives in shadow mode
- [ ] System uptime > 99%

**Configuration:**
```yaml
agent:
  mode: SHADOW  # No actions, recommendations only
  logDecisions: true
detection:
  actionThreshold: BLOCKING_NEVER  # Never auto-act
```

---

### Phase 1: Canary Mode (Week 3-4)

**Objective:** Test with limited real groups, limited actions

**Scope:**
- 5-10 invited groups (trusted early adopters)
- Low-impact actions only (warn, captcha)
- No bans without human approval
- Strict monitoring

**Groups Selection:**
- Active Telegram groups with 100-1000 members
- Engaged admin team willing to provide feedback
- Varied language/geography

**Safety Limits:**
```yaml
actions:
  maxPerHour: 10
  maxPerGroup: 5
  requireApproval:
    - ban
    - lockdown
    - policy_change
riskControls:
  maxFalsePositiveRate: 0.05  # 5% max
  reviewQueueEnabled: true
  autoRollbackOnError: true
```

**Criteria to Proceed:**
- [ ] False positive rate < 5%
- [ ] No critical bugs in action execution
- [ ] Admin feedback positive (> 70% satisfaction)
- [ ] System uptime > 99.5%

---

### Phase 2: Opt-In Strict Mode (Week 5-8)

**Objective:** Expand to groups that explicitly opt-in to strict mode

**Scope:**
- Groups explicitly select "STRICT" policy mode
- Full autonomous action enabled
- Performance evaluation in production

**Requirements:**
```yaml
group:
  explicitlyOptIn: true
  policyMode: STRICT
  agentMode: AUTONOMOUS
monitoring:
  realTimeDashboard: true
  weeklyReports: true
  incidentChannel: # Slack/Discord for issues
```

**Success Metrics:**
- Detection accuracy > 90%
- Action appropriateness > 85%
- Admin workload reduction > 50%
- No critical security incidents

---

### Phase 3: General Availability (Week 9+)

**Objective:** Public release with all features

**Prerequisites:**
1. External security audit complete
2. All critical bugs fixed
3. Privacy retention jobs implemented
4. Load testing validated
5. 90%+ admin satisfaction in beta

---

## Feedback Channels

### Primary Channels

| Channel | Purpose | Response SLA |
|---------|---------|--------------|
| Dedicated Telegram group | Real-time support | 4 hours |
| GitHub Issues | Bug reports | 24 hours |
| Email (support@togi.ai) | General inquiries | 48 hours |

### Feedback Collection

1. **Weekly survey** - Admin satisfaction, feature requests
2. **Monthly metrics** - Group retention, action accuracy
3. **Incident reports** - Critical issues, false positives

### Feedback Categories

| Category | Priority | Action |
|----------|----------|--------|
| Critical bug | P0 | Immediate fix, potential rollback |
| Security issue | P0 | Immediate fix, notify affected groups |
| False positive | P1 | Fix detection, review affected actions |
| Feature request | P2 | Prioritize for v1.1 |
| Usability issue | P3 | Prioritize for v1.2 |

---

## Incident Response

### Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| SEV1 | Service down or data breach | 15 minutes | API unresponsive, data leaked |
| SEV2 | Major feature broken | 1 hour | Webhook processing fails, bot non-functional |
| SEV3 | Minor feature broken | 4 hours | Report generation fails, UI issues |
| SEV4 | Cosmetic/enhancement | 1 week | Typo, minor usability |

### Incident Response Flow

```
1. Detection (automated monitoring + user report)
         ↓
2. Triage (classify severity, assign owner)
         ↓
3. Containment (stop bleeding, isolate issue)
         ↓
4. Investigation (root cause analysis)
         ↓
5. Fix (implement and test solution)
         ↓
6. Recovery (deploy fix, verify resolution)
         ↓
7. Post-mortem (document, prevent recurrence)
```

### Rollback Plan

**Trigger:** SEV1 or SEV2 with no immediate fix available

**Steps:**
1. Disable autonomous agent (`AGENT_GLOBAL_ENABLED=false`)
2. Revert to shadow mode for all groups
3. Notify affected group admins
4. Investigate and fix
5. Incremental re-enable after fix verified

**Communication Template:**
```
Subject: [TOGI Incident] Action Required - {date}

Dear TOGI Admin,

We detected an issue with TOGI's autonomous actions at {time}.
To protect your group, we have temporarily disabled automatic moderation.

Your group is now in SHADOW mode - TOGI will continue to observe and recommend,
but will not take actions automatically.

Our team is investigating. Expected resolution: {timeframe}

We will notify you when normal operations resume.

Sorry for the inconvenience.
- TOGI Team
```

---

## Beta Limits

### Resource Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Groups | 100 | Limited onboarding capacity |
| Users | 10,000 | Processing capacity |
| Actions/day | 1,000 | Safety limit |
| Storage | 50GB | Cost control |

### Feature Limits

| Feature | Beta Limit | GA Limit |
|---------|------------|----------|
| Groups | 100 | Unlimited |
| Agent modes | SHADOW, CANARY, STRICT | +AUTONOMOUS |
| LLM providers | OpenAI only | +Anthropic, Local |
| Media analysis | Text links only | +Image, Video |
| Intelligence sharing | Disabled | Enabled |

---

## Beta Success Metrics

### Quantitative Metrics

| Metric | Target | Minimum |
|--------|--------|---------|
| Group retention | > 80% at 30 days | > 60% |
| Action accuracy | > 90% appropriate | > 80% |
| False positive rate | < 5% | < 10% |
| System uptime | > 99.5% | > 99% |
| Response time p95 | < 100ms | < 200ms |

### Qualitative Metrics

| Metric | Target |
|--------|--------|
| Admin satisfaction | > 80% positive |
| Would recommend | > 70% |
| Feature requests | < 10 critical |

---

## Go/No-Go Criteria by Phase

### Phase 0 → Phase 1 (Shadow → Canary)

- [ ] Zero critical incidents in shadow mode
- [ ] Detection accuracy validated
- [ ] Admin acceptance confirmed

### Phase 1 → Phase 2 (Canary → Opt-In Strict)

- [ ] False positive rate < 5%
- [ ] No SEV1/SEV2 incidents
- [ ] Admin feedback > 70% positive
- [ ] External security audit scheduled

### Phase 2 → Phase 3 (Opt-In → GA)

- [ ] All GA prerequisites met (see GA checklist)
- [ ] External audit complete with < 3 HIGH findings
- [ ] Load testing validated
- [ ] Privacy retention jobs implemented

---

## Communication Plan

### Pre-Launch

- [ ] Beta program announcement (targeted)
- [ ] Documentation publication
- [ ] Support channel setup
- [ ] Admin onboarding guide

### During Beta

| Communication | Frequency | Audience |
|---------------|-----------|----------|
| Status updates | Weekly | All beta participants |
| Incident notifications | Immediate | Affected only |
| Feature releases | Bi-weekly | All beta participants |
| Monthly report | Monthly | All beta participants |

### Beta Completion

- [ ] Final report to participants
- [ ] GA launch announcement
- [ ] Migration guide to GA
- [ ] Thank you to beta testers

---

## Legal/Compliance

### Beta Agreement

Participants must agree to:
1. Data processing terms (GDPR)
2. Beta program terms
3. Feedback sharing agreement
4. Liability limitation

### Data Handling

- Analytics collection (with consent)
- Error reporting
- Usage statistics

### Exit Strategy

- Participants can leave beta anytime
- Data export available on request
- Data deletion upon request (30 days)

---

## Audit Checklist

- [ ] Shadow mode tested (Phase 0)
- [ ] Canary groups selected and onboarded (Phase 1)
- [ ] Feedback channels operational
- [ ] Incident response plan tested
- [ ] Rollback procedure verified
- [ ] Communication templates ready
- [ ] Beta agreement legal review complete
- [ ] Monitoring dashboards active