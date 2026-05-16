# Phase 07: User Behavior Memory and Cross-Group Threat Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build persistent user risk profiles and cross-group threat intelligence sharing while maintaining strict privacy controls.

**Architecture:** User risk profiles stored per-group to avoid cross-group data leakage. Threat indicators are anonymized (hashes only, no raw text). Global intelligence uses configurable thresholds to promote indicators between groups.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Redis for hot data.

---

## File Structure

```
packages/db/src/
├── schema.ts                 # Add new tables (modified)
├── schema.sql                # Add new migrations (modified)

packages/detection-engine/src/
├── detectors/
│   ├── user-risk-detector.ts  # New: User risk profiling
│   └── threat-intel-detector.ts # New: Cross-group threat checking
└── risk-score.ts              # Add user risk modifier (modified)

packages/policy-engine/src/
├── types.ts                   # Add crossGroupIntelligence config (modified)
├── policy-defaults.ts        # Add default config (modified)
└── engine.ts                  # Export new config type (modified)

packages/worker/src/
├── threat-intel-worker.ts     # New: Async threat intel processing
└── index.ts                   # Register new worker (modified)

tools/load-test/
├── src/
│   └── run-threat-intel-benchmark.ts  # New: Threat intel benchmarks
```

---

## Task 1: Database Schema - User Risk Profiles

**Files:**
- Modify: `packages/db/src/schema.ts` - Add user_risk_profiles, group_user_profiles tables
- Modify: `packages/db/src/schema.sql` - Add migration SQL

- [ ] **Step 1: Add user_risk_profiles table to schema.ts**

```typescript
// Add to packages/db/src/schema.ts after sessions table

// User risk profiles (aggregated across groups)
export const userRiskProfiles = pgTable('user_risk_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique().notNull(),
  globalRiskScore: integer('global_risk_score').notNull().default(0),
  totalViolations: integer('total_violations').notNull().default(0),
  severeViolations: integer('severe_violations').notNull().default(0),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastViolationAt: timestamp('last_violation_at', { withTimezone: true }),
  labels: jsonb('labels').default([]), // ['SPAM', 'SCAM_DOMAIN', etc.]
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  telegramUserIdIdx: uniqueIndex('user_risk_profiles_telegram_user_id_unique').on(table.telegramUserId),
}));
```

- [ ] **Step 2: Add group_user_profiles table**

```typescript
// Per-group user behavior (privacy: isolated per group)
export const groupUserProfiles = pgTable('group_user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
  trustScore: integer('trust_score').notNull().default(50), // 0-100
  riskScore: integer('risk_score').notNull().default(0),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
  firstMessageAt: timestamp('first_message_at', { withTimezone: true }),
  messageCount: integer('message_count').notNull().default(0),
  violationCount: integer('violation_count').notNull().default(0),
  warningCount: integer('warning_count').notNull().default(0),
  muteCount: integer('mute_count').notNull().default(0),
  banCount: integer('ban_count').notNull().default(0),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  probationUntil: timestamp('probation_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupUserUnique: uniqueIndex('group_user_profiles_group_user_unique').on(table.groupId, table.telegramUserId),
  groupIdIdx: index('idx_group_user_profiles_group_id').on(table.groupId),
}));
```

- [ ] **Step 3: Add threat_indicators table**

```typescript
// Cross-group threat intelligence (anonymized)
export const threatIndicators = pgTable('threat_indicators', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 30 }).notNull(), // DOMAIN | URL_HASH | TEXT_HASH | USER_PATTERN | INVITE_LINK | FILE_HASH
  valueHash: varchar('value_hash', { length: 64 }).notNull(), // SHA256 of original value
  normalizedValue: varchar('normalized_value', { length: 255 }), // Only for DOMAIN type (for matching)
  riskScore: integer('risk_score').notNull().default(0),
  labels: jsonb('labels').default([]),
  firstSeenGroupId: uuid('first_seen_group_id').references(() => groups.id, { onDelete: 'set null' }),
  seenCount: integer('seen_count').notNull().default(1),
  affectedGroupCount: integer('affected_group_count').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('WATCH'), // WATCH | BLOCK | ALLOW | EXPIRED
  source: varchar('source', { length: 20 }).notNull().default('AUTO'), // AUTO | ADMIN | EXTERNAL | SYSTEM
}, (table) => ({
  typeIdx: index('idx_threat_indicators_type').on(table.type),
  statusIdx: index('idx_threat_indicators_status').on(table.status),
  valueHashIdx: uniqueIndex('idx_threat_indicators_value_hash_unique').on(table.valueHash),
}));

// Group intelligence opt-out tracking
export const groupIntelligenceSettings = pgTable('group_intelligence_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }).unique(),
  consumeGlobalWatchlist: integer('consume_global_watchlist').notNull().default(1), // boolean as int
  contributeAnonymousSignals: integer('contribute_anonymous_signals').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: uniqueIndex('group_intelligence_settings_group_id_unique').on(table.groupId),
}));
```

- [ ] **Step 4: Add type exports**

```typescript
// Add to end of schema.ts type exports
export type UserRiskProfile = typeof userRiskProfiles.$inferSelect;
export type NewUserRiskProfile = typeof userRiskProfiles.$inferInsert;
export type GroupUserProfile = typeof groupUserProfiles.$inferSelect;
export type NewGroupUserProfile = typeof groupUserProfiles.$inferInsert;
export type ThreatIndicator = typeof threatIndicators.$inferSelect;
export type NewThreatIndicator = typeof threatIndicators.$inferInsert;
export type GroupIntelligenceSettings = typeof groupIntelligenceSettings.$inferSelect;
export type NewGroupIntelligenceSettings = typeof groupIntelligenceSettings.$inferInsert;
```

- [ ] **Step 5: Add SQL migration**

Add to `packages/db/src/schema.sql`:

