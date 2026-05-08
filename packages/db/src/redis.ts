import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD;

export const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export type RedisClient = typeof redis;

// Key factory for consistent key naming
export const keys = {
  // Rate limiting: rate:user:{chatId}:{userId}
  rate: (chatId: string | number, userId: string | number) => `rate:user:${chatId}:${userId}`,

  // Duplicate detection: duplicate:{chatId}:{hash}
  duplicate: (chatId: string | number, hash: string) => `duplicate:${chatId}:${hash}`,

  // Join window: join_window:{chatId}
  joinWindow: (chatId: string | number) => `join_window:${chatId}`,

  // Raid state: raid_state:{chatId}
  raidState: (chatId: string | number) => `raid_state:${chatId}`,

  // Policy cache: policy_cache:{chatId}
  policyCache: (chatId: string | number) => `policy_cache:${chatId}`,

  // Permissions cache: permissions_cache:{chatId}
  permissionsCache: (chatId: string | number) => `permissions_cache:${chatId}`,

  // Action lock: action_lock:{chatId}:{messageId}:{action}
  actionLock: (chatId: string | number, messageId: string | number, action: string) =>
    `action_lock:${chatId}:${messageId}:${action}`,

  // New member probation: probation:{chatId}:{userId}
  probation: (chatId: string | number, userId: string | number) => `probation:${chatId}:${userId}`,

  // User verification: verified:{chatId}:{userId}
  verified: (chatId: string | number, userId: string | number) => `verified:${chatId}:${userId}`,

  // Verification challenge: verify_challenge:{chatId}:{userId}
  verifyChallenge: (chatId: string | number, userId: string | number) => `verify_challenge:${chatId}:${userId}`,

  // Join spike: join_spike:{chatId}
  joinSpike: (chatId: string | number) => `join_spike:${chatId}`,

  // Lockdown state: lockdown:{chatId}
  lockdown: (chatId: string | number) => `lockdown:${chatId}`,
};

export default redis;
