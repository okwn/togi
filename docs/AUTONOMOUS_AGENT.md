# Autonomous Security Agent

## Overview

The TOGI autonomous security agent observes group security posture, analyzes threats, plans protective actions, executes safe actions within policy limits, and reflects on outcomes.

## Core Loop

```
Observe → Analyze → Plan → Execute/Recommend → Reflect
```

### Observe
Collects current state:
- Recent violations (last 24 hours)
- User risk profiles
- Threat indicators
- Bot permissions status
- Current policy settings

### Analyze
Processes observations to detect:
- Violation trends (increasing/decreasing/stable)
- Risk hotspots
- Policy effectiveness
- Security score changes

### Plan
Generates actions categorized by risk:
- **Low-risk**: Log, add to review queue, send notification
- **Medium-risk**: Policy change, temporary mute
- **High-risk**: Domain block, lockdown, ban (requires approval)

### Execute/Recommend
Based on safety level:
- Auto-execute low-risk if permitted
- Create recommendations for others
- High-impact always goes to approval queue

### Reflect
Evaluates outcomes:
- Did violations decrease?
- Did false positives increase?
- Should policy be adjusted?

## Safety Levels

| Mode | Observe | Recommend | Auto Low-Risk | Auto High-Risk |
|------|---------|-----------|---------------|----------------|
| OBSERVE_ONLY | ✓ | — | — | — |
| RECOMMEND_ONLY | ✓ | ✓ | — | — |
| AUTO_LOW_RISK | ✓ | ✓ | ✓ | — |
| AUTO_HIGH_RISK_WITH_POLICY | ✓ | ✓ | ✓ | Requires approval |

**High-impact (ban, lockdown, domain block) always requires approval.**

## Triggers

- **SCHEDULED**: Every 15 minutes (configurable)
- **RAID**: Mass-join detection triggers immediate analysis
- **SPIKE**: Violation count exceeds threshold
- **ADMIN_REQUEST**: Via `/togi_analyze` command
- **POLICY_REVIEW**: Weekly comprehensive review

## Bot Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/togi_analyze` | Admin | Trigger immediate analysis |
| `/togi_recommend` | Admin | Request recommendations summary |
| `/togi_agent_status` | Admin | Show current agent mode and last run |

## Dashboard

Route: `/dashboard/groups/[groupId]/agent`

- Agent status (enabled/disabled)
- Recent agent runs table
- Pending recommendations with approve/reject
- Configuration (mode, rate limits)

## Database Tables

- `agent_runs`: Agent execution history
- `recommendations`: Pending/approved/rejected recommendations
- `autonomous_agent_policies`: Per-group agent configuration

## Safety Boundaries

1. No bypass of RBAC
2. No Telegram admin permission bypass
3. High-impact always requires approval
4. Explainable and auditable actions
5. Rate limited (max actions per hour)