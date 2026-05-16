# Phase 03: Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build comprehensive test coverage for TOGI's core security system — detection engine, policy engine, action executor, and worker processors — using Vitest with Testcontainers for DB tests and mocked Redis/Telegram API layers.

**Architecture:** Test utilities package provides factory functions and mocked infrastructure. Detection engine tests focus on pure functions (text normalization, risk scoring, decision thresholds). Worker tests use mocked BullMQ queues. Action executor tests mock the Telegram Bot API. API tests use Fastify injection.

**Tech Stack:** Vitest, Testcontainers (PostgreSQL), ioredis-mock, Telegram API mock layer, Factory pattern for test fixtures.

---

## File Structure

```
packages/test-utils/
├── src/
│   ├── index.ts                       # Re-exports all utilities
│   ├── factories/
│   │   ├── detection-context.ts       # DetectionContext factory
│   │   ├── policy-context.ts         # PolicyContext/PolicyConfig factory
│   │   ├── detection-result.ts        # DetectionResult factory
│   │   └── index.ts
│   ├── mocks/
│   │   ├── redis-mock.ts              # ioredis-mock wrapper with helpers
│   │   ├── telegram-mock.ts           # Telegram Bot API mock
│   │   └── index.ts
│   ├── test-db.ts                     # Testcontainers PostgreSQL setup
│   └── time-control.ts                # Fake timers helper
packages/detection-engine/src/
├── __tests__/
│   ├── text-normalizer.test.ts
│   ├── risk-score.test.ts
│   ├── decision-engine.test.ts
│   ├── fast-path-engine.test.ts
│   └── detectors/
│       ├── rate-limit.test.ts
│       ├── duplicate.test.ts
│       ├── link.test.ts
│       ├── threat.test.ts
│       ├── new-member.test.ts
│       ├── mention-spam.test.ts
│       ├── media-flood.test.ts
│       └── raid.test.ts
packages/policy-engine/src/
├── __tests__/
│   ├── validate-policy.test.ts
│   ├── merge-policy.test.ts
│   ├── get-default-policy.test.ts
│   └── calculate-security-score.test.ts
packages/telegram-client/src/__tests__/
├── action-executor.test.ts            # Expand existing tests
apps/worker/src/processors/__tests__/
├── async-analysis.test.ts
└── action-retry.test.ts
apps/api/src/routes/__tests__/
├── auth.test.ts
└── groups.test.ts
```

---

## Task 1: Test Utilities Package — Factories

**Files:**
- Create: `packages/test-utils/src/factories/detection-context.ts`
- Create: `packages/test-utils/src/factories/policy-context.ts`
- Create: `packages/test-utils/src/factories/detection-result.ts`
- Create: `packages/test-utils/src/factories/index.ts`
- Create: `packages/test-utils/src/index.ts`

- [ ] **Step 1: Create DetectionContext factory**

```typescript
// packages/test-utils/src/factories/detection-context.ts
import type { DetectionContext } from '@togi/detection-engine';

export function createDetectionContext(
  overrides: Partial<DetectionContext> = {}
): DetectionContext {
  const now = Date.now();
  return {
    chatId: '-1001234567890',
    userId: '123456789',
    username: 'testuser',
    text: 'Hello world',
    links: [],
    mediaType: undefined,
    messageId: 1,
    mentions: [],
    isNewUser: false,
    userMemberSince: undefined,
    timestamp: now,
    ...overrides,
  };
}
```

- [ ] **Step 2: Create PolicyContext factory**

```typescript
// packages/test-utils/src/factories/policy-context.ts
import type { PolicyContext, PolicyMode } from '@togi/policy-engine';
import { getDefaultPolicy } from '@togi/policy-engine';

export function createPolicyContext(
  mode: PolicyMode = 'BALANCED',
  overrides: Partial<PolicyContext> = {}
): PolicyContext {
  const config = getDefaultPolicy(mode);
  return {
    mode,
    ...config,
    ...overrides,
  };
}
```

- [ ] **Step 3: Create DetectionResult factory**

```typescript
// packages/test-utils/src/factories/detection-result.ts
import type { DetectionResult, DetectionLabel, Severity, RecommendedAction } from '@togi/detection-engine';

export function createDetectionResult(
  overrides: Partial<DetectionResult> = {}
): DetectionResult {
  return {
    riskScore: 0,
    labels: [],
    severity: 'LOW' as Severity,
    recommendedAction: 'ALLOW' as RecommendedAction,
    reasons: [],
    fastPath: true,
    ...overrides,
  };
}
```

