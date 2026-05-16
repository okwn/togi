// tools/load-test/src/run-redis-benchmark.ts
import { performance } from 'perf_hooks';
import Redis from 'ioredis-mock';
import { globalMetrics } from './metrics.js';

function createMockRedisClient() {
  const redis = new Redis() as any;
  return {
    get: redis.get.bind(redis),
    set: redis.set.bind(redis),
    setex: redis.setex.bind(redis),
    del: redis.del.bind(redis),
    incr: redis.incr.bind(redis),
    expire: redis.expire.bind(redis),
    expireat: redis.expireat.bind(redis),
    ttl: redis.ttl.bind(redis),
    lpush: redis.lpush.bind(redis),
    lrange: redis.lrange.bind(redis),
    ltrim: redis.ltrim.bind(redis),
    llen: redis.llen.bind(redis),
    hset: (key: string, ...fieldAndValues: any[]) => {
      if (fieldAndValues.length === 1 && typeof fieldAndValues[0] === 'object' && fieldAndValues[0] !== null) {
        return (redis as any).hmset(key, fieldAndValues[0]);
      }
      return redis.hset(key, ...fieldAndValues);
    },
    hget: redis.hget.bind(redis),
    hdel: redis.hdel.bind(redis),
    hgetall: redis.hgetall.bind(redis),
    hincrby: redis.hincrby.bind(redis),
    keys: redis.keys.bind(redis),
    sadd: redis.sadd.bind(redis),
    sismember: redis.sismember.bind(redis),
    srem: redis.srem.bind(redis),
    smembers: redis.smembers.bind(redis),
    zadd: redis.zadd.bind(redis),
    zcard: redis.zcard.bind(redis),
    zremrangebyscore: redis.zremrangebyscore.bind(redis),
  };
}

export async function runRedisBenchmark(iterations: number): Promise<void> {
  console.log(`\n=== Redis Benchmark (${iterations} iterations) ===`);

  const redis = createMockRedisClient();

  // Benchmark common operations
  const operations = [
    { name: 'get', fn: async () => { await redis.get('test-key'); } },
    { name: 'set', fn: async () => { await redis.set('test-key', 'value'); } },
    { name: 'incr', fn: async () => { await redis.incr('counter'); } },
    { name: 'lpush', fn: async () => { await redis.lpush('list', 'item'); } },
    { name: 'hset', fn: async () => { await redis.hset('hash', 'field', 'value'); } },
    { name: 'hincrby', fn: async () => { await (redis as any).hincrby('ratelimit', 'count', 1); } },
    { name: 'setex', fn: async () => { await redis.setex('key', 60, 'value'); } },
  ];

  const results: Record<string, { p50: number; p95: number; p99: number }> = {};

  for (const op of operations) {
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await op.fn();
      } catch {
        // Ignore errors in benchmark
      }
      const duration = performance.now() - start;
      timings.push(duration);
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    results[op.name] = { p50, p95, p99 };
    console.log(`  ${op.name}: p50=${p50.toFixed(3)}ms, p95=${p95.toFixed(3)}ms, p99=${p99.toFixed(3)}ms`);

    globalMetrics.record(`redis.${op.name}`, p95);
  }

  // Target check: p95 < 5ms for Redis operations
  console.log('\n--- Target Check ---');
  const target = 5; // 5ms target for Redis operations
  const worstP95 = Math.max(...Object.values(results).map(r => r.p95));

  if (worstP95 < target) {
    console.log(`✅ Redis worst p95 (${worstP95.toFixed(3)}ms) < ${target}ms target`);
  } else {
    console.log(`❌ Redis worst p95 (${worstP95.toFixed(3)}ms) >= ${target}ms target`);
  }
}