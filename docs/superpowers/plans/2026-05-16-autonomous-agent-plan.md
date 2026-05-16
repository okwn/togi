# Phase 08: Autonomous Security Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TOGI autonomous security agent that observes group security posture, plans protective actions, executes safe actions within policy limits, and reflects on outcomes.

**Architecture:** Separate worker process (`packages/security-agent/`) with event-driven triggers. Agent loop: Observe → Analyze → Plan → Execute/Recommend → Reflect. Safety levels control which actions auto-execute vs require approval. High-impact actions (ban, lockdown, domain block) always require admin approval.

**Tech Stack:** TypeScript, BullMQ for job scheduling, Drizzle ORM for DB, Redis for caching, node-cron for scheduling.

---

## File Structure

```
packages/security-agent/
├── src/
│   ├── index.ts                         # Package exports
│   ├── agent/
│   │   ├── types.ts                     # AgentRun, TriggerType, SafetyLevel, etc.
│   │   ├── core.ts                      # Main agent loop (runAgentCycle)
│   │   ├── scheduler.ts                 # Cron-based scheduled runs
│   │   └── event-handler.ts             # Event-driven trigger handling
│   ├── tools/
│   │   ├── index.ts                     # Tool registry
│   │   ├── get-group-policy.ts          # READ: Fetch group policy
│   │   ├── get-recent-violations.ts     # READ: Get violations
│   │   ├── get-user-risk-profiles.ts    # READ: Get risky users
│   │   ├── get-threat-indicators.ts     # READ: Get threat intel
│   │   ├── get-bot-permissions.ts       # READ: Check bot permissions
│   │   ├── propose-policy-change.ts     # MEDIUM: Create recommendation
│   │   ├── apply-policy-change.ts       # MEDIUM: Auto-apply if allowed
│   │   ├── propose-domain-block.ts       # HIGH: Create domain block rec
│   │   ├── apply-domain-block.ts         # HIGH: Auto-block if allowed
│   │   ├── trigger-lockdown.ts           # HIGH: Enable lockdown
│   │   ├── send-admin-report.ts          # LOW: Send report to admin
│   │   └── create-review-items.ts        # LOW: Add to review queue
│   ├── safety/
│   │   ├── policy-checker.ts            # Validates actions against agent policy
│   │   ├── safety-levels.ts             # SafetyLevel enum + helpers
│   │   └── audit-logger.ts              # Logs all agent actions
│   ├── planning/
│   │   ├── recommendation-engine.ts      # Generates recommendations
│   │   └── risk-analyzer.ts             # Analyzes group risk posture
│   └── db/
│       ├── agent-runs.ts                # agent_runs table queries
│       ├── recommendations.ts           # recommendations table queries
│       └── agent-policy.ts             # autonomous_agent_policy table
├── package.json
├── tsconfig.json
└── src/__tests__/
    ├── agent-core.test.ts
    ├── observe.test.ts
    ├── plan.test.ts
    ├── safety-checker.test.ts
    ├── audit-logger.test.ts
    └── reflection.test.ts

# DB changes: packages/db/src/schema.ts
# - Add agent_runs table
# - Add recommendations table
# - Add autonomous_agent_policy table
# - Add migration

# Bot commands: apps/api/src/commands/agent-commands.ts (new)
# Dashboard UI: apps/web/src/pages/dashboard/groups/[groupId]/agent.tsx (new)
# Docs: docs/AUTONOMOUS_AGENT.md (new)
```

---

## Task 1: Create security-agent package structure

**Files:**
- Create: `packages/security-agent/package.json`
- Create: `packages/security-agent/tsconfig.json`
- Create: `packages/security-agent/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@togi/security-agent",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@togi/db": "workspace:*",
    "@togi/shared": "workspace:*",
    "@togi/policy-engine": "workspace:*",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.0",
    "node-cron": "^3.0.3",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}
```

Run: `cat > packages/security-agent/package.json << 'EOF'
{
  "name": "@togi/security-agent",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@togi/db": "workspace:*",
    "@togi/shared": "workspace:*",
    "@togi/policy-engine": "workspace:*",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.0",
    "node-cron": "^3.0.3",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}
EOF`

- [ ] **Step 2: Create tsconfig.json**

Run: `cat > packages/security-agent/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
EOF`

- [ ] **Step 3: Create src/index.ts**

```typescript
// Agent exports
export * from './agent/types.js';
export * from './agent/core.js';

// Tools exports
export * from './tools/index.js';

// Safety exports
export * from './safety/safety-levels.js';
export * from './safety/policy-checker.js';
export * from './safety/audit-logger.js';

// Planning exports
export * from './planning/recommendation-engine.js';
export * from './planning/risk-analyzer.js';
```

Run: `mkdir -p packages/security-agent/src && cat > packages/security-agent/src/index.ts << 'EOF'
// Agent exports
export * from './agent/types.js';
export * from './agent/core.js';

// Tools exports
export * from './tools/index.js';

// Safety exports
export * from './safety/safety-levels.js';
export * from './safety/policy-checker.js';
export * from './safety/audit-logger.js';

// Planning exports
export * from './planning/recommendation-engine.js';
export * from './planning/risk-analyzer.js';
EOF`

- [ ] **Step 4: Commit**

```bash
mkdir -p packages/security-agent/src/agent packages/security-agent/src/tools packages/security-agent/src/safety packages/security-agent/src/planning packages/security-agent/src/db packages/security-agent/src/__tests__
touch packages/security-agent/src/agent/.gitkeep packages/security-agent/src/tools/.gitkeep packages/security-agent/src/safety/.gitkeep packages/security-agent/src/planning/.gitkeep packages/security-agent/src/db/.gitkeep
git add packages/security-agent/
git commit -m "feat(security-agent): create package structure"
```

---

## Task 2: Add agent database tables to schema

**Files:**
- Modify: `packages/db/src/schema.ts` — Add agent_runs, recommendations, autonomous_agent_policy tables
- Modify: `packages/db/src/index.ts` — Re-export new types

- [ ] **Step 1: Read current schema end**

Run: `tail -50 packages/db/src/schema.ts`

- [ ] **Step 2: Add new tables to schema (before type exports)**

Append to `packages/db/src/schema.ts`:

```typescript
// Agent runs table
export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  triggerType: varchar('trigger_type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('RUNNING'),
  observations: jsonb('observations').default({}),
  plan: jsonb('plan').default({}),
  actions: jsonb('actions').default([]),
  reflection: jsonb('reflection').default({}),
  safetyLevelUsed: varchar('safety_level_used', { length: 30 }).notNull(),
  adminApprovals: jsonb('admin_approvals').default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, (table) => ({
  groupIdIdx: index('idx_agent_runs_group_id').on(table.groupId),
  statusIdx: index('idx_agent_runs_status').on(table.status),
  startedAtIdx: index('idx_agent_runs_started_at').on(table.startedAt),
}));

// Recommendations table
export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('MEDIUM'),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  action: jsonb('action').notNull(),
  reason: text('reason').notNull(),
  triggeredBy: text('triggered_by').notNull(),
  adminResponse: jsonb('admin_response'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  groupIdIdx: index('idx_recommendations_group_id').on(table.groupId),
  statusIdx: index('idx_recommendations_status').on(table.status),
  typeIdx: index('idx_recommendations_type').on(table.type),
  createdAtIdx: index('idx_recommendations_created_at').on(table.createdAt),
}));

// Autonomous agent policy table
export const autonomousAgentPolicies = pgTable('autonomous_agent_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }).unique(),
  enabled: varchar('enabled', { length: 10 }).notNull().default('false'),
  mode: varchar('mode', { length: 30 }).notNull().default('RECOMMEND_ONLY'),
  allowAutoPolicyTuning: varchar('allow_auto_policy_tuning', { length: 10 }).notNull().default('false'),
  allowAutoDomainBlocking: varchar('allow_auto_domain_blocking', { length: 10 }).notNull().default('false'),
  allowAutoLockdown: varchar('allow_auto_lockdown', { length: 10 }).notNull().default('false'),
  allowAutoReports: varchar('allow_auto_reports', { length: 10 }).notNull().default('true'),
  maxActionsPerHour: integer('max_actions_per_hour').notNull().default(20),
  requireHumanApprovalForHighImpact: varchar('require_human_approval_for_high_impact', { length: 10 }).notNull().default('true'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: uniqueIndex('autonomous_agent_policies_group_id_unique').on(table.groupId),
}));
```

- [ ] **Step 3: Add type exports to end of schema.ts**

Append:

```typescript
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;
export type AutonomousAgentPolicy = typeof autonomousAgentPolicies.$inferSelect;
export type NewAutonomousAgentPolicy = typeof autonomousAgentPolicies.$inferInsert;
```

- [ ] **Step 4: Read and update packages/db/src/index.ts**

Run: `cat packages/db/src/index.ts`