- [ ] **Step 4: Create index files and exports**

```typescript
// packages/test-utils/src/factories/index.ts
export { createDetectionContext } from './detection-context';
export { createPolicyContext } from './policy-context';
export { createDetectionResult } from './detection-result';
```

```typescript
// packages/test-utils/src/index.ts
export * from './factories';
```

---

## Task 2: Test Utilities Package — Mocks

**Files:**
- Create: `packages/test-utils/src/mocks/redis-mock.ts`
- Create: `packages/test-utils/src/mocks/telegram-mock.ts`
- Create: `packages/test-utils/src/mocks/index.ts`
- Modify: `packages/test-utils/package.json` (add dependencies)

- [ ] **Step 1: Create Redis mock with helper methods**

```typescript
// packages/test-utils/src/mocks/redis-mock.ts
import Redis from 'ioredis-mock';

export function createMockRedis() {
  const redis = new Redis();
  return redis;
}

export function createMockRedisClient() {
  const redis = createMockRedis();
  return {
    get: redis.get.bind(redis),
    set: redis.set.bind(redis),
    del: redis.del.bind(redis),
    incr: redis.incr.bind(redis),
    expire: redis.expire.bind(redis),
    ttl: redis.ttl.bind(redis),
    lpush: redis.lpush.bind(redis),
    lrange: redis.lrange.bind(redis),
    ltrim: redis.ltrim.bind(redis),
    llen: redis.llen.bind(redis),
    hset: redis.hset.bind(redis),
    hget: redis.hget.bind(redis),
    hdel: redis.hdel.bind(redis),
    hgetall: redis.hgetall.bind(redis),
    expireat: redis.expireat.bind(redis),
    keys: redis.keys.bind(redis),
  };
}
```

- [ ] **Step 2: Create Telegram Bot API mock**

```typescript
// packages/test-utils/src/mocks/telegram-mock.ts
export interface TelegramMockOptions {
  shouldFail?: boolean;
  failWith?: { ok: false; error_code: number; description: string };
}

export function createTelegramMock(options: TelegramMockOptions = {}) {
  const { shouldFail = false, failWith = { ok: false, error_code: 429, description: 'Too Many Requests' } } = options;

  const mockApi = {
    deleteMessage: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.resolve(failWith);
      return Promise.resolve({ ok: true, result: true });
    }),
    restrictChatMember: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.resolve(failWith);
      return Promise.resolve({ ok: true, result: true });
    }),
    banChatMember: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.resolve(failWith);
      return Promise.resolve({ ok: true, result: true });
    }),
    unbanChatMember: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.resolve(failWith);
      return Promise.resolve({ ok: true, result: true });
    }),
    sendMessage: jest.fn().mockImplementation(() => {
      if (shouldFail) return Promise.resolve(failWith);
      return Promise.resolve({ ok: true, result: { message_id: 1 } });
    }),
    getChat: jest.fn().mockResolvedValue({ id: -1001234567890, type: 'supergroup' }),
    getChatMember: jest.fn().mockResolvedValue({ status: 'member', user: { id: 123456789 } }),
  };

  return mockApi;
}
```

---

## Task 3: Text Normalizer Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/text-normalizer.test.ts`

- [ ] **Step 1: Write tests for normalizeText — Turkish character normalization**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeText } from '../text-normalizer';

describe('normalizeText', () => {
  it('normalizes Turkish characters', () => {
    const result = normalizeText('ı İ ğ Ü ş Ö ç');
    expect(result.normalized).toBe('i i g u s o c');
  });

  it('normalizes leetspeak', () => {
    const result = normalizeText('h4ck3r 5p34k');
    expect(result.normalized).toBe('hacker speak');
  });

  it('removes zero-width characters', () => {
    const result = normalizeText('hello​world');
    expect(result.normalized).toBe('helloworld');
  });

  it('collapses repeated letters', () => {
    const result = normalizeText('heeeellloooo');
    expect(result.normalized).toBe('hello');
  });

  it('detects heavy obfuscation', () => {
    const result = normalizeText('h̴̵̶e̴̵̶l̴̵̶l̴̵̶o');
    expect(result.obfuscationType).toBe('heavy-obfuscation');
  });
});
```

- [ ] **Step 2: Write tests for extractWords and calculateTextSimilarity**

```typescript
  it('extracts words correctly', () => {
    const words = extractWords('Hello World! How are you?');
    expect(words).toEqual(['hello', 'world', 'how', 'are', 'you']);
  });

  it('calculates text similarity with Jaccard index', () => {
    const similarity = calculateTextSimilarity('hello world', 'hello world');
    expect(similarity).toBe(1.0);
  });

  it('returns 0 for completely different texts', () => {
    const similarity = calculateTextSimilarity('hello', 'world');
    expect(similarity).toBe(0);
  });
