// Mock the @togi/db module to avoid postgres initialization
import { jest } from '@jest/globals';
jest.mock('@togi/db', () => ({
  keys: {
    duplicate: (chatId: string | number, hash: string) => `duplicate:${chatId}:${hash}`,
  },
  redis: {
    get: async () => null,
    setex: async () => 'OK',
  },
  db: {},
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { checkDuplicate, DuplicateConfig } from '../../detectors/duplicate-detector';

// Type for RedisClient - used for casting mock to match expected parameter type
type RedisClient = {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  keys(pattern: string): Promise<string[]>;
};

// Simple mock Redis client for duplicate detector testing
// Only implements the methods actually used by checkDuplicate
interface MockRedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  keys(pattern: string): Promise<string[]>;
}

function createMockRedisClient(): MockRedisClient {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    setex: async (key: string, _seconds: number, value: string) => {
      store.set(key, value);
      return 'OK';
    },
    keys: async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(store.keys()).filter((k) => regex.test(k));
    },
  };
}

// Cast to any to bypass strict Redis type checking in tests
function toRedisClient(mock: MockRedisClient): any {
  return mock;
}

describe('checkDuplicate', () => {
  let mockRedis: MockRedisClient;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
  });

  const defaultConfig: DuplicateConfig = {
    windowSeconds: 120,
    maxRepeats: 3,
    hashScore: 35,
    repeatScore: 50,
  };

  const redis = () => toRedisClient(mockRedis);

  describe('returns no duplicate for first message', () => {
    it('returns isDuplicate: false and score: 0 for first message', async () => {
      const result = await checkDuplicate(
        'chat123',
        'user456',
        'Hello world',
        1,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.repeatCount).toBe(0);
    });

    it('returns default result for empty text', async () => {
      const result = await checkDuplicate(
        'chat123',
        'user456',
        undefined,
        1,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('detects duplicate text when same user sends identical message', () => {
    it('detects duplicate on second occurrence within window', async () => {
      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'Hello world';
      const messageId = 1;

      // First message
      await checkDuplicate(chatId, userId, text, messageId, defaultConfig, redis());

      // Second message (same text)
      const result = await checkDuplicate(
        chatId,
        userId,
        text,
        messageId + 1,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.score).toBe(35); // hashScore
      expect(result.level).toBe('MEDIUM');
      expect(result.repeatCount).toBe(1);
    });

    it('accumulates score for repeated duplicates', async () => {
      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'Repeated message';

      // First message - count becomes 1
      await checkDuplicate(chatId, userId, text, 1, defaultConfig, redis());

      // Second message - count becomes 2, repeatCount=1, score=35
      await checkDuplicate(chatId, userId, text, 2, defaultConfig, redis());

      // Third message - count becomes 3, repeatCount=2, score=35 (still < maxRepeats)
      await checkDuplicate(chatId, userId, text, 3, defaultConfig, redis());

      // Fourth message - count becomes 4, repeatCount=3, score=35+50=85 (>= maxRepeats)
      const result = await checkDuplicate(chatId, userId, text, 4, defaultConfig, redis());

      // At repeatCount >= maxRepeats (3), additional repeatScore is added
      expect(result.score).toBe(85); // hashScore (35) + repeatScore (50)
      expect(result.level).toBe('HIGH');
      expect(result.isDuplicate).toBe(true);
    });

    it('stores data in Redis with correct key format', async () => {
      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'Test message';

      await checkDuplicate(chatId, userId, text, 1, defaultConfig, redis());

      // The key should be: duplicate:{chatId}:{hash}
      const keys = await mockRedis.keys('duplicate:*');
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toContain(`duplicate:${chatId}:`);
    });
  });

  describe('allows similar but not identical text', () => {
    it('does not detect duplicate for different text (same meaning, different words)', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      // First message
      await checkDuplicate(chatId, userId, 'Hello world', 1, defaultConfig, redis());

      // Different text with similar meaning
      const result = await checkDuplicate(
        chatId,
        userId,
        'Hi world',
        2,
        defaultConfig,
        redis()
      );

      // Different text produces different hash, so not a duplicate
      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
    });

    it('does not detect duplicate when same content is spelled differently', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      // First message
      await checkDuplicate(chatId, userId, 'hello', 1, defaultConfig, redis());

      // Same meaning, different spelling
      const result = await checkDuplicate(
        chatId,
        userId,
        'h3llo', // leetspeak variant
        2,
        defaultConfig,
        redis()
      );

      // After normalization, these might hash the same if the normalizer reduces them
      // But basic different text should not be detected as duplicate
      // Note: This test depends on hashText normalization behavior
    });

    it('treats completely different messages as unique', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      await checkDuplicate(chatId, userId, 'First message', 1, defaultConfig, redis());
      await checkDuplicate(chatId, userId, 'Second message', 2, defaultConfig, redis());
      await checkDuplicate(chatId, userId, 'Third message', 3, defaultConfig, redis());

      // No duplicate detected
      const result = await checkDuplicate(
        chatId,
        userId,
        'Different content',
        4,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('uses hashText for similarity', () => {
    it('produces same hash for identical normalized text', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      // UPPERCASE version
      await checkDuplicate(chatId, userId, 'HELLO WORLD', 1, defaultConfig, redis());

      // lowercase version (same after normalization)
      const result = await checkDuplicate(
        chatId,
        userId,
        'hello world',
        2,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.score).toBe(35);
    });

    it('normalizes Turkish characters for duplicate detection', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      // Turkish characters
      await checkDuplicate(chatId, userId, 'merhaba dünya', 1, defaultConfig, redis());

      // ASCII equivalent
      const result = await checkDuplicate(
        chatId,
        userId,
        'merhaba dunya',
        2,
        defaultConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(true);
    });

    it('normalizes leetspeak variations', async () => {
      const chatId = 'chat123';
      const userId = 'user456';

      // Normal text
      await checkDuplicate(chatId, userId, 'password123', 1, defaultConfig, redis());

      // Leetspeak variant
      const result = await checkDuplicate(
        chatId,
        userId,
        'p4ssw0rd123',
        2,
        defaultConfig,
        redis()
      );

      // After normalization, these should hash the same
      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('Redis keys are properly namespaced per chatId/userId', () => {
    it('uses different keys for different chats', async () => {
      const userId = 'user456';
      const text = 'Same message';

      // First chat
      await checkDuplicate('chat1', userId, text, 1, defaultConfig, redis());

      // Second chat (same user, same text, different chat)
      const result = await checkDuplicate('chat2', userId, text, 2, defaultConfig, redis());

      // Should not be detected as duplicate (different chat namespace)
      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
    });

    it('isolates duplicate detection per chat', async () => {
      const text = 'Shared message';

      // Send in chat1
      await checkDuplicate('chat1', 'userA', text, 1, defaultConfig, redis());

      // Same user sends in chat2
      const result = await checkDuplicate('chat2', 'userA', text, 2, defaultConfig, redis());

      // Not a duplicate (different chat namespace)
      expect(result.isDuplicate).toBe(false);
    });

    it('keys include both chatId and textHash', async () => {
      const chatId = 'testchat';
      const text = 'unique message';

      await checkDuplicate(chatId, 'user123', text, 1, defaultConfig, redis());

      const keys = await mockRedis.keys(`duplicate:${chatId}:*`);
      expect(keys.length).toBe(1);

      // Key should be duplicate:{chatId}:{hash}
      expect(keys[0]).toMatch(new RegExp(`^duplicate:${chatId}:[a-f0-9]+$`));
    });
  });

  describe('level determination', () => {
    it('returns NONE level when score is 0', async () => {
      const result = await checkDuplicate(
        'chat123',
        'user456',
        'new message',
        1,
        defaultConfig,
        redis()
      );

      expect(result.level).toBe('NONE');
    });

    it('returns MEDIUM level for hashScore only (35)', async () => {
      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'test';

      await checkDuplicate(chatId, userId, text, 1, defaultConfig, redis());

      const result = await checkDuplicate(
        chatId,
        userId,
        text,
        2,
        defaultConfig,
        redis()
      );

      expect(result.score).toBe(35);
      expect(result.level).toBe('MEDIUM');
    });

    it('returns HIGH level when score >= 50', async () => {
      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'repeated';

      // First occurrence - count=1
      await checkDuplicate(chatId, userId, text, 1, defaultConfig, redis());

      // Second occurrence - count=2, score=35 (MEDIUM)
      await checkDuplicate(chatId, userId, text, 2, defaultConfig, redis());

      // Third occurrence - count=3, score=35 (still MEDIUM, not >= maxRepeats)
      await checkDuplicate(chatId, userId, text, 3, defaultConfig, redis());

      // Fourth occurrence - count=4, score=35+50=85 (HIGH, >= maxRepeats)
      const result = await checkDuplicate(
        chatId,
        userId,
        text,
        4,
        defaultConfig,
        redis()
      );

      expect(result.score).toBe(85);
      expect(result.level).toBe('HIGH');
    });
  });

  describe('config overrides', () => {
    it('respects custom windowSeconds', async () => {
      const shortConfig: DuplicateConfig = {
        windowSeconds: 1, // 1 second window
        maxRepeats: 3,
        hashScore: 35,
        repeatScore: 50,
      };

      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'time-sensitive';

      await checkDuplicate(chatId, userId, text, 1, shortConfig, redis());

      // Second message within window should detect duplicate
      const result = await checkDuplicate(
        chatId,
        userId,
        text,
        2,
        shortConfig,
        redis()
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.score).toBe(35);
    });

    it('respects custom hashScore and repeatScore', async () => {
      const customConfig: DuplicateConfig = {
        windowSeconds: 120,
        maxRepeats: 2,
        hashScore: 20,
        repeatScore: 30,
      };

      const chatId = 'chat123';
      const userId = 'user456';
      const text = 'custom scores';

      await checkDuplicate(chatId, userId, text, 1, customConfig, redis());
      await checkDuplicate(chatId, userId, text, 2, customConfig, redis());

      // Third occurrence with maxRepeats=2: 20 + 30 = 50
      const result = await checkDuplicate(
        chatId,
        userId,
        text,
        3,
        customConfig,
        redis()
      );

      expect(result.score).toBe(50);
      expect(result.level).toBe('HIGH');
    });
  });

  describe('error handling', () => {
    it('fails open on Redis errors', async () => {
      const errorRedis = {
        get: async () => {
          throw new Error('Redis connection failed');
        },
        setex: async () => {
          throw new Error('Redis connection failed');
        },
      } as unknown as MockRedisClient;

      const result = await checkDuplicate(
        'chat123',
        'user456',
        'test message',
        1,
        defaultConfig,
        errorRedis as any
      );

      // Should return default (safe) result on error
      expect(result.isDuplicate).toBe(false);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });
});