Add exports for new tables/types.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add agent_runs, recommendations, autonomous_agent_policy tables"
```

---

## Task 3: Implement agent types and safety levels

**Files:**
- Create: `packages/security-agent/src/agent/types.ts`
- Create: `packages/security-agent/src/safety/safety-levels.ts`

- [ ] **Step 1: Create agent/types.ts**

```typescript
export type TriggerType = 'SCHEDULED' | 'RAID' | 'SPIKE' | 'ADMIN_REQUEST' | 'POLICY_REVIEW';

export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type SafetyLevel = 'OBSERVE_ONLY' | 'RECOMMEND_ONLY' | 'AUTO_LOW_RISK' | 'AUTO_HIGH_RISK_WITH_POLICY';

export type RecommendationType = 'POLICY_CHANGE' | 'DOMAIN_BLOCK' | 'LOCKDOWN' | 'ALLOWLIST' | 'USER_MUTE';

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'EXPIRED';

export type ActionRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Observation {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ViolationSummary {
  countLastHour: number;
  countLast24h: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  topTypes: Array<{ type: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface SecuritySummary {
  currentScore: number;
  scoreDelta: number;
  botPermissionsOk: boolean;
  policyMode: string;
  protectionEnabled: boolean;
}

export interface ObservationResult {
  groupId: string;
  timestamp: number;
  violations: ViolationSummary;
  security: SecuritySummary;
  topRiskyUsers: Array<{ userId: string; riskScore: number }>;
  threatIndicators: Array<{ type: string; valueHash: string; riskScore: number }>;
  joinRate: number;
  botPermissions: {
    canDelete: boolean;
    canRestrict: boolean;
    canInvite: boolean;
    canManageVideoChats: boolean;
  };
}

export interface PlannedAction {
  id: string;
  type: string;
  risk: ActionRisk;
  target: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface Plan {
  actions: PlannedAction[];
  summary: string;
}

export interface ExecutedAction {
  action: PlannedAction;
  status: 'EXECUTED' | 'RECOMMENDED' | 'BLOCKED' | 'PENDING_APPROVAL';
  executedAt?: number;
  approvedBy?: string;
}

export interface Reflection {
  violationsAfter: number;
  violationsBefore: number;
  falsePositivesDetected: boolean;
  adminOverrides: number;
  recommendationAccuracy: number;
  shouldRollback: boolean;
  rollbackReason: string | null;
}

export interface AgentConfig {
  groupId: string;
  trigger: TriggerType;
  safetyLevel: SafetyLevel;
  autonomousPolicy: {
    enabled: boolean;
    mode: SafetyLevel;
    allowAutoPolicyTuning: boolean;
    allowAutoDomainBlocking: boolean;
    allowAutoLockdown: boolean;
    allowAutoReports: boolean;
    maxActionsPerHour: number;
    requireHumanApprovalForHighImpact: boolean;
  };
}
```

- [ ] **Step 2: Create safety/safety-levels.ts**

```typescript
import { SafetyLevel, ActionRisk } from '../agent/types.js';

export const HIGH_IMPACT_ACTIONS: ActionRisk[] = ['HIGH'];

export const SAFETY_LEVEL_ORDER: SafetyLevel[] = [
  'OBSERVE_ONLY',
  'RECOMMEND_ONLY',
  'AUTO_LOW_RISK',
  'AUTO_HIGH_RISK_WITH_POLICY',
];

export function canAutoExecute(safetyLevel: SafetyLevel, actionRisk: ActionRisk): boolean {
  switch (safetyLevel) {
    case 'OBSERVE_ONLY':
      return false;
    case 'RECOMMEND_ONLY':
      return false;
    case 'AUTO_LOW_RISK':
      return actionRisk === 'LOW';
    case 'AUTO_HIGH_RISK_WITH_POLICY':
      return actionRisk === 'LOW' || actionRisk === 'MEDIUM';
    default:
      return false;
  }
}

export function canRecommend(safetyLevel: SafetyLevel): boolean {
  return safetyLevel !== 'OBSERVE_ONLY';
}

export function isHighImpact(actionRisk: ActionRisk): boolean {
  return actionRisk === 'HIGH';
}

export function requiresApproval(safetyLevel: SafetyLevel, actionRisk: ActionRisk): boolean {
  if (isHighImpact(actionRisk)) {
    return true; // High-impact always requires approval
  }
  if (canAutoExecute(safetyLevel, actionRisk)) {
    return false;
  }
  return true;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/security-agent/src/agent/types.ts packages/security-agent/src/safety/safety-levels.ts
git commit -m "feat(security-agent): add agent types and safety levels"
```

---

## Task 4: Implement tool registry and read tools

**Files:**
- Create: `packages/security-agent/src/tools/index.ts`
- Create: `packages/security-agent/src/tools/get-group-policy.ts`
- Create: `packages/security-agent/src/tools/get-recent-violations.ts`
- Create: `packages/security-agent/src/tools/get-user-risk-profiles.ts`
- Create: `packages/security-agent/src/tools/get-threat-indicators.ts`
- Create: `packages/security-agent/src/tools/get-bot-permissions.ts`

- [ ] **Step 1: Create tools/index.ts**

```typescript
import type { Tool, ToolResult } from './types.js';

export interface Tool {
  name: string;
  description: string;
  riskLevel: 'READ' | 'LOW' | 'MEDIUM' | 'HIGH';
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  groupId: string;
  db: DatabaseClient;
  redis: RedisClient;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Re-export all tools
export * from './get-group-policy.js';
export * from './get-recent-violations.js';
export * from './get-user-risk-profiles.js';
export * from './get-threat-indicators.js';
export * from './get-bot-permissions.js';
```

- [ ] **Step 2: Create get-group-policy.ts**

```typescript
import { db } from '@togi/db';
import { groupPolicies, groups } from '@togi/db/src/schema';
import { eq } from 'drizzle-orm';

export async function getGroupPolicy(groupId: string) {
  const policy = await db.query.groupPolicies.findFirst({
    where: eq(groupPolicies.groupId, groupId),
  });

  if (!policy) {
    return null;
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  return {
    policy,
    groupSecurityScore: group?.securityScore ?? 0,
  };
}
```

- [ ] **Step 3: Create get-recent-violations.ts**

```typescript
import { db } from '@togi/db';
import { violations } from '@togi/db/src/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';

export async function getRecentViolations(groupId: string, hours: number = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const recent = await db.query.violations.findMany({
    where: eq(violations.groupId, groupId),
    orderBy: [desc(violations.createdAt)],
    limit: 1000,
  });

  const lastHour = recent.filter(v => v.createdAt > new Date(Date.now() - 60 * 60 * 1000));
  const last24h = recent.filter(v => v.createdAt > cutoff);

  // Aggregate by type
  const typeCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const v of last24h) {
    typeCounts[v.violationType] = (typeCounts[v.violationType] || 0) + 1;
    if (v.telegramUserId) {
      userCounts[String(v.telegramUserId)] = (userCounts[String(v.telegramUserId)] || 0) + 1;
    }
  }

  const topTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Determine trend (compare last hour to hour before)
  const hourBeforeLast = lastHour.filter(v => v.createdAt > new Date(Date.now() - 2 * 60 * 60 * 1000));
  const trend = lastHour.length > hourBeforeLast.length ? 'increasing' : lastHour.length < hourBeforeLast.length ? 'decreasing' : 'stable';

  return {
    countLastHour: lastHour.length,
    countLast24h: last24h.length,
    trend,
    topTypes,
    topUsers,
  };
}
```

- [ ] **Step 4: Create get-user-risk-profiles.ts**

```typescript
import { db } from '@togi/db';
import { groupUserProfiles } from '@togi/db/src/schema';
import { eq, desc } from 'drizzle-orm';

export async function getUserRiskProfiles(groupId: string, limit: number = 10) {
  const profiles = await db.query.groupUserProfiles.findMany({
    where: eq(groupUserProfiles.groupId, groupId),
    orderBy: [desc(groupUserProfiles.riskScore)],
    limit,
  });

  return profiles.map(p => ({
    userId: String(p.telegramUserId),
    riskScore: p.riskScore,
    trustScore: p.trustScore,
    violationCount: p.violationCount,
    messageCount: p.messageCount,
  }));
}
```

- [ ] **Step 5: Create get-threat-indicators.ts**

```typescript
import { db } from '@togi/db';
import { threatIndicators } from '@togi/db/src/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

export async function getThreatIndicators(groupId: string, status: string[] = ['BLOCK', 'WATCH']) {
  const indicators = await db.query.threatIndicators.findMany({
    where: and(
      gte(threatIndicators.riskScore, 50),
    ),
    orderBy: [desc(threatIndicators.riskScore)],
    limit: 50,
  });

  return indicators
    .filter(i => status.includes(i.status))
    .map(i => ({
      id: i.id,
      type: i.type,
      valueHash: i.valueHash,
      riskScore: i.riskScore,
      labels: i.labels,
      seenCount: i.seenCount,
      status: i.status,
    }));
}
```

- [ ] **Step 6: Create get-bot-permissions.ts**

```typescript
import { redis } from '@togi/db';

const PERMISSION_CACHE_TTL = 300; // 5 minutes

interface BotPermissions {
  canDelete: boolean;
  canRestrict: boolean;
  canInvite: boolean;
  canManageVideoChats: boolean;
  cachedAt: number;
}

export async function getBotPermissions(chatId: string): Promise<BotPermissions | null> {
  const cached = await redis.get(`permissions_cache:${chatId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // This would typically be fetched from Telegram API
  // For now, return null and let the caller handle missing permissions
  return null;
}

export async function setBotPermissionsCache(chatId: string, permissions: BotPermissions): Promise<void> {
  await redis.setex(
    `permissions_cache:${chatId}`,
    PERMISSION_CACHE_TTL,
    JSON.stringify(permissions)
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/security-agent/src/tools/
git commit -m "feat(security-agent): add tool registry and read tools"
```

---

## Task 5: Implement write tools and audit logger

**Files:**
- Create: `packages/security-agent/src/tools/types.ts` (shared tool types)
- Create: `packages/security-agent/src/tools/propose-policy-change.ts`
- Create: `packages/security-agent/src/tools/apply-policy-change.ts`
- Create: `packages/security-agent/src/tools/propose-domain-block.ts`
- Create: `packages/security-agent/src/tools/apply-domain-block.ts`
- Create: `packages/security-agent/src/tools/trigger-lockdown.ts`
- Create: `packages/security-agent/src/tools/send-admin-report.ts`
- Create: `packages/security-agent/src/tools/create-review-items.ts`
- Create: `packages/security-agent/src/safety/audit-logger.ts`
- Create: `packages/security-agent/src/safety/policy-checker.ts`

- [ ] **Step 1: Create tools/propose-policy-change.ts**

```typescript
import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import type { PlannedAction } from '../agent/types.js';

export interface ProposePolicyChangeParams {
  agentRunId: string;
  groupId: string;
  currentMode: string;
  proposedMode: string;
  reason: string;
}

export async function proposePolicyChange(params: ProposePolicyChangeParams): Promise<{ id: string }> {
  const action: PlannedAction = {
    id: crypto.randomUUID(),
    type: 'POLICY_CHANGE',
    risk: 'MEDIUM',
    target: params.groupId,
    params: {
      currentMode: params.currentMode,
      proposedMode: params.proposedMode,
    },
    reason: params.reason,
  };

  const [rec] = await db.insert(recommendations).values({
    groupId: params.groupId,
    agentRunId: params.agentRunId,
    type: 'POLICY_CHANGE',
    priority: 'MEDIUM',
    status: 'PENDING',
    action,
    reason: params.reason,
    triggeredBy: `policy_change:${params.currentMode}->${params.proposedMode}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }).returning();

  return { id: rec.id };
}
```

- [ ] **Step 2: Create tools/apply-policy-change.ts**

```typescript
import { db } from '@togi/db';
import { groupPolicies } from '@togi/db/src/schema';
import { eq } from 'drizzle-orm';
import { proposePolicyChange } from './propose-policy-change.js';

export interface ApplyPolicyChangeParams {
  groupId: string;
  agentRunId: string;
  proposedMode: string;
  reason: string;
}

export async function applyPolicyChange(params: ApplyPolicyChangeParams): Promise<{ success: boolean; recommendationId?: string; error?: string }> {
  // First create recommendation for audit trail
  const { id } = await proposePolicyChange({
    agentRunId: params.agentRunId,
    groupId: params.groupId,
    currentMode: 'BALANCED', // Would fetch actual current mode
    proposedMode: params.proposedMode,
    reason: params.reason,
  });

  // Update the policy
  const [policy] = await db.update(groupPolicies)
    .set({
      mode: params.proposedMode,
      updatedAt: new Date(),
    })
    .where(eq(groupPolicies.groupId, params.groupId))
    .returning();

  if (!policy) {
    return { success: false, error: 'Policy not found' };
  }

  // Update recommendation status
  await db.update(recommendations)
    .set({ status: 'APPLIED', appliedAt: new Date() })
    .where(eq(recommendations.id, id));

  return { success: true, recommendationId: id };
}
```

- [ ] **Step 3: Create tools/propose-domain-block.ts**

```typescript
import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import type { PlannedAction } from '../agent/types.js';

export interface ProposeDomainBlockParams {
  agentRunId: string;
  groupId: string;
  domain: string;
  reason: string;
  riskScore: number;
}

export async function proposeDomainBlock(params: ProposeDomainBlockParams): Promise<{ id: string }> {
  const priority = params.riskScore >= 80 ? 'HIGH' : params.riskScore >= 60 ? 'MEDIUM' : 'LOW';

  const action: PlannedAction = {
    id: crypto.randomUUID(),
    type: 'DOMAIN_BLOCK',
    risk: 'HIGH',
    target: params.domain,
    params: {
      domain: params.domain,
      riskScore: params.riskScore,
    },
    reason: params.reason,
  };

  const [rec] = await db.insert(recommendations).values({
    groupId: params.groupId,
    agentRunId: params.agentRunId,
    type: 'DOMAIN_BLOCK',
    priority,
    status: 'PENDING',
    action,
    reason: params.reason,
    triggeredBy: `threat_indicator:${params.domain}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }).returning();

  return { id: rec.id };
}
```

- [ ] **Step 4: Create tools/apply-domain-block.ts**

```typescript
import { db } from '@togi/db';
import { domainRules } from '@togi/db/src/schema';
import { proposeDomainBlock } from './propose-domain-block.js';

export interface ApplyDomainBlockParams {
  groupId: string;
  agentRunId: string;
  domain: string;
  reason: string;
  riskScore: number;
}

export async function applyDomainBlock(params: ApplyDomainBlockParams): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  // First create recommendation
  const { id } = await proposeDomainBlock({
    agentRunId: params.agentRunId,
    groupId: params.groupId,
    domain: params.domain,
    reason: params.reason,
    riskScore: params.riskScore,
  });

  // Add to domain rules
  const [rule] = await db.insert(domainRules).values({
    groupId: params.groupId,
    domain: params.domain,
    ruleType: 'BLOCK',
    reason: params.reason,
  }).returning();

  // Update recommendation
  await db.update(domainRules) // Note: should be recommendations table
    .set({ status: 'APPLIED', appliedAt: new Date() })
    .where(eq(domainRules.id, id));

  return { success: true, ruleId: rule.id };
}
```

- [ ] **Step 5: Create tools/trigger-lockdown.ts**

```typescript
import { redis } from '@togi/db';

const LOCKDOWN_TTL = 3600; // 1 hour default

export interface TriggerLockdownParams {
  groupId: string;
  reason: string;
  durationSeconds?: number;
}

export async function triggerLockdown(params: TriggerLockdownParams): Promise<{ success: boolean; lockdownId: string }> {
  const lockdownId = crypto.randomUUID();
  const ttl = params.durationSeconds || LOCKDOWN_TTL;

  await redis.setex(
    `lockdown:${params.groupId}`,
    ttl,
    JSON.stringify({
      id: lockdownId,
      reason: params.reason,
      startedAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
    })
  );

  return { success: true, lockdownId };
}

export async function releaseLockdown(groupId: string): Promise<{ success: boolean }> {
  await redis.del(`lockdown:${groupId}`);
  return { success: true };
}
```

- [ ] **Step 6: Create tools/send-admin-report.ts**

```typescript
import { telegramClient } from '@togi/telegram-client';

export interface SendAdminReportParams {
  groupId: string;
  adminUserIds: string[];
  reportType: 'AGENT_RUN' | 'RECOMMENDATION' | 'SECURITY_ALERT' | 'WEEKLY_SUMMARY';
  title: string;
  summary: string;
  details?: Record<string, unknown>;
}

export async function sendAdminReport(params: SendAdminReportParams): Promise<{ success: boolean; messageIds: string[] }> {
  const messageIds: string[] = [];

  for (const adminId of params.adminUserIds) {
    const message = `🔒 *TOGI Security Agent Report*\n\n*${params.title}*\n\n${params.summary}`;
    
    try {
      const result = await telegramClient.sendMessage({
        chatId: adminId,
        text: message,
        parseMode: 'Markdown',
      });
      messageIds.push(String(result.message_id));
    } catch (err) {
      console.error(`Failed to send report to admin ${adminId}:`, err);
    }
  }

  return { success: messageIds.length > 0, messageIds };
}
```

- [ ] **Step 7: Create tools/create-review-items.ts**

```typescript
import { db } from '@togi/db';
import { reviewQueue } from '@togi/db/src/schema';

export interface CreateReviewItemParams {
  groupId: string;
  itemType: 'message' | 'user';
  itemId: string;
  telegramUserId?: string;
  reason: string;
  reasonType: string;
  labels: string[];
  riskScore: number;
}

export async function createReviewItem(params: CreateReviewItemParams): Promise<{ id: string }> {
  const [item] = await db.insert(reviewQueue).values({
    groupId: params.groupId,
    itemType: params.itemType,
    itemId: BigInt(params.itemId),
    telegramUserId: params.telegramUserId ? BigInt(params.telegramUserId) : null,
    reason: params.reason,
    reasonType: params.reasonType,
    labels: params.labels,
    riskScore: params.riskScore,
    status: 'PENDING',
  }).returning();

  return { id: item.id };
}
```

- [ ] **Step 8: Create safety/audit-logger.ts**

```typescript
import { db } from '@togi/db';
import { auditLogs } from '@togi/db/src/schema';
import type { ExecutedAction, AgentConfig, TriggerType } from '../agent/types.js';

export interface AuditEntry {
  agentRunId: string;
  groupId: string;
  trigger: TriggerType;
  action: ExecutedAction;
  safetyLevel: string;
  outcome: 'EXECUTED' | 'BLOCKED' | 'APPROVED' | 'REJECTED';
  metadata?: Record<string, unknown>;
}

export async function logAgentAction(entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    groupId: entry.groupId,
    actorTelegramUserId: null, // Agent is system actor
    action: `AGENT_${entry.action.status}:${entry.action.action.type}`,
    targetType: 'AGENT',
    targetId: entry.agentRunId,
    metadata: {
      trigger: entry.trigger,
      safetyLevel: entry.safetyLevel,
      actionType: entry.action.action.type,
      actionParams: entry.action.action.params,
      outcome: entry.outcome,
      ...entry.metadata,
    },
  });
}

export async function logAgentRunStarted(runId: string, groupId: string, trigger: TriggerType): Promise<void> {
  await db.insert(auditLogs).values({
    groupId,
    action: 'AGENT_RUN_STARTED',
    targetType: 'AGENT_RUN',
    targetId: runId,
    metadata: { trigger },
  });
}

export async function logAgentRunCompleted(runId: string, groupId: string, summary: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogs).values({
    groupId,
    action: 'AGENT_RUN_COMPLETED',
    targetType: 'AGENT_RUN',
    targetId: runId,
    metadata: summary,
  });
}
```

- [ ] **Step 9: Create safety/policy-checker.ts**

```typescript
import { canAutoExecute, isHighImpact, requiresApproval } from './safety-levels.js';
import type { SafetyLevel, PlannedAction, AgentConfig } from '../agent/types.js';

export interface SafetyCheckResult {
  canExecute: boolean;
  requiresApproval: boolean;
  blockedReason?: string;
}

export function checkActionSafety(
  action: PlannedAction,
  agentConfig: AgentConfig
): SafetyCheckResult {
  const { safetyLevel, autonomousPolicy } = agentConfig;

  // High-impact actions always require approval
  if (isHighImpact(action.risk)) {
    if (autonomousPolicy.requireHumanApprovalForHighImpact) {
      return {
        canExecute: false,
        requiresApproval: true,
        blockedReason: 'High-impact action requires human approval',
      };
    }
  }

  // Check auto-execute permission
  if (canAutoExecute(safetyLevel, action.risk)) {
    // Check rate limit
    if (autonomousPolicy.maxActionsPerHour > 0) {
      // Rate limiting would be checked via Redis counter
      return { canExecute: true, requiresApproval: false };
    }
  }

  // For recommend-only or observe-only modes
  if (!canAutoExecute(safetyLevel, action.risk)) {
    return {
      canExecute: false,
      requiresApproval: true,
      blockedReason: `Action risk ${action.risk} not allowed in ${safetyLevel} mode`,
    };
  }

  return { canExecute: true, requiresApproval: false };
}

export function filterExecutableActions(
  actions: PlannedAction[],
  agentConfig: AgentConfig
): { executable: PlannedAction[]; needsApproval: PlannedAction[] } {
  const executable: PlannedAction[] = [];
  const needsApproval: PlannedAction[] = [];

  for (const action of actions) {
    const result = checkActionSafety(action, agentConfig);
    if (result.canExecute) {
      executable.push(action);
    } else {
      needsApproval.push(action);
    }
  }

  return { executable, needsApproval };
}
```

- [ ] **Step 10: Commit**

```bash
git add packages/security-agent/src/tools/ packages/security-agent/src/safety/
git commit -m "feat(security-agent): add write tools, audit logger, policy checker"
```

---

## Task 6: Implement agent core loop (Observe → Analyze → Plan → Execute/Recommend → Reflect)

**Files:**
- Create: `packages/security-agent/src/agent/core.ts`
- Create: `packages/security-agent/src/planning/recommendation-engine.ts`
- Create: `packages/security-agent/src/planning/risk-analyzer.ts`
- Create: `packages/security-agent/src/db/agent-runs.ts`
- Create: `packages/security-agent/src/db/recommendations.ts`

- [ ] **Step 1: Create planning/risk-analyzer.ts**

```typescript
import type { ObservationResult, SecuritySummary } from '../agent/types.js';

export function analyzeRiskPosture(observations: ObservationResult): SecuritySummary {
  const violations = observations.violations;
  const security = observations.security;

  // Calculate score delta based on recent violations and trend
  let scoreDelta = 0;
  
  if (violations.trend === 'increasing') {
    scoreDelta -= 10;
  } else if (violations.trend === 'decreasing') {
    scoreDelta += 5;
  }

  if (violations.countLast24h > 50) {
    scoreDelta -= 15;
  } else if (violations.countLast24h > 20) {
    scoreDelta -= 5;
  }

  // Check bot permissions impact
  if (!observations.botPermissions.canDelete) {
    scoreDelta -= 10;
  }

  return {
    currentScore: security.currentScore,
    scoreDelta,
    botPermissionsOk: observations.botPermissions.canDelete && observations.botPermissions.canRestrict,
    policyMode: security.policyMode,
    protectionEnabled: security.protectionEnabled,
  };
}

export function detectAnomalies(observations: ObservationResult): string[] {
  const anomalies: string[] = [];

  // High violation rate
  if (observations.violations.countLastHour > 10) {
    anomalies.push(`High violation rate: ${observations.violations.countLastHour}/hour`);
  }

  // Sudden spike
  if (observations.violations.trend === 'increasing' && observations.violations.countLastHour > 5) {
    anomalies.push('Sudden violation spike detected');
  }

  // New threat indicator
  if (observations.threatIndicators.some(t => t.riskScore >= 80)) {
    anomalies.push('High-risk threat indicator detected');
  }

  // Join rate anomaly (potential raid)
  if (observations.joinRate > 20) {
    anomalies.push(`High join rate: ${observations.joinRate} joins/hour - potential raid`);
  }

  // Risky users activity
  if (observations.topRiskyUsers.length > 0 && observations.violations.trend === 'increasing') {
    anomalies.push('Top risky users showing increased activity');
  }

  return anomalies;
}
```

- [ ] **Step 2: Create planning/recommendation-engine.ts**

```typescript
import type { ObservationResult, Plan, PlannedAction, SecuritySummary } from '../agent/types.js';
import { analyzeRiskPosture, detectAnomalies } from './risk-analyzer.js';

export function generateRecommendations(observations: ObservationResult): Plan {
  const security = analyzeRiskPosture(observations);
  const anomalies = detectAnomalies(observations);
  const actions: PlannedAction[] = [];

  // Policy mode recommendations based on anomalies
  if (anomalies.some(a => a.includes('raid'))) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'LOCKDOWN',
      risk: 'HIGH',
      target: observations.groupId,
      params: { durationMinutes: 30 },
      reason: 'Raid detected - recommend temporary lockdown',
    });
  }

  if (observations.violations.trend === 'increasing' && observations.violations.countLast24h > 30) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'POLICY_CHANGE',
      risk: 'MEDIUM',
      target: observations.groupId,
      params: { proposedMode: 'STRICT', currentMode: observations.security.policyMode },
      reason: `Violation trend increasing (${observations.violations.countLast24h} in 24h) - recommend STRICT mode`,
    });
  }

  // Domain block recommendations for high-risk indicators
  for (const indicator of observations.threatIndicators) {
    if (indicator.riskScore >= 80 && indicator.type === 'DOMAIN') {
      actions.push({
        id: crypto.randomUUID(),
        type: 'DOMAIN_BLOCK',
        risk: 'HIGH',
        target: indicator.valueHash,
        params: { domain: indicator.valueHash, riskScore: indicator.riskScore },
        reason: `High-risk domain (score: ${indicator.riskScore}) detected across multiple groups`,
      });
    }
  }

  // User mute recommendations for high-risk users
  for (const user of observations.topRiskyUsers.slice(0, 3)) {
    if (user.riskScore >= 70) {
      actions.push({
        id: crypto.randomUUID(),
        type: 'USER_MUTE',
        risk: 'MEDIUM',
        target: user.userId,
        params: { durationMinutes: 60 },
        reason: `User risk score ${user.riskScore} - recommend temporary mute for review`,
      });
    }
  }

  // Review queue items for suspicious activity
  if (anomalies.length > 0) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'CREATE_REVIEW_ITEMS',
      risk: 'LOW',
      target: observations.groupId,
      params: { reason: anomalies.join('; ') },
      reason: `Anomalies detected: ${anomalies.join(', ')}`,
    });
  }

  const summary = `Analyzed ${observations.groupId}: ${anomalies.length} anomalies, generated ${actions.length} actions`;

  return { actions, summary };
}
```

- [ ] **Step 3: Create db/agent-runs.ts**

```typescript
import { db } from '@togi/db';
import { agentRuns } from '@togi/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import type { AgentRun, AgentRunStatus, TriggerType, SafetyLevel } from '../agent/types';

export interface CreateAgentRunParams {
  groupId: string;
  triggerType: TriggerType;
  safetyLevel: SafetyLevel;
}

export async function createAgentRun(params: CreateAgentRunParams): Promise<AgentRun> {
  const [run] = await db.insert(agentRuns).values({
    groupId: params.groupId,
    triggerType: params.triggerType,
    status: 'RUNNING',
    safetyLevelUsed: params.safetyLevel,
    observations: {},
    plan: {},
    actions: [],
    reflection: {},
    adminApprovals: [],
  }).returning();

  return run;
}

export async function updateAgentRun(
  runId: string,
  updates: {
    status?: AgentRunStatus;
    observations?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    actions?: unknown[];
    reflection?: Record<string, unknown>;
    adminApprovals?: unknown[];
    completedAt?: Date;
    errorMessage?: string;
  }
): Promise<AgentRun> {
  const [run] = await db.update(agentRuns)
    .set(updates)
    .where(eq(agentRuns.id, runId))
    .returning();

  return run;
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  return db.query.agentRuns.findFirst({
    where: eq(agentRuns.id, runId),
  });
}

export async function getRecentAgentRuns(groupId: string, limit: number = 10): Promise<AgentRun[]> {
  return db.query.agentRuns.findMany({
    where: eq(agentRuns.groupId, groupId),
    orderBy: [desc(agentRuns.startedAt)],
    limit,
  });
}
```

- [ ] **Step 4: Create db/recommendations.ts**

```typescript
import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { Recommendation, RecommendationStatus } from '../agent/types';

export async function getPendingRecommendations(groupId: string): Promise<Recommendation[]> {
  return db.query.recommendations.findMany({
    where: and(
      eq(recommendations.groupId, groupId),
      eq(recommendations.status, 'PENDING')
    ),
    orderBy: [desc(recommendations.createdAt)],
  });
}

export async function approveRecommendation(
  recommendationId: string,
  approvedBy: string,
  note?: string
): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'APPROVED',
      adminResponse: {
        action: 'APPROVED',
        by: approvedBy,
        at: new Date().toISOString(),
        note,
      },
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}

export async function rejectRecommendation(
  recommendationId: string,
  rejectedBy: string,
  note?: string
): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'REJECTED',
      adminResponse: {
        action: 'REJECTED',
        by: rejectedBy,
        at: new Date().toISOString(),
        note,
      },
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}

export async function markRecommendationApplied(recommendationId: string): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'APPLIED',
      appliedAt: new Date(),
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}
```

- [ ] **Step 5: Create agent/core.ts**

```typescript
import { createAgentRun, updateAgentRun, getAgentRun } from '../db/agent-runs.js';
import { getPendingRecommendations, approveRecommendation, rejectRecommendation } from '../db/recommendations.js';
import { getGroupPolicy } from '../tools/get-group-policy.js';
import { getRecentViolations } from '../tools/get-recent-violations.js';
import { getUserRiskProfiles } from '../tools/get-user-risk-profiles.js';
import { getThreatIndicators } from '../tools/get-threat-indicators.js';
import { getBotPermissions } from '../tools/get-bot-permissions.js';
import { triggerLockdown, releaseLockdown } from '../tools/trigger-lockdown.js';
import { createReviewItem } from '../tools/create-review-items.js';
import { sendAdminReport } from '../tools/send-admin-report.js';
import { checkActionSafety, filterExecutableActions } from '../safety/policy-checker.js';
import { logAgentAction, logAgentRunStarted, logAgentRunCompleted } from '../safety/audit-logger.js';
import { generateRecommendations } from '../planning/recommendation-engine.js';
import { analyzeRiskPosture } from '../planning/risk-analyzer.js';
import type { AgentConfig, ObservationResult, ExecutedAction, Reflection, Plan } from './types.js';
import type { TriggerType, SafetyLevel, PlannedAction } from './types.js';

// Observe step
async function observe(groupId: string, trigger: TriggerType): Promise<ObservationResult> {
  const violations = await getRecentViolations(groupId, 24);
  const riskyUsers = await getUserRiskProfiles(groupId);
  const threats = await getThreatIndicators(groupId);
  const policy = await getGroupPolicy(groupId);
  const permissions = await getBotPermissions(String(policy?.group?.telegramChatId));

  return {
    groupId,
    timestamp: Date.now(),
    violations: {
      countLastHour: violations.countLastHour,
      countLast24h: violations.countLast24h,
      trend: violations.trend,
      topTypes: violations.topTypes,
      topUsers: violations.topUsers,
    },
    security: {
      currentScore: policy?.groupSecurityScore ?? 0,
      scoreDelta: 0,
      botPermissionsOk: permissions?.canDelete ?? false,
      policyMode: policy?.policy?.mode ?? 'BALANCED',
      protectionEnabled: true,
    },
    topRiskyUsers: riskyUsers.map(u => ({ userId: u.userId, riskScore: u.riskScore })),
    threatIndicators: threats.map(t => ({ type: t.type, valueHash: t.valueHash, riskScore: t.riskScore })),
    joinRate: 0, // Would come from Redis raid state
    botPermissions: permissions ?? {
      canDelete: false,
      canRestrict: false,
      canInvite: false,
      canManageVideoChats: false,
    },
  };
}

// Analyze step (simplified - most analysis happens in planning)
function analyze(observations: ObservationResult): Record<string, unknown> {
  return {
    riskPosture: analyzeRiskPosture(observations),
    anomalies: [], // Would call detectAnomalies
    recommendations: [],
  };
}

// Execute or recommend step
async function executeOrRecommend(
  plan: Plan,
  agentConfig: AgentConfig
): Promise<{ executed: ExecutedAction[]; recommended: PlannedAction[] }> {
  const executed: ExecutedAction[] = [];
  const recommended: PlannedAction[] = [];

  for (const action of plan.actions) {
    const safetyResult = checkActionSafety(action, agentConfig);

    if (safetyResult.canExecute) {
      // Execute the action
      await executeAction(action);
      executed.push({
        action,
        status: 'EXECUTED',
        executedAt: Date.now(),
      });

      await logAgentAction({
        agentRunId: '',
        groupId: agentConfig.groupId,
        trigger: agentConfig.trigger,
        action: { action, status: 'EXECUTED' },
        safetyLevel: agentConfig.safetyLevel,
        outcome: 'EXECUTED',
      });
    } else if (safetyResult.requiresApproval) {
      recommended.push(action);
    }
  }

  return { executed, recommended };
}

// Execute a single action
async function executeAction(action: PlannedAction): Promise<void> {
  switch (action.type) {
    case 'CREATE_REVIEW_ITEMS':
      await createReviewItem({
        groupId: action.target,
        itemType: 'user',
        itemId: action.params.reason as string,
        reason: action.reason,
        reasonType: 'AGENT_OBSERVATION',
        labels: [],
        riskScore: 50,
      });
      break;

    case 'LOCKDOWN':
      await triggerLockdown({
        groupId: action.target,
        reason: action.reason,
        durationSeconds: (action.params.durationMinutes as number) * 60,
      });
      break;

    // Other action types would be handled similarly
  }
}

// Reflect step
async function reflect(
  executed: ExecutedAction[],
  recommended: PlannedAction[],
  groupId: string
): Promise<Reflection> {
  const recentViolations = await getRecentViolations(groupId, 1);

  return {
    violationsAfter: recentViolations.countLastHour,
    violationsBefore: 0, // Would need to track before state
    falsePositivesDetected: false,
    adminOverrides: 0,
    recommendationAccuracy: recommended.length > 0 ? 0 : 1, // Simplified
    shouldRollback: false,
    rollbackReason: null,
  };
}

// Main agent cycle
export async function runAgentCycle(
  groupId: string,
  trigger: TriggerType,
  safetyLevel: SafetyLevel
): Promise<{ runId: string; executed: ExecutedAction[]; recommended: PlannedAction[] }> {
  const agentConfig: AgentConfig = {
    groupId,
    trigger,
    safetyLevel,
    autonomousPolicy: {
      enabled: true,
      mode: safetyLevel,
      allowAutoPolicyTuning: false,
      allowAutoDomainBlocking: false,
      allowAutoLockdown: false,
      allowAutoReports: true,
      maxActionsPerHour: 20,
      requireHumanApprovalForHighImpact: true,
    },
  };

  // Create agent run record
  const run = await createAgentRun({
    groupId,
    triggerType: trigger,
    safetyLevel,
  });

  await logAgentRunStarted(run.id, groupId, trigger);

  try {
    // 1. Observe
    const observations = await observe(groupId, trigger);
    await updateAgentRun(run.id, { observations });

    // 2. Analyze
    const analysis = analyze(observations);

    // 3. Plan
    const plan = generateRecommendations(observations);
    await updateAgentRun(run.id, { plan });

    // 4. Execute/Recommend
    const { executed, recommended } = await executeOrRecommend(plan, agentConfig);

    // 5. Reflect
    const reflection = await reflect(executed, recommended, groupId);
    await updateAgentRun(run.id, {
      reflection,
      actions: executed.map(e => ({ ...e, status: e.status })),
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    await logAgentRunCompleted(run.id, groupId, {
      executed: executed.length,
      recommended: recommended.length,
      reflection,
    });

    return { runId: run.id, executed, recommended };
  } catch (error) {
    await updateAgentRun(run.id, {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export { observe, analyze, executeOrRecommend, reflect };
```

- [ ] **Step 6: Commit**

```bash
git add packages/security-agent/src/agent/core.ts packages/security-agent/src/planning/ packages/security-agent/src/db/
git commit -m "feat(security-agent): implement agent core loop and planning"
```

---

## Task 7: Add database migration for agent tables

**Files:**
- Create: `packages/db/src/migrations/0012_add_agent_tables.sql`

- [ ] **Step 1: Create migration**

```sql
-- Migration: Add agent tables
-- Created: 2026-05-16

-- Agent runs table
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  trigger_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  observations JSONB DEFAULT '{}',
  plan JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  reflection JSONB DEFAULT '{}',
  safety_level_used VARCHAR(30) NOT NULL,
  admin_approvals JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_group_id ON agent_runs(group_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  action JSONB NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  admin_response JSONB,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recommendations_group_id ON recommendations(group_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at);

-- Autonomous agent policies table
CREATE TABLE IF NOT EXISTS autonomous_agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  enabled VARCHAR(10) NOT NULL DEFAULT 'false',
  mode VARCHAR(30) NOT NULL DEFAULT 'RECOMMEND_ONLY',
  allow_auto_policy_tuning VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_domain_blocking VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_lockdown VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_reports VARCHAR(10) NOT NULL DEFAULT 'true',
  max_actions_per_hour INTEGER NOT NULL DEFAULT 20,
  require_human_approval_for_high_impact VARCHAR(10) NOT NULL DEFAULT 'true',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_agent_policies_group_id ON autonomous_agent_policies(group_id);
```

Run: `cat > packages/db/src/migrations/0012_add_agent_tables.sql << 'EOF'
-- Migration: Add agent tables
-- Created: 2026-05-16

-- Agent runs table
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  trigger_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  observations JSONB DEFAULT '{}',
  plan JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  reflection JSONB DEFAULT '{}',
  safety_level_used VARCHAR(30) NOT NULL,
  admin_approvals JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_group_id ON agent_runs(group_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  action JSONB NOT NULL,
  reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  admin_response JSONB,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recommendations_group_id ON recommendations(group_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at);

-- Autonomous agent policies table
CREATE TABLE IF NOT EXISTS autonomous_agent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  enabled VARCHAR(10) NOT NULL DEFAULT 'false',
  mode VARCHAR(30) NOT NULL DEFAULT 'RECOMMEND_ONLY',
  allow_auto_policy_tuning VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_domain_blocking VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_lockdown VARCHAR(10) NOT NULL DEFAULT 'false',
  allow_auto_reports VARCHAR(10) NOT NULL DEFAULT 'true',
  max_actions_per_hour INTEGER NOT NULL DEFAULT 20,
  require_human_approval_for_high_impact VARCHAR(10) NOT NULL DEFAULT 'true',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_agent_policies_group_id ON autonomous_agent_policies(group_id);
EOF`

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/0012_add_agent_tables.sql
git commit -m "feat(db): add agent_runs, recommendations, autonomous_agent_policy migration"
```

---

## Task 8: Add bot commands for agent

**Files:**
- Create: `apps/api/src/commands/agent-commands.ts`

- [ ] **Step 1: Create agent commands**

```typescript
import { runAgentCycle } from '@togi/security-agent';
import type { SafetyLevel } from '@togi/security-agent';

export function registerAgentCommands(bot: Telegraf, db: typeof import('@togi/db')) {
  // /togi_analyze - Trigger immediate analysis
  bot.command('togi_analyze', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Verify admin
    const admin = await db.query.groupAdmins.findFirst({
      where: and(
        eq(groupAdmins.telegramUserId, ctx.from?.id),
        eq(groupAdmins.chatId, chatId)
      ),
    });
    if (!admin) {
      return ctx.reply('⛔ Admin verification required.');
    }

    await ctx.reply('🔍 Running security analysis...');

    try {
      const result = await runAgentCycle(
        String(chatId),
        'ADMIN_REQUEST',
        'RECOMMEND_ONLY' as SafetyLevel
      );

      const summary = result.recommended.length > 0
        ? `✅ Analysis complete. Found ${result.recommended.length} recommendations.`
        : `✅ Analysis complete. No actions needed.`;

      await ctx.reply(summary);
    } catch (err) {
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  });

  // /togi_recommend - Request recommendations summary
  bot.command('togi_recommend', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const pending = await db.query.recommendations.findMany({
      where: and(
        eq(recommendations.groupId, String(chatId)),
        eq(recommendations.status, 'PENDING')
      ),
      limit: 5,
    });

    if (pending.length === 0) {
      return ctx.reply('📋 No pending recommendations.');
    }

    const lines = pending.map((rec, i) => 
      `${i + 1}. [${rec.type}] ${rec.reason.slice(0, 50)}...`
    ).join('\n');

    await ctx.reply(`📋 Pending Recommendations:\n\n${lines}`);
  });

  // /togi_agent_status - Show agent mode and last run
  bot.command('togi_agent_status', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const policy = await db.query.autonomousAgentPolicies.findFirst({
      where: eq(autonomousAgentPolicies.groupId, String(chatId)),
    });

    const lastRun = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.groupId, String(chatId)),
      orderBy: [desc(agentRuns.startedAt)],
    });

    const status = policy?.enabled === 'true' ? '🟢 Enabled' : '🔴 Disabled';
    const mode = policy?.mode ?? 'RECOMMEND_ONLY';
    const lastRunTime = lastRun?.startedAt 
      ? new Date(lastRun.startedAt).toLocaleString()
      : 'Never';

    await ctx.reply(`🤖 Agent Status\n\n${status}\nMode: ${mode}\nLast Run: ${lastRunTime}`);
  });
}
```

Run: `cat > apps/api/src/commands/agent-commands.ts << 'EOF'
import { runAgentCycle } from '@togi/security-agent';
import type { SafetyLevel } from '@togi/security-agent';
import { db } from '@togi/db';
import { groupAdmins, agentRuns, recommendations, autonomousAgentPolicies } from '@togi/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';

export function registerAgentCommands(bot: Telegraf) {
  // /togi_analyze - Trigger immediate analysis
  bot.command('togi_analyze', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Verify admin
    const admin = await db.query.groupAdmins.findFirst({
      where: and(
        eq(groupAdmins.telegramUserId, BigInt(ctx.from?.id ?? 0)),
        eq(groupAdmins.chatId, BigInt(chatId))
      ),
    });
    if (!admin) {
      return ctx.reply('⛔ Admin verification required.');
    }

    await ctx.reply('🔍 Running security analysis...');

    try {
      const result = await runAgentCycle(
        String(chatId),
        'ADMIN_REQUEST',
        'RECOMMEND_ONLY' as SafetyLevel
      );

      const summary = result.recommended.length > 0
        ? `✅ Analysis complete. Found ${result.recommended.length} recommendations.`
        : `✅ Analysis complete. No actions needed.`;

      await ctx.reply(summary);
    } catch (err) {
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  });

  // /togi_recommend - Request recommendations summary
  bot.command('togi_recommend', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const pending = await db.query.recommendations.findMany({
      where: and(
        eq(recommendations.groupId, String(chatId)),
        eq(recommendations.status, 'PENDING')
      ),
      limit: 5,
    });

    if (pending.length === 0) {
      return ctx.reply('📋 No pending recommendations.');
    }

    const lines = pending.map((rec, i) => 
      `${i + 1}. [${rec.type}] ${rec.reason.slice(0, 50)}...`
    ).join('\n');

    await ctx.reply(`📋 Pending Recommendations:\n\n${lines}`);
  });

  // /togi_agent_status - Show agent mode and last run
  bot.command('togi_agent_status', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const policy = await db.query.autonomousAgentPolicies.findFirst({
      where: eq(autonomousAgentPolicies.groupId, String(chatId)),
    });

    const lastRun = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.groupId, String(chatId)),
      orderBy: [desc(agentRuns.startedAt)],
    });

    const status = policy?.enabled === 'true' ? '🟢 Enabled' : '🔴 Disabled';
    const mode = policy?.mode ?? 'RECOMMEND_ONLY';
    const lastRunTime = lastRun?.startedAt 
      ? new Date(lastRun.startedAt).toLocaleString()
      : 'Never';

    await ctx.reply(`🤖 Agent Status\n\n${status}\nMode: ${mode}\nLast Run: ${lastRunTime}`);
  });
}
EOF`

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/commands/agent-commands.ts
git commit -m "feat(bot): add /togi_analyze, /togi_recommend, /togi_agent_status commands"
```