```

---

## Task 4: Risk Score Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/risk-score.test.ts`

- [ ] **Step 1: Write scoreToSeverity boundary tests**

```typescript
import { describe, it, expect } from 'vitest';
import { scoreToSeverity } from '../risk-score';

describe('scoreToSeverity', () => {
  it('returns LOW for scores 0-29', () => {
    expect(scoreToSeverity(0)).toBe('LOW');
    expect(scoreToSeverity(15)).toBe('LOW');
    expect(scoreToSeverity(29)).toBe('LOW');
  });

  it('returns MEDIUM for scores 30-49', () => {
    expect(scoreToSeverity(30)).toBe('MEDIUM');
    expect(scoreToSeverity(40)).toBe('MEDIUM');
    expect(scoreToSeverity(49)).toBe('MEDIUM');
  });

  it('returns HIGH for scores 50-69', () => {
    expect(scoreToSeverity(50)).toBe('HIGH');
    expect(scoreToSeverity(60)).toBe('HIGH');
    expect(scoreToSeverity(69)).toBe('HIGH');
  });

  it('returns CRITICAL for scores 70+', () => {
    expect(scoreToSeverity(70)).toBe('CRITICAL');
    expect(scoreToSeverity(85)).toBe('CRITICAL');
    expect(scoreToSeverity(100)).toBe('CRITICAL');
  });
});
```

- [ ] **Step 2: Write calculateRiskScore component tests**

```typescript
describe('calculateRiskScore', () => {
  it('caps total score at 100', () => {
    const input = {
      rateLimitScore: 60,
      duplicateScore: 60,
      linkScore: 60,
      threatScore: 60,
      newMemberScore: 60,
      mentionScore: 60,
      mediaFloodScore: 60,
      raidScore: 60,
    };
    const policy = createPolicyContext('BALANCED');
    const result = calculateRiskScore(input, policy);
    expect(result.totalScore).toBe(100);
  });

  it('returns zero score for clean input', () => {
    const input = {
      rateLimitScore: 0,
      duplicateScore: 0,
      linkScore: 0,
      threatScore: 0,
      newMemberScore: 0,
      mentionScore: 0,
      mediaFloodScore: 0,
      raidScore: 0,
    };
    const policy = createPolicyContext('BALANCED');
    const result = calculateRiskScore(input, policy);
    expect(result.totalScore).toBe(0);
  });
});
```

---

## Task 5: Decision Engine Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/decision-engine.test.ts`

- [ ] **Step 1: Write determineAction threshold tests**

```typescript
import { describe, it, expect } from 'vitest';
import { determineAction, getThresholdsForMode } from '../decision-engine';

describe('determineAction', () => {
  const modes: PolicyMode[] = ['RELAXED', 'BALANCED', 'STRICT', 'PARANOID'];

  modes.forEach((mode) => {
    describe(`${mode} mode`, () => {
      it('returns ALLOW for score 0', () => {
        expect(determineAction(0, mode)).toBe('ALLOW');
      });
    });
  });

  it('scales action with score', () => {
    const relaxed = determineAction(30, 'RELAXED');
    const paranoid = determineAction(30, 'PARANOID');
    // PARANOID should be more aggressive
    const actionOrder = ['ALLOW', 'LOG', 'WARN', 'DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'];
    expect(actionOrder.indexOf(paranoid)).toBeGreaterThanOrEqual(actionOrder.indexOf(relaxed));
  });
});
```

- [ ] **Step 2: Write mergeDetectionResults tests**