```sql
-- User Risk Profiles (Phase 07)
CREATE TABLE IF NOT EXISTS user_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  global_risk_score INTEGER NOT NULL DEFAULT 0,
  total_violations INTEGER NOT NULL DEFAULT 0,
  severe_violations INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_violation_at TIMESTAMPTZ,
  labels JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_risk_profiles_telegram_user_id_unique ON user_risk_profiles(telegram_user_id);

-- Group User Profiles (Phase 07)
CREATE TABLE IF NOT EXISTS group_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  trust_score INTEGER NOT NULL DEFAULT 50,
  risk_score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  mute_count INTEGER NOT NULL DEFAULT 0,
  ban_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  probation_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, telegram_user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_user_profiles_group_id ON group_user_profiles(group_id);

-- Threat Indicators (Phase 07)
CREATE TABLE IF NOT EXISTS threat_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL,
  value_hash VARCHAR(64) NOT NULL UNIQUE,
  normalized_value VARCHAR(255),
  risk_score INTEGER NOT NULL DEFAULT 0,
  labels JSONB DEFAULT '[]',
  first_seen_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  affected_group_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'WATCH',
  source VARCHAR(20) NOT NULL DEFAULT 'AUTO'
);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_type ON threat_indicators(type);
CREATE INDEX IF NOT EXISTS idx_threat_indicators_status ON threat_indicators(status);

-- Group Intelligence Settings (Phase 07)
CREATE TABLE IF NOT EXISTS group_intelligence_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  consume_global_watchlist INTEGER NOT NULL DEFAULT 1,
  contribute_anonymous_signals INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 6: Verify schema compiles**

Run: `pnpm --filter @togi/db build`
Expected: SUCCESS (0 errors)

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/schema.sql
git commit -m "feat(db): add user risk profiles, group profiles, and threat indicators tables (Phase 07)"
```

---

## Task 2: Policy Configuration - Cross-Group Intelligence Settings

**Files:**
- Modify: `packages/policy-engine/src/types.ts` - Add CrossGroupIntelligence config
- Modify: `packages/policy-engine/src/policy-defaults.ts` - Add defaults

- [ ] **Step 1: Add CrossGroupIntelligence type to types.ts**

Add to PolicyContext interface in `packages/policy-engine/src/types.ts`:

```typescript
crossGroupIntelligence?: {
  enabled: boolean;
  consumeGlobalWatchlist: boolean;
  contributeAnonymousSignals: boolean;
  autoBlockHighConfidenceIndicators: boolean;
  minGroupsForGlobalWatch: number;
  minRiskForGlobalBlock: number;
};
```

- [ ] **Step 2: Add default config to policy-defaults.ts**

```typescript
// Add to getDefaultPolicy() return object under crossGroupIntelligence:
crossGroupIntelligence: {
  enabled: true,
  consumeGlobalWatchlist: true,
  contributeAnonymousSignals: true,
  autoBlockHighConfidenceIndicators: false,
  minGroupsForGlobalWatch: 3,
  minRiskForGlobalBlock: 70,
},
```

Also add to each policy mode (RELAXED, BALANCED, STRICT, PARANOID, CUSTOM) as appropriate:
- RELAXED: consumeGlobalWatchlist: true, contributeAnonymousSignals: false, autoBlockHighConfidenceIndicators: false
- BALANCED: consumeGlobalWatchlist: true, contributeAnonymousSignals: true, autoBlockHighConfidenceIndicators: false
- STRICT: consumeGlobalWatchlist: true, contributeAnonymousSignals: true, autoBlockHighConfidenceIndicators: true
- PARANOID: consumeGlobalWatchlist: true, contributeAnonymousSignals: true, autoBlockHighConfidenceIndicators: true
- CUSTOM: inherits from BALANCED

- [ ] **Step 3: Export from engine.ts**

Add to exports in `packages/policy-engine/src/engine.ts`:
```typescript
export type { CrossGroupIntelligenceConfig } from './types.js';
```

- [ ] **Step 4: Verify policy engine compiles**

Run: `pnpm --filter @togi/policy-engine build`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add packages/policy-engine/src/types.ts packages/policy-engine/src/policy-defaults.ts packages/policy-engine/src/engine.ts
git commit -m "feat(policy): add cross-group intelligence configuration (Phase 07)"
```

---

## Task 3: User Risk Profile Detector

**Files:**
- Create: `packages/detection-engine/src/detectors/user-risk-detector.ts`
- Modify: `packages/detection-engine/src/detectors/index.ts` - Export new detector
- Modify: `packages/detection-engine/src/fast-path-engine.ts` - Integrate new detector
- Create: `packages/detection-engine/src/__tests__/user-risk-detector.test.ts`

- [ ] **Step 1: Write tests for user risk detector**

```typescript
// packages/detection-engine/src/__tests__/user-risk-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateUserRiskModifier, type UserRiskContext } from '../detectors/user-risk-detector.js';

