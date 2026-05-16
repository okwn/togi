# Agent Safety

**Version:** 1.0.0
**Last Updated:** 2026-05-16

---

## Overview

TOGI includes an autonomous security agent that can take actions based on AI recommendations. This document details the safety controls for the agent.

---

## Agent Safety Architecture

### Safety Levels

| Level | Description | Human Approval | Actions Allowed |
|-------|-------------|----------------|-----------------|
| RESTRICTED | No actions, recommendations only | All | None (read-only) |
| LOW | Warn, captcha challenges | High-impact | warn_user, create_captcha |
| MEDIUM | Warn, mute, captcha | Critical | warn_user, mute_user, create_captcha |
| HIGH | All except permanent ban | Critical only | All except permanent_ban |
| FULL | Full autonomy, no restrictions | None | All actions |

**Default Level:** SUPERVISOR sets per-group, defaults to MEDIUM

### Safety Level Enforcement

```typescript
const SAFETY_PERMISSIONS = {
  RESTRICTED: ['view_recommendations'],
  LOW: ['view_recommendations', 'warn_user', 'create_captcha'],
  MEDIUM: ['view_recommendations', 'warn_user', 'mute_user', 'create_captcha'],
  HIGH: ['view_recommendations', 'warn_user', 'mute_user', 'kick_user', 'ban_temp', 'create_captcha'],
  FULL: ['*'],  // All permissions
};
```

---

## Human-in-the-Loop

### Approval Workflow

1. Agent identifies action needed
2. Agent creates recommendation in DB
3. Admin reviews recommendation
4. Admin approves or rejects
5. If approved, action executes

```typescript
// Recommendation created
const recommendation = await db.insert(recommendations).values({
  groupId,
  type: 'BAN_USER',
  priority: 'HIGH',
  status: 'PENDING',
  action: { userId, reason, duration },
  reason: 'Multiple violations in short period',
  triggeredBy: 'agent_autonomous',
});

// Admin approves
await db.update(recommendations)
  .set({ status: 'APPROVED', adminResponse: { approvedBy: adminId } })
  .where(eq(recommendations.id, recId));
```

### High-Impact Action Blocking

**High-impact actions always require approval:**
- Permanent ban (not time-limited)
- Group lockdown
- Policy mode change
- Agent level change
- Mass actions (>10 users)

---

## Agent Observability

### Reflection Loop

The agent includes a reflection mechanism:

```typescript
interface AgentReflection {
  observations: string[];
  reasoning: string;
  confidence: number; // 0-1
  concerns: string[];
  shouldProceed: boolean;
}
```

### Action Logging

Every agent action is logged:

```typescript
await db.insert(auditLogs).values({
  groupId,
  actorTelegramUserId: botUserId,
  action: 'AGENT_ACTION',
  targetType: 'USER',
  targetId: userId.toString(),
  metadata: {
    agentRunId,
    actionType,
    safetyLevelUsed,
    reflection: agent.reflection,
  },
});
```

---

## Agent Run Limits

### Concurrency Limits

- Maximum 1 agent run per group simultaneously
- Agent run timeout: 5 minutes
- Max actions per hour: 20 (configurable)

```typescript
const AGENT_RUN_LOCK_TTL = 600; // 10 minutes
const MAX_ACTIONS_PER_HOUR = 20;
```

### Rate Limiting

Agent actions are rate-limited:
```typescript
const actionCount = await redis.incr(`agent_actions:${groupId}:${hour}`);
if (actionCount > MAX_ACTIONS_PER_HOUR) {
  return { error: 'Agent action rate limit exceeded' };
}
```

---

## Agent Safety Configuration

### Per-Group Policy

```typescript
await db.insert(autonomousAgentPolicies).values({
  groupId,
  enabled: 'true',  // or 'false'
  mode: 'RECOMMEND_ONLY',  // or 'AUTONOMOUS'
  allowAutoPolicyTuning: 'false',
  allowAutoDomainBlocking: 'false',
  allowAutoLockdown: 'false',
  allowAutoReports: 'true',
  maxActionsPerHour: 20,
  requireHumanApprovalForHighImpact: 'true',
});
```

### Global Safety Defaults

```typescript
const DEFAULT_AGENT_POLICY = {
  mode: 'RECOMMEND_ONLY',
  maxActionsPerHour: 20,
  requireHumanApprovalForHighImpact: true,
  safetyLevelDefault: 'MEDIUM',
};
```

---

## Circuit Breaker

### LLM Circuit Breaker

If LLM calls fail repeatedly, the agent circuit breaker trips:

```typescript
const AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const AI_CIRCUIT_BREAKER_RESET_SECONDS = 60;

let failureCount = 0;
async function callLLM(prompt: string) {
  if (failureCount >= AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    throw new Error('Circuit breaker open - LLM unavailable');
  }

  try {
    const result = await llm.complete(prompt);
    failureCount = 0;
    return result;
  } catch (err) {
    failureCount++;
    if (failureCount >= AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      // Trip circuit breaker
      setTimeout(() => { failureCount = 0; }, AI_CIRCUIT_BREAKER_RESET_SECONDS * 1000);
    }
    throw err;
  }
}
```

---

## Safety Checks

### Pre-Action Validation

Before executing any agent action:

```typescript
async function validateAgentAction(action: AgentAction): Promise<ValidationResult> {
  // Check safety level permits action
  if (!safetyPermitsAction(agent.safetyLevel, action.type)) {
    return { valid: false, reason: 'Safety level insufficient' };
  }

  // Check human approval exists for high-impact
  if (isHighImpact(action) && !action.adminApproval) {
    return { valid: false, reason: 'Human approval required' };
  }

  // Check rate limits
  if (await agentActionRateLimited(action.groupId)) {
    return { valid: false, reason: 'Rate limit exceeded' };
  }

  // Check no concurrent agent run
  if (await agentRunActive(action.groupId)) {
    return { valid: false, reason: 'Agent run in progress' };
  }

  return { valid: true };
}
```

---

## Emergency Stop

### Admin Control

Admins can disable agent at any time:

```typescript
await db.update(autonomousAgentPolicies)
  .set({ enabled: 'false' })
  .where(eq(autonomousAgentPolicies.groupId, groupId));
```

### Global Kill Switch

If critical issue detected, operator can disable all agent runs:

```bash
# Via environment variable
AGENT_GLOBAL_ENABLED=false
```

---

## Audit Checklist

- [ ] Safety levels documented and enforced
- [ ] Human approval required for high-impact actions
- [ ] Agent actions logged in audit log
- [ ] Concurrency limits prevent runaway agent
- [ ] Circuit breaker prevents LLM failures
- [ ] Rate limits prevent agent abuse
- [ ] Admin can disable agent per-group
- [ ] Global kill switch available
- [ ] Agent run timeout enforced
- [ ] Action validation before execution