# Phase 08: Autonomous Security Agent — Design

## Overview

The TOGI autonomous security agent observes group security posture, analyzes threats, plans protective actions, executes safe actions within policy limits, and reflects on outcomes. It operates as a separate worker process with event-driven triggers.

**Core Principle:** Deterministic safety rules are primary. The agent can recommend or execute actions only within policy limits. High-impact actions (ban, lockdown, domain block) require explicit admin approval. Every action must be explainable and auditable.

---

## Architecture

### Process Model

```
┌─────────────────────────────────────────────────────────┐
│                  SECURITY AGENT WORKER                  │
│  (Separate Node.js process, independent from API/Worker)│
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent Loop                            │
│  Observe → Analyze → Plan → Execute/Recommend → Reflect │
└─────────────────────────────────────────────────────────┘
         │
    Triggers:
    • SCHEDULED (cron)
    • RAID signal
    • SPIKE in violations
    • ADMIN_REQUEST (/togi_analyze)
    • POLICY_REVIEW (weekly)
```

### Package Structure

```
packages/security-agent/
├── src/
│   ├── index.ts                    # Main entry, exports runAgent()
│   ├── agent/
│   │   ├── core.ts                 # Agent loop (observe, analyze, plan, execute, reflect)
│   │   ├── types.ts                # AgentRun, AgentState, AgentConfig, TriggerType
│   │   ├── scheduler.ts            # Cron scheduler for periodic runs
│   │   └── event-handler.ts       # Event-driven trigger handling
│   ├── tools/
│   │   ├── index.ts               # Tool registry
│   │   ├── get-group-policy.ts
│   │   ├── get-recent-violations.ts
│   │   ├── get-user-risk-profiles.ts
│   │   ├── get-threat-indicators.ts
│   │   ├── get-bot-permissions.ts
│   │   ├── propose-policy-change.ts
│   │   ├── apply-policy-change.ts
│   │   ├── propose-domain-block.ts
│   │   ├── apply-domain-block.ts
│   │   ├── trigger-lockdown.ts
│   │   ├── send-admin-report.ts
│   │   └── create-review-items.ts
│   ├── safety/
│   │   ├── policy-checker.ts       # Validates actions against agent policy
│   │   ├── safety-levels.ts       # OBSERVE_ONLY, RECOMMEND_ONLY, AUTO_LOW_RISK, AUTO_HIGH_RISK_WITH_POLICY
│   │   └── audit-logger.ts        # Logs all agent actions
│   ├── planning/
│   │   ├── recommendation-engine.ts  # Generates recommendations from observations
│   │   └── risk-analyzer.ts          # Analyzes group risk posture
│   └── db/
│       ├── agent-runs.ts           # agent_runs table queries
│       └── recommendations.ts      # recommendations table queries
├── package.json
└── tsconfig.json
```

---

## Data Model

### agent_runs Table (New)

```typescript
interface AgentRun {
  id: string;                    // UUID
  groupId: string;               // UUID, references groups.id
  triggerType: TriggerType;      // SCHEDULED | RAID | SPIKE | ADMIN_REQUEST | POLICY_REVIEW
  status: AgentRunStatus;        // RUNNING | COMPLETED | FAILED | CANCELLED
  observations: json;             // Raw observations collected
  plan: json;                     // Generated plan with actions
  actions: json;                  // Actions taken (executed or proposed)
  reflection: json;               // Post-execution analysis
  safetyLevelUsed: SafetyLevel;  // Safety level during this run
  adminApprovals: json;          // Array of { action, approvedBy, approvedAt }
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

type TriggerType = 'SCHEDULED' | 'RAID' | 'SPIKE' | 'ADMIN_REQUEST' | 'POLICY_REVIEW';
type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type SafetyLevel = 'OBSERVE_ONLY' | 'RECOMMEND_ONLY' | 'AUTO_LOW_RISK' | 'AUTO_HIGH_RISK_WITH_POLICY';
```

### recommendations Table (New)

```typescript
interface Recommendation {
  id: string;
  groupId: string;
  agentRunId: string;
  type: RecommendationType;     // POLICY_CHANGE | DOMAIN_BLOCK | LOCKDOWN | ALLOWLIST
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: RecommendationStatus;  // PENDING | APPROVED | REJECTED | APPLIED | EXPIRED
  action: json;                  // Proposed action details
  reason: string;                // Human-readable explanation
  triggeredBy: string;           // What observation triggered this
  adminResponse: json | null;    // { action: 'APPROVED' | 'REJECTED', by, at, note }
  appliedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}
```

### autonomous_agent_policy Table (New)