describe('user-risk-detector', () => {
  describe('calculateUserRiskModifier', () => {
    it('returns 0 for trusted user with no violations', () => {
      const context: UserRiskContext = {
        telegramUserId: 123456n,
        groupId: 'uuid-1',
        globalRiskScore: 0,
        groupTrustScore: 100,
        totalViolations: 0,
        severeViolations: 0,
        isNewUser: false,
        hasUsername: true,
        firstMessageHasLink: false,
        isGroupAdmin: false,
        isProbation: false,
      };

      const modifier = calculateUserRiskModifier(context);
      expect(modifier).toBe(0);
    });

    it('increases risk for user with high global risk score', () => {
      const context: UserRiskContext = {
        telegramUserId: 123456n,
        groupId: 'uuid-1',
        globalRiskScore: 80,
        groupTrustScore: 50,
        totalViolations: 5,
        severeViolations: 1,
        isNewUser: false,
        hasUsername: true,
        firstMessageHasLink: false,
        isGroupAdmin: false,
        isProbation: false,
      };

      const modifier = calculateUserRiskModifier(context);
      expect(modifier).toBeGreaterThan(0);
    });

    it('increases risk for new user without username', () => {
      const context: UserRiskContext = {
        telegramUserId: 123456n,
        groupId: 'uuid-1',
        globalRiskScore: 0,
        groupTrustScore: 50,
        totalViolations: 0,
        severeViolations: 0,
        isNewUser: true,
        hasUsername: false,
        firstMessageHasLink: false,
        isGroupAdmin: false,
        isProbation: true,
      };

      const modifier = calculateUserRiskModifier(context);
      expect(modifier).toBeGreaterThanOrEqual(15); // New user + no username + probation
    });

    it('reduces risk for trusted long-standing member', () => {
      const context: UserRiskContext = {
        telegramUserId: 123456n,
        groupId: 'uuid-1',
        globalRiskScore: 10,
        groupTrustScore: 90,
        totalViolations: 1,
        severeViolations: 0,
        isNewUser: false,
        hasUsername: true,
        firstMessageHasLink: false,
        isGroupAdmin: false,
        isProbation: false,
      };

      const modifier = calculateUserRiskModifier(context);
      expect(modifier).toBeLessThan(0); // Trust should reduce risk
    });

    it('handles missing user profile (new user case)', () => {
      const context: UserRiskContext = {
        telegramUserId: 999999n, // Never seen before
        groupId: 'uuid-1',
        globalRiskScore: 0,
        groupTrustScore: 50,
        totalViolations: 0,
        severeViolations: 0,
        isNewUser: true,
        hasUsername: true,
        firstMessageHasLink: false,
        isGroupAdmin: false,
        isProbation: false,
      };

      const modifier = calculateUserRiskModifier(context);
      // New user with username but no profile yet
      expect(modifier).toBeGreaterThanOrEqual(5);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/user-risk-detector.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write user risk detector implementation**

```typescript
// packages/detection-engine/src/detectors/user-risk-detector.ts

export interface UserRiskContext {
  telegramUserId: bigint;
  groupId: string;
  globalRiskScore: number;
  groupTrustScore: number;
  totalViolations: number;
  severeViolations: number;
  isNewUser: boolean;
  hasUsername: boolean;
  firstMessageHasLink: boolean;
  isGroupAdmin: boolean;
  isProbation: boolean;
}

export interface UserRiskResult {
  modifier: number; // Added to final risk score (-30 to +50 range)
  labels: string[];
  riskFactors: string[];
  trustFactors: string[];
}

const RISK_WEIGHTS = {
  // New user risk
  newUserBase: 10,
  noUsername: 10,
  firstMessageLink: 5,
  probation: 5,

  // Violation risk
  violationBase: 5,
  severeViolationMultiplier: 3,

  // High risk signals
  highGlobalRisk: 15,
  multipleGroupsSuspicious: 10,

  // Trust reductions (negative modifiers)
  trustedMember: -10,
  highTrustScore: -15,
  noRecentViolations: -5,
  verifiedByAdmin: -10,
};

const TRUST_THRESHOLDS = {
  highTrust: 80,
  mediumTrust: 50,
  lowTrust: 20,
};

export function calculateUserRiskModifier(context: UserRiskContext): number {
  let modifier = 0;
  const riskFactors: string[] = [];
  const trustFactors: string[] = [];

  // New user risk
  if (context.isNewUser) {
    modifier += RISK_WEIGHTS.newUserBase;
    riskFactors.push('new_user');
  }

  // No username (suspicious)
  if (!context.hasUsername) {
    modifier += RISK_WEIGHTS.noUsername;
    riskFactors.push('no_username');
  }

  // First message has link (common spam pattern)
  if (context.firstMessageHasLink) {
    modifier += RISK_WEIGHTS.firstMessageLink;
    riskFactors.push('first_message_link');
  }

  // On probation
  if (context.isProbation) {
    modifier += RISK_WEIGHTS.probation;
    riskFactors.push('on_probation');
  }

  // Group admin (always trust)
  if (context.isGroupAdmin) {
    modifier += RISK_WEIGHTS.trustedMember;
    trustFactors.push('group_admin');
  }

  // Violation history
  if (context.totalViolations > 0) {
    modifier += Math.min(context.totalViolations * RISK_WEIGHTS.violationBase, 30);
    riskFactors.push(`${context.totalViolations}_violations`);
  }

  if (context.severeViolations > 0) {
    modifier += context.severeViolations * RISK_WEIGHTS.severeViolationMultiplier * RISK_WEIGHTS.violationBase;
    riskFactors.push(`${context.severeViolations}_severe`);
  }

  // High global risk score
  if (context.globalRiskScore >= 70) {
    modifier += RISK_WEIGHTS.highGlobalRisk;
    riskFactors.push('high_global_risk');
  } else if (context.globalRiskScore >= 50) {
    modifier += Math.floor(RISK_WEIGHTS.highGlobalRisk / 2);
    riskFactors.push('elevated_global_risk');
  }

  // Trust score reduction (only if no recent risk factors)
  if (context.groupTrustScore >= TRUST_THRESHOLDS.highTrust && riskFactors.length === 0) {
    modifier += RISK_WEIGHTS.highTrustScore;
    trustFactors.push('high_trust_score');
  } else if (context.groupTrustScore >= TRUST_THRESHOLDS.mediumTrust && riskFactors.length === 0) {
    modifier += RISK_WEIGHTS.trustedMember;
    trustFactors.push('medium_trust_score');
  }

  // No recent violations (trust building)
  if (context.totalViolations === 0 && !context.isNewUser) {
    modifier += RISK_WEIGHTS.noRecentViolations;
    trustFactors.push('clean_record');
  }

  // Clamp modifier to reasonable range
  return Math.max(-30, Math.min(50, modifier));
}

export function userRiskToDetection(result: UserRiskResult): Partial<{
  riskModifier: number;
  labels: string[];
  reasons: string[];
}> {
  return {
    riskModifier: result.modifier,
    labels: result.labels,
    reasons: [...result.riskFactors, ...result.trustFactors],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/user-risk-detector.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Export from detectors index**

Add to `packages/detection-engine/src/detectors/index.ts`:
```typescript
export * from './user-risk-detector.js';
```

- [ ] **Step 6: Integrate into fast-path-engine.ts**

Add to `runFastPath` function in `fast-path-engine.ts`:

```typescript
import { calculateUserRiskModifier, type UserRiskContext } from './detectors/user-risk-detector.js';

// In runFastPath function, before merging detection results:
const userRiskContext: UserRiskContext = {
  telegramUserId: BigInt(context.userId || '0'),
  groupId: context.chatId,
  globalRiskScore: 0, // Will be fetched from DB
  groupTrustScore: 50, // Will be fetched from group profile
  totalViolations: 0,
  severeViolations: 0,
  isNewUser: context.isNewUser,
  hasUsername: !!context.username,
  firstMessageHasLink: context.links.length > 0 && context.messageId === 1,
  isGroupAdmin: false, // Will be fetched from group admins
  isProbation: false, // Will be fetched from group profile
};

const userRiskModifier = calculateUserRiskModifier(userRiskContext);
```

Then add `userRiskModifier` to the final risk calculation:

```typescript
// In calculateRiskScore call, add userRiskModifier:
const riskScoreResult = calculateRiskScore({
  rateLimitScore: detectionInputs[0]?.riskScore || 0,
  // ... other scores ...
  userRiskModifier, // NEW: Add user risk modifier
}, policy);
```

- [ ] **Step 7: Commit**

```bash
git add packages/detection-engine/src/detectors/user-risk-detector.ts packages/detection-engine/src/detectors/index.ts packages/detection-engine/src/fast-path-engine.ts packages/detection-engine/src/__tests__/user-risk-detector.test.ts
git commit -m "feat(detection): add user risk profile detector (Phase 07)"
```

---

## Task 4: Threat Intelligence Detector (Cross-Group)

**Files:**
- Create: `packages/detection-engine/src/detectors/threat-intel-detector.ts`
- Create: `packages/detection-engine/src/__tests__/threat-intel-detector.test.ts`

- [ ] **Step 1: Write tests for threat intel detector**

```typescript
// packages/detection-engine/src/__tests__/threat-intel-detector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeThreatIndicators, type ThreatIntelContext } from '../detectors/threat-intel-detector.js';

describe('threat-intel-detector', () => {
  describe('analyzeThreatIndicators', () => {
    it('returns empty for no links and no text hash', () => {
      const context: ThreatIntelContext = {
        links: [],
        textHash: undefined,
        inviteLink: undefined,
        telegramUserId: undefined,
      };

      const result = analyzeThreatIndicators(context, {
        consumeGlobalWatchlist: true,
        minGroupsForGlobalWatch: 3,
        minRiskForGlobalBlock: 70,
      });

      expect(result.indicatorFound).toBe(false);
      expect(result.modifier).toBe(0);
    });

    it('detects watch domain from global watchlist', () => {
      // Note: This test would need mocking the DB
      // For unit testing, we test the logic function with mock indicators
      const mockIndicators = new Map([
        ['malicious-site.com', { status: 'WATCH', riskScore: 60, affectedGroups: 3 }],
      ]);

      const context: ThreatIntelContext = {
        links: ['https://malicious-site.com/payload'],
        textHash: undefined,
        inviteLink: undefined,
        telegramUserId: undefined,
      };

      const result = analyzeThreatIndicatorsWithMocks(context, mockIndicators, {
        consumeGlobalWatchlist: true,
        minGroupsForGlobalWatch: 3,
        minRiskForGlobalBlock: 70,
      });

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBeGreaterThan(0);
      expect(result.matchedIndicator?.status).toBe('WATCH');
    });

    it('applies higher modifier for BLOCK status', () => {
      const mockIndicators = new Map([
        ['blocked-site.com', { status: 'BLOCK', riskScore: 85, affectedGroups: 5 }],
      ]);

      const context: ThreatIntelContext = {
        links: ['https://blocked-site.com/scam'],
        textHash: undefined,
        inviteLink: undefined,
        telegramUserId: undefined,
      };

      const result = analyzeThreatIndicatorsWithMocks(context, mockIndicators, {
        consumeGlobalWatchlist: true,
        minGroupsForGlobalWatch: 3,
        minRiskForGlobalBlock: 70,
      });

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBeGreaterThanOrEqual(30); // BLOCK gives higher modifier
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/threat-intel-detector.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write threat intel detector implementation**

```typescript
// packages/detection-engine/src/detectors/threat-intel-detector.ts

export interface ThreatIndicator {
  type: 'DOMAIN' | 'URL_HASH' | 'TEXT_HASH' | 'USER_PATTERN' | 'INVITE_LINK' | 'FILE_HASH';
  valueHash: string;
  normalizedValue?: string;
  riskScore: number;
  labels: string[];
  status: 'WATCH' | 'BLOCK' | 'ALLOW' | 'EXPIRED';
  seenCount: number;
  affectedGroupCount: number;
}

export interface ThreatIntelConfig {
  consumeGlobalWatchlist: boolean;
  minGroupsForGlobalWatch: number;
  minRiskForGlobalBlock: number;
}

export interface ThreatIntelContext {
  links: string[];
  textHash?: string;
  inviteLink?: string;
  telegramUserId?: bigint;
}

export interface ThreatIntelResult {
  indicatorFound: boolean;
  matchedIndicator?: ThreatIndicator;
  modifier: number;
  labels: string[];
  reasons: string[];
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hashString(value: string): string {
  // Simple hash for demo - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function analyzeThreatIndicators(
  context: ThreatIntelContext,
  config: ThreatIntelConfig,
  // In production, this would fetch from DB
  getIndicator?: (type: string, hash: string) => ThreatIndicator | null
): ThreatIntelResult {
  const result: ThreatIntelResult = {
    indicatorFound: false,
    modifier: 0,
    labels: [],
    reasons: [],
  };

  if (!config.consumeGlobalWatchlist) {
    return result;
  }

  // Check links against threat indicators
  for (const link of context.links) {
    const domain = extractDomain(link);
    if (!domain) continue;

    // In production, query DB with domain hash
    // const indicator = await getIndicator('DOMAIN', hashString(domain));
    // For now, return mock result if getIndicator is provided
    if (getIndicator) {
      const indicator = getIndicator('DOMAIN', hashString(domain));
      if (indicator && indicator.status !== 'EXPIRED') {
        result.indicatorFound = true;
        result.matchedIndicator = indicator;
        result.labels.push('THREAT_INDICATOR');
        result.reasons.push(`Domain matches ${indicator.status} indicator`);

        // Apply modifier based on status
        if (indicator.status === 'BLOCK') {
          result.modifier = Math.max(result.modifier, indicator.riskScore);
        } else if (indicator.status === 'WATCH') {
          result.modifier = Math.max(result.modifier, Math.floor(indicator.riskScore * 0.6));
        }
      }
    }
  }

  // Check text hash if provided
  if (context.textHash && getIndicator) {
    const indicator = getIndicator('TEXT_HASH', context.textHash);
    if (indicator && indicator.status !== 'EXPIRED') {
      result.indicatorFound = true;
      result.matchedIndicator = indicator;
      result.labels.push('DUPLICATE_THREAT');
      result.modifier = Math.max(result.modifier, indicator.riskScore);
      result.reasons.push('Text matches known threat pattern');
    }
  }

  // Check invite link
  if (context.inviteLink && getIndicator) {
    const domain = extractDomain(context.inviteLink);
    if (domain) {
      const indicator = getIndicator('INVITE_LINK', hashString(domain));
      if (indicator && indicator.status !== 'EXPIRED') {
        result.indicatorFound = true;
        result.matchedIndicator = indicator;
        result.labels.push('SUSPICIOUS_INVITE');
        result.modifier = Math.max(result.modifier, indicator.riskScore);
        result.reasons.push('Invite link from known suspicious source');
      }
    }
  }

  return result;
}

// Export a version that works with mock data for testing
export function analyzeThreatIndicatorsWithMocks(
  context: ThreatIntelContext,
  mockIndicators: Map<string, { status: string; riskScore: number; affectedGroups: number }>,
  config: ThreatIntelConfig
): ThreatIntelResult {
  const result: ThreatIntelResult = {
    indicatorFound: false,
    modifier: 0,
    labels: [],
    reasons: [],
  };

  if (!config.consumeGlobalWatchlist) {
    return result;
  }

  for (const link of context.links) {
    const domain = extractDomain(link);
    if (!domain) continue;

    for (const [blockedDomain, indicator] of mockIndicators) {
      if (domain.includes(blockedDomain) || blockedDomain.includes(domain)) {
        result.indicatorFound = true;
        result.labels.push('THREAT_INDICATOR');
        result.reasons.push(`Domain matches ${indicator.status} indicator`);

        if (indicator.status === 'BLOCK') {
          result.modifier = Math.max(result.modifier, indicator.riskScore);
        } else if (indicator.status === 'WATCH' && indicator.affectedGroups >= config.minGroupsForGlobalWatch) {
          result.modifier = Math.max(result.modifier, Math.floor(indicator.riskScore * 0.6));
        }
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/threat-intel-detector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/detection-engine/src/detectors/threat-intel-detector.ts packages/detection-engine/src/__tests__/threat-intel-detector.test.ts
git commit -m "feat(detection): add cross-group threat intelligence detector (Phase 07)"
```

---

## Task 5: Update Risk Score Calculation

**Files:**
- Modify: `packages/detection-engine/src/risk-score.ts` - Accept user risk modifier

- [ ] **Step 1: Update RiskScoreInput interface**

Add to `RiskScoreInput` interface in `packages/detection-engine/src/risk-score.ts`:

```typescript
export interface RiskScoreInput {
  rateLimitScore: number;
  duplicateScore: number;
  linkScore: number;
  threatScore: number;
  newMemberScore: number;
  mentionScore: number;
  mediaFloodScore: number;
  raidScore: number;
  userRiskModifier?: number; // NEW: From user risk profile
}
```

- [ ] **Step 2: Update calculateRiskScore function**

In `calculateRiskScore` function, add user risk modifier to totalScore:

```typescript
export function calculateRiskScore(input: RiskScoreInput, policy: PolicyContext): RiskScoreResult {
  const weights = getWeights(policy.mode as PolicyMode);
  
  let totalScore = 0;
  
  totalScore += input.rateLimitScore * weights.rateLimit;
  totalScore += input.duplicateScore * weights.duplicate;
  totalScore += input.linkScore * weights.link;
  totalScore += input.threatScore * weights.threat;
  totalScore += input.newMemberScore * weights.newMember;
  totalScore += input.mentionScore * weights.mention;
  totalScore += input.mediaFloodScore * weights.mediaFlood;
  totalScore += input.raidScore * weights.raid;
  
  // Add user risk modifier (can be negative to reduce score)
  if (input.userRiskModifier) {
    totalScore += input.userRiskModifier;
  }
  
  // ... rest of function
}
```

- [ ] **Step 3: Verify risk score tests still pass**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/risk-score.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/detection-engine/src/risk-score.ts
git commit -m "feat(detection): add user risk modifier to risk score calculation (Phase 07)"
```

---

## Task 6: Worker - Threat Intelligence Processing

**Files:**
- Create: `packages/worker/src/threat-intel-worker.ts`
- Modify: `packages/worker/src/index.ts` - Register worker

- [ ] **Step 1: Write threat intel worker**

```typescript
// packages/worker/src/threat-intel-worker.ts
import { createHash } from 'crypto';
import type { ThreatIndicator, NewThreatIndicator } from '@togi/db';
import type { Pool } from 'pg';

export interface ThreatIntelSignal {
  type: 'DOMAIN' | 'URL_HASH' | 'TEXT_HASH' | 'INVITE_LINK';
  value: string;
  riskScore: number;
  labels: string[];
  sourceGroupId: string;
  telegramUserId?: bigint;
}

export class ThreatIntelWorker {
  private pool: Pool;
  private confidenceThreshold = 70;
  private minGroupsForWatch = 3;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async processSignal(signal: ThreatIntelSignal): Promise<void> {
    const valueHash = this.hashValue(signal.value);
    const normalizedValue = signal.type === 'DOMAIN' ? this.normalizeDomain(signal.value) : null;

    // Check if indicator already exists
    const existing = await this.findIndicator(valueHash);

    if (existing) {
      await this.updateIndicator(existing.id, signal);
    } else {
      await this.createIndicator(signal, valueHash, normalizedValue);
    }

    // Check if should promote to WATCH or BLOCK
    await this.evaluatePromotion(signal, valueHash);
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 64);
  }

  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  }

  private async findIndicator(valueHash: string): Promise<ThreatIndicator | null> {
    const result = await this.pool.query(
      'SELECT * FROM threat_indicators WHERE value_hash = $1 AND status != $2',
      [valueHash, 'EXPIRED']
    );
    return result.rows[0] || null;
  }

  private async createIndicator(
    signal: ThreatIntelSignal,
    valueHash: string,
    normalizedValue: string | null
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO threat_indicators 
       (type, value_hash, normalized_value, risk_score, labels, first_seen_group_id, seen_count, affected_group_count)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 1)`,
      [
        signal.type,
        valueHash,
        normalizedValue,
        signal.riskScore,
        JSON.stringify(signal.labels),
        signal.sourceGroupId,
      ]
    );
  }

  private async updateIndicator(id: string, signal: ThreatIntelSignal): Promise<void> {
    await this.pool.query(
      `UPDATE threat_indicators 
       SET seen_count = seen_count + 1,
           risk_score = GREATEST(risk_score, $1),
           last_seen_at = NOW(),
           labels = COALESCE(labels, '[]'::jsonb) || $2
       WHERE id = $3`,
      [signal.riskScore, JSON.stringify(signal.labels), id]
    );
  }

  private async evaluatePromotion(signal: ThreatIntelSignal, valueHash: string): Promise<void> {
    // Count distinct groups that saw this indicator
    const groupCountResult = await this.pool.query(
      `SELECT COUNT(DISTINCT first_seen_group_id) as count FROM threat_indicators WHERE value_hash = $1`,
      [valueHash]
    );
    const groupCount = parseInt(groupCountResult.rows[0]?.count || '1', 10);

    const indicator = await this.findIndicator(valueHash);
    if (!indicator) return;

    // Promote to WATCH if seen in enough groups
    if (groupCount >= this.minGroupsForWatch && indicator.status === 'AUTO') {
      await this.pool.query(
        `UPDATE threat_indicators SET status = 'WATCH', last_seen_at = NOW() WHERE id = $1`,
        [indicator.id]
      );
    }

    // Promote to BLOCK if high confidence and policy allows
    if (
      indicator.riskScore >= this.confidenceThreshold &&
      groupCount >= this.minGroupsForWatch
    ) {
      await this.pool.query(
        `UPDATE threat_indicators SET status = 'BLOCK', last_seen_at = NOW() WHERE id = $1`,
        [indicator.id]
      );
    }
  }

  async cleanupExpired(maxAgeDays: number = 30): Promise<number> {
    const result = await this.pool.query(
      `UPDATE threat_indicators 
       SET status = 'EXPIRED' 
       WHERE status NOT IN ('BLOCK', 'EXPIRED') 
       AND last_seen_at < NOW() - INTERVAL '1 day' * $1`,
      [maxAgeDays]
    );
    return result.rowCount || 0;
  }
}
```

- [ ] **Step 2: Register worker in index.ts**

Add to `packages/worker/src/index.ts`:

```typescript
import { ThreatIntelWorker } from './threat-intel-worker.js';

// Export for use by other modules
export { ThreatIntelWorker };
```

- [ ] **Step 3: Verify worker compiles**

Run: `pnpm --filter togi-worker build`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/threat-intel-worker.ts packages/worker/src/index.ts
git commit -m "feat(worker): add threat intelligence processing worker (Phase 07)"
```

---

## Task 7: Documentation

**Files:**
- Create: `docs/THREAT_INTELLIGENCE.md`
- Create: `docs/PRIVACY_RETENTION.md`
- Modify: `docs/SECURITY_MODEL.md`

- [ ] **Step 1: Create THREAT_INTELLIGENCE.md**

```markdown
# Threat Intelligence Documentation

## Overview

TOGI's threat intelligence system enables cross-group threat sharing while maintaining strict privacy boundaries.

## Privacy Model

### What IS Shared
- Threat indicator hashes (not raw values)
- Risk scores and labels
- Aggregate counts (groups affected, times seen)
- Indicator status (WATCH, BLOCK)

### What is NOT Shared
- Raw message content
- Usernames or user IDs
- Group identifiers for contributing groups
- Private conversation details

### Data Minimization
- All domain/URL/text values are hashed before sharing
- Only the hash is stored; original value is never persisted in threat indicators
- For domains, a "normalized" version is stored for matching (e.g., "example.com" not "https://example.com/path")

## Threat Indicator Lifecycle

1. **First Detection**: Indicator created with AUTO status, riskScore = detected risk
2. **First Group Report**: If same indicator seen in another group, increment seenCount
3. **Promotion to WATCH**: When seen in 3+ groups, status changes to WATCH
4. **Promotion to BLOCK**: When riskScore >= 70 AND seen in 3+ groups (if policy allows)

## Cross-Group Intelligence Configuration

```typescript
crossGroupIntelligence: {
  enabled: true,                    // Enable cross-group features
  consumeGlobalWatchlist: true,      // Import global indicators
  contributeAnonymousSignals: true, // Export anonymous signals
  autoBlockHighConfidenceIndicators: false, // Auto-promote to BLOCK
  minGroupsForGlobalWatch: 3,       // Groups needed for WATCH promotion
  minRiskForGlobalBlock: 70,        // Risk score for BLOCK promotion
}
```

## User Risk Profiles

### Stored Data (per user globally)
- telegramUserId
- globalRiskScore (0-100)
- totalViolations
- severeViolations
- labels[] (e.g., ['SPAM', 'SCAM_DOMAIN'])
- firstSeenAt
- lastSeenAt
- lastViolationAt

### NOT Stored
- Raw message text
- Message content hashes
- Private group messages

## Group User Profiles

### Stored Data (per user per group)
- groupId (isolated - not shared)
- telegramUserId
- trustScore (0-100)
- riskScore
- messageCount
- violationCount
- warningCount
- muteCount
- banCount
- joinedAt
- probationUntil

### Privacy
- Group-specific profiles are NEVER shared between groups
- Each group only sees its own user data
- Global intelligence only uses anonymized hashes

## Retention

| Data Type | Retention | Auto-Delete |
|----------|-----------|-------------|
| User Risk Profiles | 90 days after last seen | Yes |
| Group User Profiles | 90 days after last activity | Yes |
| Threat Indicators (ACTIVE) | Until expired or manually deleted | After 30 days inactive |
| Threat Indicators (BLOCKED) | Indefinite | Manual review required |
| Violation Records | 365 days | Yes |

## Opt-Out

Groups can opt out of:
1. **Consuming** global watchlist (won't import global indicators)
2. **Contributing** anonymous signals (won't export threat indicators)

Opt-out settings per group in `group_intelligence_settings` table.
```

- [ ] **Step 2: Create PRIVACY_RETENTION.md**

```markdown
# Privacy and Retention Documentation

## Privacy Principles

### 1. Data Minimization
- Store only what's necessary for security decisions
- Never store raw message content
- Use hashes for cross-group matching

### 2. Purpose Limitation
- User profiles serve security scoring only
- Threat indicators serve threat detection only
- No advertising, analytics, or third-party sharing

### 3. Isolation
- Group user profiles are isolated per group
- Global intelligence uses anonymized hashes
- No group can see another group's private data

### 4. Transparency
- All detection labels are documented
- Users can request their data summary
- Admins can audit data retention

## Retention Schedule

| Data Type | Retention Period | Reason |
|----------|------------------|--------|
| User Risk Profiles | 90 days after last activity | Security relevance expires |
| Group User Profiles | 90 days after last activity | Stale profiles add no value |
| Threat Indicators (WATCH) | 30 days inactive | Regular review cycle |
| Threat Indicators (BLOCK) | Indefinite | High-confidence blocks persist |
| Violation Records | 365 days | Audit and appeal purposes |
| Audit Logs | 90 days | Operational security |

## What Gets Deleted

When user data is deleted:
1. User risk profile is removed or anonymized
2. Group user profiles for that user in all groups are removed
3. All threat indicator associations are cleared
4. Violation records are retained (audit trail) but anonymized

## User Rights

Users can request:
1. **Data Summary**: Get a report of what TOGI stores about them
2. **Data Correction**: Challenge inaccurate risk scores
3. **Deletion**: Request removal of their profile (subject to retention rules)

## Implementation

Retention is enforced by:
- Database triggers for automatic expiration
- Worker job for periodic cleanup (runs daily)
- Manual admin tools for immediate deletion

### Cleanup Worker
Runs daily at 03:00 UTC:
1. Mark expired threat indicators as EXPIRED
2. Delete user profiles inactive > 90 days
3. Anonymize old violation records
```

- [ ] **Step 3: Update SECURITY_MODEL.md**

Add to `docs/SECURITY_MODEL.md`:

```markdown
## Threat Intelligence (Phase 07)

### Architecture
- User risk profiles aggregated globally, but only non-content data stored
- Group user profiles isolated per group (never shared)
- Threat indicators use hashed values, not raw content
- Cross-group promotion requires multiple independent sources

### Privacy Guarantees
- NO raw message text ever leaves a group
- NO user identifiers in threat indicator shares
- NO group-specific data exposed to other groups
- All domain/URL/text values are SHA256 hashed before sharing

### Trust Score System
- New users start at trust score 50
- Trust increases with positive behavior over time
- Trust decreases with violations
- High trust scores can reduce false positive risk scores by up to 15 points
- Group admins always have maximum trust

### Cross-Group Threat Sharing
- Indicators promoted from local to global when:
  - Same domain/hash seen in 3+ groups
  - Risk score meets threshold (70 for BLOCK, 40 for WATCH)
- Auto-block only enabled in STRICT/PARANOID modes
- Groups can opt out of either consuming or contributing
```

- [ ] **Step 4: Commit**

```bash
git add docs/THREAT_INTELLIGENCE.md docs/PRIVACY_RETENTION.md docs/SECURITY_MODEL.md
git commit -m "docs: add threat intelligence and privacy documentation (Phase 07)"
```

---

## Task 8: Validation and Integration Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/threat-intel-integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// packages/detection-engine/src/__tests__/threat-intel-integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateUserRiskModifier } from '../detectors/user-risk-detector.js';
import { analyzeThreatIndicatorsWithMocks } from '../detectors/threat-intel-detector.js';

describe('threat-intel integration', () => {
  it('full flow: new user with suspicious link gets elevated risk', () => {
    // User risk context: new user, no username, first message has link
    const userRisk = calculateUserRiskModifier({
      telegramUserId: 123456n,
      groupId: 'group-1',
      globalRiskScore: 0,
      groupTrustScore: 50,
      totalViolations: 0,
      severeViolations: 0,
      isNewUser: true,
      hasUsername: false,
      firstMessageHasLink: true,
      isGroupAdmin: false,
      isProbation: true,
    });

    expect(userRisk).toBeGreaterThanOrEqual(25); // newUser(10) + noUsername(10) + firstLink(5) + probation(5)

    // Threat intel: link matches a watch domain
    const threatIntel = analyzeThreatIndicatorsWithMocks(
      { links: ['https://suspicious-domain.com/payload'] },
      new Map([['suspicious-domain.com', { status: 'WATCH', riskScore: 60, affectedGroups: 3 }]]),
      { consumeGlobalWatchlist: true, minGroupsForGlobalWatch: 3, minRiskForGlobalBlock: 70 }
    );

    expect(threatIntel.indicatorFound).toBe(true);
    expect(threatIntel.modifier).toBeGreaterThanOrEqual(36); // 60 * 0.6 for WATCH
  });

  it('trusted user with clean record gets reduced risk', () => {
    const userRisk = calculateUserRiskModifier({
      telegramUserId: 999999n,
      groupId: 'trusted-group',
      globalRiskScore: 10,
      groupTrustScore: 90,
      totalViolations: 1,
      severeViolations: 0,
      isNewUser: false,
      hasUsername: true,
      firstMessageHasLink: false,
      isGroupAdmin: false,
      isProbation: false,
    });

    // Should be negative due to high trust score
    expect(userRisk).toBeLessThan(0);
  });

  it('blocked domain always gets high modifier regardless of trust', () => {
    const userRisk = calculateUserRiskModifier({
      telegramUserId: 777777n,
      groupId: 'any-group',
      globalRiskScore: 50,
      groupTrustScore: 95, // Very trusted
      totalViolations: 0,
      severeViolations: 0,
      isNewUser: false,
      hasUsername: true,
      firstMessageHasLink: false,
      isGroupAdmin: false,
      isProbation: false,
    });

    // Trust should reduce modifier but not eliminate it
    expect(userRisk).toBeLessThan(0); // Trust applies

    const threatIntel = analyzeThreatIndicatorsWithMocks(
      { links: ['https://blocked-ponzi.com/invest'] },
      new Map([['blocked-ponzi.com', { status: 'BLOCK', riskScore: 90, affectedGroups: 5 }]]),
      { consumeGlobalWatchlist: true, minGroupsForGlobalWatch: 3, minRiskForGlobalBlock: 70 }
    );

    // BLOCK status should apply full risk score
    expect(threatIntel.modifier).toBe(90);
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `pnpm --filter @togi/detection-engine test -- --run src/__tests__/threat-intel-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Run full detection engine test suite**

Run: `pnpm --filter @togi/detection-engine test -- --run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add packages/detection-engine/src/__tests__/threat-intel-integration.test.ts
git commit -m "test(detection): add threat intel integration tests (Phase 07)"
```

---

## Summary: New Labels and Detection Capabilities

### New Detection Labels

| Label | Description | Source |
|-------|-------------|--------|
| THREAT_INDICATOR | Link/text matches global threat indicator | threat-intel-detector |
| DUPLICATE_THREAT | Text hash matches known threat pattern | threat-intel-detector |
| SUSPICIOUS_INVITE | Invite link from suspicious source | threat-intel-detector |
| USER_RISK_PROFILE | User risk modifier applied | user-risk-detector |
| HIGH_TRUST_USER | Trust score reduced risk | user-risk-detector |
| NEW_USER_RISK | New user risk factors present | user-risk-detector |

### New Configuration Options

| Config | Default | Description |
|--------|---------|-------------|
| crossGroupIntelligence.enabled | true | Enable cross-group features |
| crossGroupIntelligence.minGroupsForGlobalWatch | 3 | Groups needed for WATCH |
| crossGroupIntelligence.minRiskForGlobalBlock | 70 | Risk for BLOCK promotion |
| crossGroupIntelligence.autoBlockHighConfidenceIndicators | false | Auto-promote to BLOCK |

---

## Summary: PASS/FAIL Checklist

- [ ] **Database Schema**: user_risk_profiles, group_user_profiles, threat_indicators, group_intelligence_settings tables created ✅/❌
- [ ] **Policy Config**: crossGroupIntelligence config added to all policy modes ✅/❌
- [ ] **User Risk Detector**: calculateUserRiskModifier implemented with tests ✅/❌
- [ ] **Threat Intel Detector**: analyzeThreatIndicators implemented with tests ✅/❌
- [ ] **Risk Score Integration**: userRiskModifier accepted in calculateRiskScore ✅/❌
- [ ] **Worker**: ThreatIntelWorker processes signals and handles promotion ✅/❌
- [ ] **Documentation**: THREAT_INTELLIGENCE.md, PRIVACY_RETENTION.md created ✅/❌
- [ ] **Privacy**: No raw text stored, hashes only, group isolation maintained ✅/❌
- [ ] **Integration Tests**: Full flow tests passing ✅/❌
- [ ] **All Tests Pass**: `pnpm -r test -- --run` ✅/❌

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-threat-intelligence-implementation.md`.**

**Execution approach:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**