// tools/load-test/src/run-detection-benchmark.ts
import { performance } from 'perf_hooks';
import Redis from 'ioredis-mock';
import { UpdateGenerator, type ScenarioType } from './generate-updates.js';
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

// Simple inline detection logic for benchmarking
function runSimpleDetection(text: string | undefined, links: string[], isNewUser: boolean): { riskScore: number; severity: string; labels: string[] } {
  const labels: string[] = [];
  let riskScore = 0;

  if (!text && links.length === 0) {
    return { riskScore: 0, severity: 'LOW', labels: [] };
  }

  // Check for scam phrases
  const scamPatterns = ['password', 'click this link to win', 'account has been compromised', 'verify your identity', 'update your payment'];
  if (text && scamPatterns.some(p => text.toLowerCase().includes(p))) {
    riskScore += 70;
    labels.push('SCAM_PHRASE');
  }

  // Check for shortener links
  const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly'];
  for (const link of links) {
    if (shorteners.some(s => link.includes(s))) {
      riskScore += 45;
      labels.push('SHORTENER_LINK');
      break;
    }
  }

  // Check for blocked domains
  const blocked = ['malware-site.com', 'phishing-123.xyz', 'spam-link.tk'];
  for (const link of links) {
    if (blocked.some(b => link.includes(b))) {
      riskScore += 90;
      labels.push('BLOCKED_DOMAIN');
      break;
    }
  }

  // New user with links
  if (isNewUser && links.length > 0) {
    riskScore += 50;
    labels.push('NEW_USER_LINK');
  }

  const severity = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
  return { riskScore, severity, labels };
}

export async function runDetectionBenchmark(scenario: ScenarioType, iterations: number): Promise<void> {
  console.log(`\n=== Detection Benchmark: ${scenario} (${iterations} iterations) ===`);

  const generator = new UpdateGenerator();
  const redisClient = createMockRedisClient();

  const end = globalMetrics.startTimer('detection.total');

  for (let i = 0; i < iterations; i++) {
    const update = generator.generateUpdate(scenario, i);

    const detectEnd = globalMetrics.startTimer('detection.fast-path');
    const result = runSimpleDetection(update.text, update.links, update.isNewUser);
    detectEnd();

    globalMetrics.record('detection.labels', result.labels.length);
    globalMetrics.record('detection.score', result.riskScore);
  }

  end();

  // Also benchmark with actual Redis operations
  console.log('\n--- Redis Write Benchmark ---');
  const redisTimings: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await redisClient.set(`bench:key:${i}`, `value:${i}`);
    redisTimings.push(performance.now() - start);
  }
  const sorted = [...redisTimings].sort((a, b) => a - b);
  console.log(`  Redis set p50: ${sorted[50].toFixed(3)}ms, p95: ${sorted[95].toFixed(3)}ms`);

  globalMetrics.printSummary();
}

export async function benchmarkAllScenarios(): Promise<void> {
  const generator = new UpdateGenerator();
  const scenarios = generator.generateScenarios();

  console.log('\n=== Running All Detection Scenarios ===');
  console.log(`Total scenarios: ${scenarios.length}`);

  for (const config of scenarios) {
    const scenarioName = generator.getScenarioName(config.type);
    console.log(`\nScenario: ${scenarioName} (${config.type}) - ${config.count} messages`);

    const start = performance.now();
    let highSeverity = 0;
    let totalScore = 0;

    for (let i = 0; i < config.count; i++) {
      const update = generator.generateUpdate(config.type, i);
      const result = runSimpleDetection(update.text, update.links, update.isNewUser);

      totalScore += result.riskScore;
      if (result.severity === 'HIGH') {
        highSeverity++;
      }
    }

    const duration = performance.now() - start;
    const avgScore = totalScore / config.count;
    const detectionRate = (highSeverity / config.count) * 100;

    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Avg score: ${avgScore.toFixed(1)}`);
    console.log(`  High severity rate: ${detectionRate.toFixed(1)}%`);
    console.log(`  Per-message: ${(duration / config.count).toFixed(2)}ms`);
  }
}