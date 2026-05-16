# Autonomous Agent Gaps

## LLM Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| LLM Provider Abstraction | **NOT VERIFIED** | No AI provider in current codebase |
| Prompt Caching | **NOT IMPLEMENTED** | No Anthropic SDK integration |
| AI Classification | **MISSING** | `async-analysis.ts` exists but no actual AI call |
| Fallback to Heuristics | **MISSING** | If AI fails, no local fallback |

### Details

**Current State:**
- `apps/worker/src/processors/async-analysis.ts` — stub processor, queues work but no AI
- `apps/worker/src/ai/classifier.ts` — empty implementation
- No `AI_PROVIDER` configuration in env
- No Claude/Anthropic SDK usage

**What Exists:**
```typescript
// apps/worker/src/ai/classifier.ts — empty
export async function classifyMessage(...): Promise<AIClassification> {
  throw new Error('AI classification not yet implemented');
}
```

---

## Autonomous Agent Loop Status

**Status:** NOT IMPLEMENTED

### What Should Exist

An autonomous loop that:
1. Detects threat patterns
2. Evaluates severity and context
3. Determines appropriate action
4. Executes action with idempotency
5. Logs decision for audit
6. Learns from false positives (future)

### What Exists

- Detection: ✅ Fast path engine with 8 detectors
- Decision: ✅ Decision engine with policy mode thresholds
- Action: ✅ Telegram action executor with admin protection
- Logging: ✅ Audit logs in PostgreSQL
- Learning: ❌ No feedback loop implemented

### Gap: No Self-Improvement

The system does not track:
- False positive rate per detector
- Missed threats (manual overrides by admins)
- User satisfaction (reports/escalations)
- Cross-group threat patterns

---

## User Behavior Memory Status

**Status:** NOT IMPLEMENTED

### What Should Exist

Per-user tracking:
- Threat history per user
- Trust score accumulation
- Behavioral anomaly detection
- Graduated trust building (new user → trusted)

### What Exists

- `punishments` table in schema
- `violations` table with user history
- No API endpoint to query user history for detection context

### Gap: New Member Detection Relies Only on Timestamp

```typescript
// packages/detection-engine/src/detectors/new-member-detector.ts
isNewUser: memberSince && (Date.now() - memberSince) < probationMs
```

**Issue:** Just checks timestamp, not actual behavior. Sophisticated attackers can pass probation period quietly.

---

## Cross-Group Threat Intelligence Status

**Status:** PARTIAL

### What Exists

```typescript
// apps/worker/src/processors/raid-correlation.ts
processRaidCorrelation() // Cross-group raid detection
// apps/worker/src/domain/intelligence.ts
enqueueSecurityEvent() // Event sharing infrastructure
```

### Gap: No Shared Blocklist

- No cross-group blocklist of known bad actor Telegram IDs
- No domain blocklist sharing between groups
- No coordinated attack detection (beyond raid correlation)

---

## Raid Detection Limitations

**Status:** PARTIAL

### What Works
- Join flood detection within a single group
- Bulk-ban capability
- Anti-raid policies

### What Is Missing
- Slow mode integration (ROADMAP.md v0.8.0 item not done)
- Coordinated raid across multiple groups (same attackers hitting different groups)
- Auto-lockdown with configurable thresholds

---

## Summary

| Autonomous Feature | Status |
|-------------------|--------|
| Threat Detection | PARTIAL (fast path works, AI missing) |
| Action Execution | DONE (idempotent, admin-protected) |
| Decision Making | PARTIAL (rule-based only, no ML) |
| Audit Logging | DONE |
| User Memory | MISSING |
| Cross-Group Intel | PARTIAL (raid correlation only) |
| Self-Improvement | MISSING |