```typescript
interface AutonomousAgentPolicy {
  groupId: string;               // UUID, references groups.id
  enabled: boolean;
  mode: SafetyLevel;             // Default: RECOMMEND_ONLY
  allowAutoPolicyTuning: boolean; // Agent can auto-adjust policy within narrow bounds
  allowAutoDomainBlocking: boolean;
  allowAutoLockdown: boolean;
  allowAutoReports: boolean;
  maxActionsPerHour: number;     // Default: 20
  requireHumanApprovalForHighImpact: boolean; // Default: true (always)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Agent Loop (Core)

```typescript
async function runAgentCycle(groupId: string, trigger: TriggerType): Promise<AgentRun> {
  // 1. OBSERVE — Gather current state
  const observations = await observe(groupId, trigger);

  // 2. ANALYZE — Process observations against policy
  const analysis = await analyze(observations);

  // 3. PLAN — Generate actions/recommendations
  const plan = await plan(analysis);

  // 4. EXECUTE / RECOMMEND — Based on safety level
  const { actions, approvalsNeeded } = await executeOrRecommend(plan);

  // 5. REFLECT — Evaluate outcomes
  const reflection = await reflect(actions, approvalsNeeded);

  // 6. REPORT — Log and notify
  await report(actions, reflection);

  return buildAgentRun(observations, plan, actions, reflection);
}
```

### Observe Step

Collects:
- Recent violations (last hour / 24h)
- User risk profiles (top risky users)
- Threat indicators (domains, hashes seen across groups)
- Bot permissions status
- Current group policy settings
- Join rate (for raid detection)

### Analyze Step

Produces:
- Violation trend (increasing/decreasing/stable)
- Risk hotspots (users, domains, content types)
- Policy effectiveness (false positive rate, detection rate)
- Security score delta

### Plan Step

Generates actions categorized by impact:

**Low-risk (auto-executable in AUTO_LOW_RISK mode):**
- Log a warning observation
- Add to review queue
- Send admin notification

**Medium-risk (recommendation required):**
- Propose policy mode change (RELAXED → STRICT)
- Propose temporary mute for suspicious user
- Propose adding domain to watchlist

**High-risk (always requires approval):**
- Propose permanent ban for severe violation
- Propose domain block
- Propose group lockdown

### Execute/Recommend Step

```typescript
async function executeOrRecommend(plan: Plan): Promise<{ actions: Action[], approvalsNeeded: Action[] }> {
  const approvalsNeeded: Action[] = [];
  const actions: Action[] = [];

  for (const action of plan.actions) {
    const allowed = await safetyChecker.canExecute(action, groupPolicy);
    if (allowed.executable) {
      await executeAction(action);
      actions.push({ ...action, status: 'EXECUTED' });
    } else if (allowed.requiresApproval) {
      approvalsNeeded.push(action);
    } else {
      // Not allowed under current policy, skip
    }
  }

  return { actions, approvalsNeeded };
}
```

### Reflect Step

After execution:
- Did violations decrease in the following hour?
- Did false positives increase?
- Did admins override agent actions?
- Should policy be adjusted back?

```typescript
interface Reflection {
  violationsAfter: number;
  violationsBefore: number;
  falsePositivesDetected: boolean;
  adminOverrides: number;
  recommendationAccuracy: number; // % of recommendations that were accepted
  shouldRollback: boolean;
  rollbackReason: string | null;
}
```

---

## Safety Levels

| Level | Description | Auto-execute | Recommend | Requires Approval |
|-------|-------------|--------------|-----------|-------------------|
| OBSERVE_ONLY | Agent observes only, never acts | — | — | — |
| RECOMMEND_ONLY | Agent recommends, never auto-executes | — | All | High-impact |
| AUTO_LOW_RISK | Agent auto-executes low-risk actions | Low-risk | Others | High-impact |
| AUTO_HIGH_RISK_WITH_POLICY | Agent auto-executes within policy bounds | Policy-allowed | Others | Beyond policy |

**High-impact always requires approval regardless of level.**

High-impact = Ban, Lockdown, Domain Block

---

## Triggers

### SCHEDULED
- Agent runs on configurable interval (default: every 15 minutes)
- Processes all enabled groups in sequence
- Lightweight observation, no heavy analysis

### RAID
- Triggered when raid detector signals mass-join
- Agent immediately analyzes join pattern
- Can propose/enact temporary lockdown if policy allows

### SPIKE
- Triggered when violation count exceeds threshold in short window
- Analyzes what changed (new domain, new user cohort, etc.)
- Proposes corrective actions

### ADMIN_REQUEST
- Triggered via `/togi_analyze` bot command
- Admin can request immediate analysis of group
- Results sent as message to admin

### POLICY_REVIEW
- Weekly trigger for comprehensive group review
- Generates security score update
- Produces weekly summary report

---

## Tool Registry

| Tool | Purpose | Risk Level |
|------|---------|------------|
| getGroupPolicy | Fetch current policy for group | READ |
| getRecentViolations | Get violations from last N hours | READ |
| getUserRiskProfiles | Get top risky users in group | READ |
| getThreatIndicators | Get known threats (domains, hashes) | READ |
| getBotPermissions | Check if bot has required permissions | READ |
| proposePolicyChange | Create recommendation to change policy | MEDIUM |
| applyPolicyChange | Auto-apply policy change if allowed | MEDIUM |
| proposeDomainBlock | Create recommendation to block domain | HIGH |
| applyDomainBlock | Auto-block domain if allowed by policy | HIGH |
| triggerLockdown | Enable slow mode / restrict group | HIGH |
| sendAdminReport | Send summary to group admins | LOW |
| createReviewItems | Add items to review queue | LOW |

---

## Bot Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/togi_analyze` | Admin | Trigger immediate analysis |
| `/togi_recommend` | Admin | Request recommendations summary |
| `/togi_agent_status` | Admin | Show current agent mode and last run |