```typescript
describe('mergeDetectionResults', () => {
  it('deduplicates labels', () => {
    const results = [
      createDetectionResult({ labels: ['SPAM', 'FLOOD'] }),
      createDetectionResult({ labels: ['SPAM', 'LINK'] }),
    ];
    const merged = mergeDetectionResults(results);
    expect(merged.labels).toHaveLength(3);
    expect(merged.labels).toContain('SPAM');
    expect(merged.labels).toContain('FLOOD');
    expect(merged.labels).toContain('LINK');
  });

  it('caps risk score at 100', () => {
    const results = [
      createDetectionResult({ riskScore: 80 }),
      createDetectionResult({ riskScore: 80 }),
    ];
    const merged = mergeDetectionResults(results);
    expect(merged.riskScore).toBe(100);
  });

  it('takes most severe action', () => {
    const results = [
      createDetectionResult({ recommendedAction: 'ALLOW' }),
      createDetectionResult({ recommendedAction: 'DELETE_BAN' }),
    ];
    const merged = mergeDetectionResults(results);
    expect(merged.recommendedAction).toBe('DELETE_BAN');
  });
});
```

---

## Task 6: Duplicate Detector Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/detectors/duplicate.test.ts`

- [ ] **Step 1: Write duplicate detection tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDetectionContext, createMockRedisClient } from '@togi/test-utils';
import { checkDuplicate } from '../detectors/duplicate-detector';

describe('checkDuplicate', () => {
  let mockRedis: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
  });

  it('returns no duplicate for first message', async () => {
    const context = createDetectionContext({ text: 'Hello world' });
    const result = await checkDuplicate(context.chatId, context.userId!, context.text, context.messageId!, undefined, mockRedis);
    expect(result.isDuplicate).toBe(false);
    expect(result.score).toBe(0);
  });

  it('detects duplicate text', async () => {
    const chatId = '-1001234567890';
    const userId = '123456789';
    const text = 'Hello duplicate';
    const mockRedis = createMockRedisClient();

    // First message
    await checkDuplicate(chatId, userId, text, 1, undefined, mockRedis);
    // Second identical message
    const result = await checkDuplicate(chatId, userId, text, 2, undefined, mockRedis);
    expect(result.isDuplicate).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('allows similar but not identical text', async () => {
    const context = createDetectionContext({ text: 'Hello world' });
    const mockRedis = createMockRedisClient();
    await checkDuplicate(context.chatId, context.userId!, context.text, 1, undefined, mockRedis);
    const result = await checkDuplicate(context.chatId, context.userId!, 'Hello world!', 2, undefined, mockRedis);
    expect(result.isDuplicate).toBe(false);
  });
});
```

---

## Task 7: Link Detector Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/detectors/link.test.ts`

- [ ] **Step 1: Write link analysis tests**

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeLinks, linkToDetection } from '../detectors/link-detector';
import { createPolicyContext } from '@togi/test-utils';

describe('analyzeLinks', () => {
  const policy = createPolicyContext('BALANCED');

  it('detects shortener links', () => {
    const result = analyzeLinks(['https://bit.ly/abc123'], '123', false, [], [], policy.linkProtection);
    expect(result.hasLink).toBe(true);
    expect(result.hasShortener).toBe(true);
  });

  it('detects blocked domains', () => {
    const result = analyzeLinks(['https://evil.com/malware'], '123', false, [], ['evil.com'], policy.linkProtection);
    expect(result.hasBlockedDomain).toBe(true);
    expect(result.score).toBe(90);
  });

  it('scores Telegram invite links', () => {
    const result = analyzeLinks(['https://t.me/joinchat/abc'], '123', false, [], [], policy.linkProtection);
    expect(result.hasTelegramInvite).toBe(true);
    expect(result.score).toBe(20);
  });

  it('applies higher score for new users with links', () => {
    const result = analyzeLinks(['https://example.com'], '123', true, [], [], policy.linkProtection);
    expect(result.score).toBeGreaterThan(30);
  });
});
```

---

## Task 8: Threat Detector Tests

**Files:**
- Create: `packages/detection-engine/src/__tests__/detectors/threat.test.ts`

- [ ] **Step 1: Write threat detection tests**

```typescript
import { describe, it, expect } from 'vitest';
import { checkThreat, threatToDetection } from '../detectors/threat-detector';