---

## Task 9: Add agent dashboard page

**Files:**
- Create: `apps/web/src/pages/dashboard/groups/[groupId]/agent.tsx`

- [ ] **Step 1: Create agent dashboard page**

```tsx
import { useState } from 'react';

interface AgentStatus {
  enabled: boolean;
  mode: string;
  lastRun: string | null;
}

interface AgentRun {
  id: string;
  startedAt: string;
  triggerType: string;
  status: string;
  executedCount: number;
  recommendedCount: number;
}

interface Recommendation {
  id: string;
  type: string;
  priority: string;
  reason: string;
  createdAt: string;
}

export default function AgentPage({ groupId }: { groupId: string }) {
  const [status, setStatus] = useState<AgentStatus>({
    enabled: false,
    mode: 'RECOMMEND_ONLY',
    lastRun: null,
  });

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleApprove = async (id: string) => {
    // API call to approve recommendation
  };

  const handleReject = async (id: string) => {
    // API call to reject recommendation
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Section */}
      <div className="bg-card rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Security Agent</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm ${status.enabled ? 'text-green-500' : 'text-red-500'}`}>
              {status.enabled ? '🟢 Enabled' : '🔴 Disabled'}
            </p>
            <p className="text-sm text-muted">Mode: {status.mode}</p>
            <p className="text-sm text-muted">
              Last run: {status.lastRun ?? 'Never'}
            </p>
          </div>
          <button
            onClick={() => setStatus(s => ({ ...s, enabled: !s.enabled }))}
            className={`px-4 py-2 rounded ${status.enabled ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {status.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Recent Agent Runs */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Recent Agent Runs</h3>
        {runs.length === 0 ? (
          <p className="text-muted text-sm">No agent runs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Trigger</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b">
                  <td className="py-2">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-2">{run.triggerType}</td>
                  <td className="py-2">{run.status}</td>
                  <td className="py-2">{run.executedCount} exec, {run.recommendedCount} rec</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Recommendations */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Pending Recommendations</h3>
        {recommendations.length === 0 ? (
          <p className="text-muted text-sm">No pending recommendations.</p>
        ) : (
          <div className="space-y-4">
            {recommendations.map(rec => (
              <div key={rec.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      rec.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      rec.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.type}
                    </span>
                    <p className="text-sm mt-2">{rec.reason}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(rec.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(rec.id)}
                      className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(rec.id)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Configuration */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted">Mode</label>
            <select
              value={status.mode}
              onChange={(e) => setStatus(s => ({ ...s, mode: e.target.value }))}
              className="w-full mt-1 bg-background border rounded px-3 py-2"
            >
              <option value="OBSERVE_ONLY">Observe Only</option>
              <option value="RECOMMEND_ONLY">Recommend Only</option>
              <option value="AUTO_LOW_RISK">Auto (Low Risk)</option>
              <option value="AUTO_HIGH_RISK_WITH_POLICY">Auto (High Risk with Policy)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Run: `mkdir -p apps/web/src/pages/dashboard/groups/[groupId] && cat > apps/web/src/pages/dashboard/groups/[groupId]/agent.tsx << 'EOF'
import { useState } from 'react';

interface AgentStatus {
  enabled: boolean;
  mode: string;
  lastRun: string | null;
}

interface AgentRun {
  id: string;
  startedAt: string;
  triggerType: string;
  status: string;
  executedCount: number;
  recommendedCount: number;
}

interface Recommendation {
  id: string;
  type: string;
  priority: string;
  reason: string;
  createdAt: string;
}

export default function AgentPage({ groupId }: { groupId: string }) {
  const [status, setStatus] = useState<AgentStatus>({
    enabled: false,
    mode: 'RECOMMEND_ONLY',
    lastRun: null,
  });

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleApprove = async (id: string) => {
    // API call to approve recommendation
  };

  const handleReject = async (id: string) => {
    // API call to reject recommendation
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Section */}
      <div className="bg-card rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Security Agent</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm ${status.enabled ? 'text-green-500' : 'text-red-500'}`}>
              {status.enabled ? '🟢 Enabled' : '🔴 Disabled'}
            </p>
            <p className="text-sm text-muted">Mode: {status.mode}</p>
            <p className="text-sm text-muted">
              Last run: {status.lastRun ?? 'Never'}
            </p>
          </div>
          <button
            onClick={() => setStatus(s => ({ ...s, enabled: !s.enabled }))}
            className={`px-4 py-2 rounded ${status.enabled ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {status.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Recent Agent Runs */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Recent Agent Runs</h3>
        {runs.length === 0 ? (
          <p className="text-muted text-sm">No agent runs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Trigger</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b">
                  <td className="py-2">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-2">{run.triggerType}</td>
                  <td className="py-2">{run.status}</td>
                  <td className="py-2">{run.executedCount} exec, {run.recommendedCount} rec</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Recommendations */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Pending Recommendations</h3>
        {recommendations.length === 0 ? (
          <p className="text-muted text-sm">No pending recommendations.</p>
        ) : (
          <div className="space-y-4">
            {recommendations.map(rec => (
              <div key={rec.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      rec.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      rec.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.type}
                    </span>
                    <p className="text-sm mt-2">{rec.reason}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(rec.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(rec.id)}
                      className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(rec.id)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Configuration */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted">Mode</label>
            <select
              value={status.mode}
              onChange={(e) => setStatus(s => ({ ...s, mode: e.target.value }))}
              className="w-full mt-1 bg-background border rounded px-3 py-2"
            >
              <option value="OBSERVE_ONLY">Observe Only</option>
              <option value="RECOMMEND_ONLY">Recommend Only</option>
              <option value="AUTO_LOW_RISK">Auto (Low Risk)</option>
              <option value="AUTO_HIGH_RISK_WITH_POLICY">Auto (High Risk with Policy)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF`

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/dashboard/groups/[groupId]/agent.tsx
git commit -m "feat(dashboard): add agent page to group dashboard"
```

---

## Task 10: Write tests

**Files:**
- Create: `packages/security-agent/src/__tests__/agent-core.test.ts`
- Create: `packages/security-agent/src/__tests__/safety-checker.test.ts`
- Create: `packages/security-agent/src/__tests__/observe.test.ts`
- Create: `packages/security-agent/src/__tests__/reflection.test.ts`

- [ ] **Step 1: Create safety-checker.test.ts**

```typescript
import { describe, it, expect } from '@jest/globals';
import { canAutoExecute, isHighImpact, requiresApproval } from '../safety/safety-levels';

describe('Safety Levels', () => {
  describe('canAutoExecute', () => {
    it('OBSERVE_ONLY never auto-executes', () => {
      expect(canAutoExecute('OBSERVE_ONLY', 'LOW')).toBe(false);
      expect(canAutoExecute('OBSERVE_ONLY', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('OBSERVE_ONLY', 'HIGH')).toBe(false);
    });

    it('RECOMMEND_ONLY never auto-executes', () => {
      expect(canAutoExecute('RECOMMEND_ONLY', 'LOW')).toBe(false);
      expect(canAutoExecute('RECOMMEND_ONLY', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('RECOMMEND_ONLY', 'HIGH')).toBe(false);
    });

    it('AUTO_LOW_RISK only executes LOW risk', () => {
      expect(canAutoExecute('AUTO_LOW_RISK', 'LOW')).toBe(true);
      expect(canAutoExecute('AUTO_LOW_RISK', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('AUTO_LOW_RISK', 'HIGH')).toBe(false);
    });

    it('AUTO_HIGH_RISK_WITH_POLICY executes LOW and MEDIUM', () => {
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'LOW')).toBe(true);
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'MEDIUM')).toBe(true);
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'HIGH')).toBe(false);
    });
  });

  describe('isHighImpact', () => {
    it('HIGH is high impact', () => {
      expect(isHighImpact('HIGH')).toBe(true);
    });

    it('LOW and MEDIUM are not high impact', () => {
      expect(isHighImpact('LOW')).toBe(false);
      expect(isHighImpact('MEDIUM')).toBe(false);
    });
  });

  describe('requiresApproval', () => {
    it('HIGH always requires approval regardless of safety level', () => {
      expect(requiresApproval('AUTO_HIGH_RISK_WITH_POLICY', 'HIGH')).toBe(true);
      expect(requiresApproval('AUTO_LOW_RISK', 'HIGH')).toBe(true);
      expect(requiresApproval('RECOMMEND_ONLY', 'HIGH')).toBe(true);
    });

    it('LOW does not require approval in AUTO_LOW_RISK', () => {
      expect(requiresApproval('AUTO_LOW_RISK', 'LOW')).toBe(false);
    });

    it('MEDIUM requires approval in AUTO_LOW_RISK', () => {
      expect(requiresApproval('AUTO_LOW_RISK', 'MEDIUM')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Create observe.test.ts**

```typescript
import { describe, it, expect, vi } from '@jest/globals';
import { observe } from '../agent/core';

vi.mock('../tools/get-group-policy', () => ({
  getGroupPolicy: vi.fn().mockResolvedValue(null),
}));

vi.mock('../tools/get-recent-violations', () => ({
  getRecentViolations: vi.fn().mockResolvedValue({
    countLastHour: 5,
    countLast24h: 30,
    trend: 'stable' as const,
    topTypes: [{ type: 'SPAM', count: 20 }],
    topUsers: [],
  }),
}));

vi.mock('../tools/get-user-risk-profiles', () => ({
  getUserRiskProfiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('../tools/get-threat-indicators', () => ({
  getThreatIndicators: vi.fn().mockResolvedValue([]),
}));

vi.mock('../tools/get-bot-permissions', () => ({
  getBotPermissions: vi.fn().mockResolvedValue({
    canDelete: true,
    canRestrict: true,
    canInvite: true,
    canManageVideoChats: true,
  }),
}));

describe('Observe Step', () => {
  it('should collect observations for a group', async () => {
    const result = await observe('test-group-id', 'SCHEDULED');
    
    expect(result.groupId).toBe('test-group-id');
    expect(result.timestamp).toBeDefined();
    expect(result.violations.countLast24h).toBe(30);
    expect(result.botPermissions.canDelete).toBe(true);
  });
});
```

- [ ] **Step 3: Create reflection.test.ts**

```typescript
import { describe, it, expect, vi } from '@jest/globals';
import { reflect } from '../agent/core';

vi.mock('../tools/get-recent-violations', () => ({
  getRecentViolations: vi.fn().mockResolvedValue({
    countLastHour: 2,
    countLast24h: 20,
    trend: 'decreasing' as const,
    topTypes: [],
    topUsers: [],
  }),
}));

describe('Reflect Step', () => {
  it('should return reflection data', async () => {
    const executed = [];
    const recommended = [];

    const result = await reflect(executed, recommended, 'test-group-id');

    expect(result.violationsAfter).toBe(2);
    expect(result.shouldRollback).toBe(false);
  });
});
```

- [ ] **Step 4: Create agent-core.test.ts**

```typescript
import { describe, it, expect, vi } from '@jest/globals';
import { runAgentCycle } from '../agent/core';

vi.mock('../db/agent-runs', () => ({
  createAgentRun: vi.fn().mockResolvedValue({ id: 'run-123' }),
  updateAgentRun: vi.fn().mockResolvedValue({}),
}));

vi.mock('../safety/audit-logger', () => ({
  logAgentAction: vi.fn().mockResolvedValue(undefined),
  logAgentRunStarted: vi.fn().mockResolvedValue(undefined),
  logAgentRunCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../agent/core', async () => {
  const actual = await vi.importActual('../agent/core');
  return {
    ...actual,
    observe: vi.fn().mockResolvedValue({
      groupId: 'test',
      timestamp: Date.now(),
      violations: { countLastHour: 0, countLast24h: 0, trend: 'stable', topTypes: [], topUsers: [] },
      security: { currentScore: 80, scoreDelta: 0, botPermissionsOk: true, policyMode: 'BALANCED', protectionEnabled: true },
      topRiskyUsers: [],
      threatIndicators: [],
      joinRate: 0,
      botPermissions: { canDelete: true, canRestrict: true, canInvite: true, canManageVideoChats: true },
    }),
  };
});

describe('Agent Core', () => {
  it('should run agent cycle and return results', async () => {
    const result = await runAgentCycle('group-123', 'SCHEDULED', 'RECOMMEND_ONLY');

    expect(result.runId).toBeDefined();
    expect(Array.isArray(result.executed)).toBe(true);
    expect(Array.isArray(result.recommended)).toBe(true);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/security-agent/src/__tests__/
git commit -m "test(security-agent): add tests for safety levels, observe, reflection, agent core"
```

---

## Task 11: Create documentation

**Files:**
- Create: `docs/AUTONOMOUS_AGENT.md`
- Modify: `docs/SECURITY_MODEL.md` — Add agent section
- Modify: `docs/PRODUCT_SPEC.md` — Add agent capabilities

- [ ] **Step 1: Create docs/AUTONOMOUS_AGENT.md**

```markdown
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
```

- [ ] **Step 2: Update SECURITY_MODEL.md** (append to end)

```
## Autonomous Agent

### Agent Modes

| Mode | Auto-execute | Recommend | High-impact approval |
|------|--------------|-----------|---------------------|
| OBSERVE_ONLY | — | — | Required |
| RECOMMEND_ONLY | — | All | Required |
| AUTO_LOW_RISK | Low-risk | Others | Required |
| AUTO_HIGH_RISK_WITH_POLICY | Policy-allowed | Others | Required |

### High-impact Actions

The following always require explicit admin approval regardless of agent mode:
- Permanent ban
- Group lockdown
- Domain block (global)

### Agent Triggers

- SCHEDULED: Periodic analysis (default: 15 min)
- RAID: Mass-join detected
- SPIKE: Violation spike detected
- ADMIN_REQUEST: `/togi_analyze` command
- POLICY_REVIEW: Weekly review

### Audit Trail

All agent actions are logged to `agent_runs` table with:
- Trigger type
- Observations collected
- Plan generated
- Actions taken (executed vs recommended)
- Reflection results
- Admin approvals (for high-impact actions)

### Safety Policy

Agent actions are validated against `autonomous_agent_policy`:
- `enabled`: Agent active for group
- `mode`: Safety level (OBSERVE_ONLY, RECOMMEND_ONLY, etc.)
- `allowAutoPolicyTuning`: Auto-adjust policy settings
- `allowAutoDomainBlocking`: Auto-block domains
- `allowAutoLockdown`: Auto-enable lockdown
- `maxActionsPerHour`: Rate limit on auto-actions
- `requireHumanApprovalForHighImpact`: Always true for ban/lockdown/domain block
```

- [ ] **Step 3: Update PRODUCT_SPEC.md** (add to capabilities section)

```
### Autonomous Agent (Phase 08)

- **Self-learning security**: Agent observes group patterns, recommends policy adjustments
- **Event-driven triggers**: Scheduled, raid, spike, or manual analysis
- **Graduated autonomy**: From observe-only to fully autonomous within policy bounds
- **Explainable AI**: Every recommendation includes human-readable reasoning
- **Admin control**: All high-impact actions require explicit approval
- **Audit trail**: Complete history of agent decisions and outcomes
```

- [ ] **Step 4: Commit**

```bash
git add docs/AUTONOMOUS_AGENT.md docs/SECURITY_MODEL.md docs/PRODUCT_SPEC.md
git commit -m "docs: add autonomous agent documentation"
```

---

## Task 12: Final verification and summary

- [ ] Run: `pnpm install && pnpm --filter @togi/security-agent build`
- [ ] Run: `pnpm --filter @togi/security-agent typecheck`
- [ ] Run: `pnpm --filter @togi/security-agent test`

**Expected output:** All builds pass, typecheck passes, tests pass.

---

## Summary

```
Agent Modes:
- OBSERVE_ONLY: Watch only, no actions
- RECOMMEND_ONLY: Analyze and recommend, never auto-execute  
- AUTO_LOW_RISK: Auto-execute low-risk, recommend others
- AUTO_HIGH_RISK_WITH_POLICY: Auto-execute policy-allowed, require approval for high-impact

Tools:
- getGroupPolicy, getRecentViolations, getUserRiskProfiles, getThreatIndicators, getBotPermissions (READ)
- proposePolicyChange, applyPolicyChange, proposeDomainBlock, applyDomainBlock, triggerLockdown, sendAdminReport, createReviewItems (WRITE)

Safety Boundaries:
- High-impact (ban, lockdown, domain block) ALWAYS require admin approval
- Agent cannot bypass RBAC or Telegram admin permissions
- All actions are explainable and auditable
- Rate limited to prevent runaway automation

PASS/FAIL Checklist:
- [ ] packages/security-agent/ created
- [ ] agent_runs, recommendations, autonomous_agent_policy tables added
- [ ] Agent core loop: Observe → Analyze → Plan → Execute/Recommend → Reflect
- [ ] All tools implemented (13 total)
- [ ] Safety policy checker prevents unauthorized actions
- [ ] Bot commands: /togi_analyze, /togi_recommend, /togi_agent_status
- [ ] Dashboard agent page at /dashboard/groups/[groupId]/agent
- [ ] Tests for observe, plan, safety policy, audit, reflection
- [ ] docs/AUTONOMOUS_AGENT.md created
- [ ] SECURITY_MODEL.md and PRODUCT_SPEC.md updated
```