---

## Agent Policy Configuration

Stored in `autonomous_agent_policy` table, configurable via dashboard:

```typescript
interface AutonomousAgentPolicy {
  enabled: boolean;
  mode: SafetyLevel;  // Default: RECOMMEND_ONLY
  allowAutoPolicyTuning: boolean;  // Can auto-adjust certain settings
  allowAutoDomainBlocking: boolean;
  allowAutoLockdown: boolean;
  allowAutoReports: boolean;
  maxActionsPerHour: number;  // Rate limit on auto-actions
  requireHumanApprovalForHighImpact: boolean;  // ALWAYS TRUE for ban/lockdown/domain block
}
```

---

## Dashboard UI

### Route: `/dashboard/groups/[groupId]/agent`

Tab on existing group dashboard with sections:

1. **Agent Status**
   - Current mode: RECOMMEND_ONLY / AUTO_LOW_RISK / etc.
   - Enable/disable toggle
   - Last run timestamp

2. **Recent Agent Runs** (table)
   - Time, Trigger, Status, Actions taken
   - Expandable to see full run details

3. **Pending Recommendations**
   - List of recommendations awaiting approval
   - Approve / Reject buttons
   - Reason and suggested action displayed

4. **Agent Configuration**
   - Mode selector
   - Allowlist toggles for auto-actions
   - Max actions per hour slider

---

## Database Additions

### New Tables

1. `agent_runs` — Agent execution history
2. `recommendations` — Pending/approved/rejected recommendations
3. `autonomous_agent_policy` — Per-group agent configuration

---

## Documentation

1. `docs/AUTONOMOUS_AGENT.md` — Full agent documentation
2. Update `docs/SECURITY_MODEL.md` — Add agent section
3. Update `docs/PRODUCT_SPEC.md` — Add agent capabilities

---

## Testing Scope

1. **Observe step** — Correctly gathers observations from DB/Redis
2. **Plan generation** — Produces valid plan from observations
3. **Safety policy** — Prevents high-impact action without approval
4. **Auto low-risk** — Allows low-risk actions in AUTO_LOW_RISK mode
5. **Audit log** — All agent actions logged with full context
6. **Reflection** — Updates recommendation based on outcome
7. **Admin approval flow** — Recommendation → approval → execution

---

## Agent Modes Summary

| Mode | Observe | Recommend | Auto Low-Risk | Auto High-Risk |
|------|---------|-----------|---------------|----------------|
| OBSERVE_ONLY | ✓ | — | — | — |
| RECOMMEND_ONLY | ✓ | ✓ | — | — |
| AUTO_LOW_RISK | ✓ | ✓ | ✓ | — |
| AUTO_HIGH_RISK_WITH_POLICY | ✓ | ✓ | ✓ | Requires approval |

---

## Safety Boundaries

1. **No bypass of RBAC** — Agent actions are subject to same permission checks as manual admin actions
2. **No Telegram admin permission bypass** — Agent can only do what bot permissions allow
3. **High-impact always requires approval** — Ban, lockdown, domain block need explicit admin consent
4. **Explainable actions** — Every action has human-readable reason
5. **Auditable** — All actions logged with timestamp, trigger, and outcome
6. **Rate limited** — Max actions per hour prevents runaway automation

---

## Deliverables Checklist

- [ ] `packages/security-agent/` package created
- [ ] Agent core loop implemented (observe → analyze → plan → execute → reflect)
- [ ] All tools implemented (getGroupPolicy, getRecentViolations, etc.)
- [ ] Safety policy checker prevents unauthorized actions
- [ ] `agent_runs` table created with full audit trail
- [ ] `recommendations` table for admin approval workflow
- [ ] `autonomous_agent_policy` table for per-group configuration
- [ ] Bot commands: `/togi_analyze`, `/togi_recommend`, `/togi_agent_status`
- [ ] Dashboard agent page (`/dashboard/groups/[groupId]/agent`)
- [ ] Tests: observe, plan, safety policy, audit, reflection, admin approval
- [ ] `docs/AUTONOMOUS_AGENT.md` documentation
- [ ] Updates to `SECURITY_MODEL.md` and `PRODUCT_SPEC.md`