describe('checkThreat', () => {
  it('detects doxxing patterns', () => {
    const result = checkThreat('I will dox you. Your address is 123 Main St.');
    expect(result.hasDoxxing).toBe(true);
    expect(result.doxxingScore).toBe(80);
  });

  it('detects threat patterns', () => {
    const result = checkThreat('I will kill you');
    expect(result.hasThreat).toBe(true);
    expect(result.threatScore).toBe(75);
  });

  it('detects harassment', () => {
    const result = checkThreat('You are stupid and ugly go die');
    expect(result.hasHarassment).toBe(true);
  });

  it('returns clean for normal text', () => {
    const result = checkThreat('Hello, how are you today?');
    expect(result.hasThreat).toBe(false);
    expect(result.hasDoxxing).toBe(false);
    expect(result.hasHarassment).toBe(false);
    expect(result.score).toBe(0);
  });
});
```

---

## Task 9: Policy Engine Tests

**Files:**
- Create: `packages/policy-engine/src/__tests__/validate-policy.test.ts`
- Create: `packages/policy-engine/src/__tests__/merge-policy.test.ts`
- Create: `packages/policy-engine/src/__tests__/calculate-security-score.test.ts`

- [ ] **Step 1: Write validatePolicyConfig tests**

```typescript
import { describe, it, expect } from 'vitest';
import { validatePolicyConfig, getDefaultPolicy, mergePolicy } from '@togi/policy-engine';

describe('validatePolicyConfig', () => {
  it('validates a correct config', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('rejects invalid flood protection', () => {
    const config = {
      ...getDefaultPolicy('BALANCED'),
      floodProtection: { enabled: 'yes' } as any,
    };
    expect(validatePolicyConfig(config)).toBe(false);
  });

  it('rejects negative thresholds', () => {
    const config = {
      ...getDefaultPolicy('BALANCED'),
      floodProtection: { ...getDefaultPolicy('BALANCED').floodProtection, maxMessagesShortWindow: -1 },
    };
    expect(validatePolicyConfig(config)).toBe(false);
  });
});

describe('mergePolicy', () => {
  it('deep merges nested objects', () => {
    const base = getDefaultPolicy('BALANCED');
    const custom = {
      floodProtection: { maxMessagesShortWindow: 3 },
    };
    const merged = mergePolicy(base, custom);
    expect(merged.floodProtection.maxMessagesShortWindow).toBe(3);
    expect(merged.floodProtection.enabled).toBe(base.floodProtection.enabled);
  });
});
```

- [ ] **Step 2: Write calculateSecurityScore tests**

```typescript
describe('calculateSecurityScore', () => {
  it('returns 100 when fully configured with admin permissions', () => {
    const permissions = {
      canDeleteMessages: true,
      canRestrictMembers: true,
      canChangeInfo: true,
      canInviteUsers: true,
      canPinMessages: true,
      canPromoteMembers: true,
      canManageVideoChats: true,
      isAdmin: true,
      status: 'ADMIN' as const,
    };
    const policy = getDefaultPolicy('STRICT');
    const score = calculateSecurityScore(permissions, policy, true, true, true);
    expect(score.totalScore).toBe(100);
  });

  it('returns low score when bot is not admin', () => {
    const permissions = {
      canDeleteMessages: false,
      canRestrictMembers: false,
      canChangeInfo: false,
      canInviteUsers: false,
      canPinMessages: false,
      canPromoteMembers: false,
      canManageVideoChats: false,
      isAdmin: false,
      status: 'NOT_ADMIN' as const,
    };
    const score = calculateSecurityScore(permissions, getDefaultPolicy('STRICT'), false, false, false);
    expect(score.totalScore).toBeLessThan(40);
  });
});
```

---

## Task 10: Action Executor Tests

**Files:**
- Modify: `packages/telegram-client/src/__tests__/action-executor.test.ts`

- [ ] **Step 1: Expand existing action executor tests with admin protection**

```typescript
describe('warnUser', () => {
  it('warns user successfully', async () => {
    mockBot.api.sendMessage.mockResolvedValue({ ok: true, result: { message_id: 1 } });
    const result = await executor.warnUser({ chatId: '-1001234567890', userId: '123456789', reason: 'Spam' });
    expect(result.ok).toBe(true);
  });

  it('does not warn admins', async () => {
    mockBot.api.getChatMember.mockResolvedValue({ status: 'administrator', user: { id: '123456789' } });
    const result = await executor.warnUser({ chatId: '-1001234567890', userId: '123456789', reason: 'Spam' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(403);
  });
});

describe('executeDecision', () => {
  it('executes DELETE action', async () => {
    mockBot.api.deleteMessage.mockResolvedValue({ ok: true, result: true });
    const result = await executor.executeDecision({
      chatId: '-1001234567890',
      userId: '123456789',
      action: 'DELETE',
      messageId: 1,
    });
    expect(result.ok).toBe(true);
    expect(mockBot.api.deleteMessage).toHaveBeenCalled();
  });

  it('executes DELETE_BAN action', async () => {
    mockBot.api.banChatMember.mockResolvedValue({ ok: true, result: true });
    mockBot.api.deleteMessage.mockResolvedValue({ ok: true, result: true });
    const result = await executor.executeDecision({
      chatId: '-1001234567890',
      userId: '123456789',
      action: 'DELETE_BAN',
      messageId: 1,
    });
    expect(result.ok).toBe(true);
  });

  it('returns REVIEW for unknown action', async () => {
    const result = await executor.executeDecision({
      chatId: '-1001234567890',
      userId: '123456789',
      action: 'REVIEW' as any,
      messageId: 1,
    });
    expect(result.action).toBe('REVIEW');
  });
});
```

- [ ] **Step 2: Add idempotency and error handling tests**

```typescript
describe('idempotency', () => {
  it('handles already-deleted message gracefully', async () => {
    mockBot.api.deleteMessage.mockResolvedValue({ ok: false, error_code: 400, description: 'Bad Request: message to delete not found' });
    const result = await executor.deleteMessage({ chatId: '-1001234567890', messageId: 999 });
    expect(result.ok).toBe(true); // Idempotent - already gone
  });

  it('retries on rate limit error', async () => {
    mockBot.api.deleteMessage
      .mockResolvedValueOnce({ ok: false, error_code: 429, description: 'Too Many Requests' })
      .mockResolvedValueOnce({ ok: true, result: true });
    const result = await executor.deleteMessage({ chatId: '-1001234567890', messageId: 1 });
    expect(result.ok).toBe(true);
    expect(mockBot.api.deleteMessage).toHaveBeenCalledTimes(2);
  });
});
```

---

## Task 11: API Route Tests

**Files:**
- Create: `apps/api/src/routes/__tests__/groups.test.ts`

- [ ] **Step 1: Write groups API tests with auth and RBAC**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server';

describe('Groups API', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    // Get tokens from auth endpoints
    adminToken = await getTokenForRole('admin');
    viewerToken = await getTokenForRole('viewer');
  });

  afterAll(() => app.close());

  describe('GET /api/groups/:id/policy', () => {
    it('returns policy for valid group', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/test-group-1/policy',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.policy).toBeDefined();
      expect(body.policy.mode).toBeDefined();
    });

    it('rejects viewer with only policy:read', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups/test-group-1/policy',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(response.statusCode).toBe(200); // Viewer has policy:read
    });
  });

  describe('PATCH /api/groups/:id/policy', () => {
    it('rejects viewer attempting to modify policy', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/groups/test-group-1/policy',
        headers: { authorization: `Bearer ${viewerToken}`, 'x-csrf-token': 'valid-csrf' },
        payload: { mode: 'STRICT' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('accepts valid policy update from admin', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/groups/test-group-1/policy',
        headers: { authorization: `Bearer ${adminToken}`, 'x-csrf-token': 'valid-csrf' },
        payload: { mode: 'STRICT' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects invalid policy mode', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/groups/test-group-1/policy',
        headers: { authorization: `Bearer ${adminToken}`, 'x-csrf-token': 'valid-csrf' },
        payload: { mode: 'INVALID_MODE' },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
```

---

## Task 12: Coverage Configuration and CI

**Files:**
- Create: `vitest.config.ts` (root)
- Modify: `package.json` (scripts)
- Create: `scripts/test-coverage.sh`

- [ ] **Step 1: Create Vitest configuration**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 70,
        lines: 60,
      },
      include: [
        'packages/detection-engine/src/**/*.ts',
        'packages/policy-engine/src/**/*.ts',
        'packages/telegram-client/src/action-executor.ts',
        'apps/worker/src/processors/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/types.ts',
      ],
    },
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
    ],
  },
});
```

- [ ] **Step 2: Add test scripts to package.json**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## Validation Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific package tests
npx vitest run packages/detection-engine/src/__tests__/

# Check coverage thresholds
npx vitest run --coverage
```

---

## Coverage Targets

| Package | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| detection-engine | 80% | 80% | 80% | 70% |
| policy-engine | 80% | 80% | 80% | 70% |
| telegram-client | 70% | 70% | 70% | 60% |
| worker | 60% | 60% | 60% | 50% |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-test-coverage-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**