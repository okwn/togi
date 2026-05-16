# Phase 05: Load Testing and Performance Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build measurable load testing infrastructure for TOGI's core security system to prove or disprove sub-20ms fast path decision claims.

**Architecture:** Synthetic event generation with realistic Telegram update formats, benchmark scripts that mock Telegram API calls to avoid spamming real services, separate measurement of fast path, webhook lifecycle, and worker queue latency.

**Tech Stack:** TypeScript, Node.js `perf_hooks`, ioredis-mock for Redis benchmarks, Fastify injection for webhook testing.

---

## File Structure

```
tools/load-test/
├── src/
│   ├── generate-updates.ts          # Synthetic Telegram update generator
│   ├── run-webhook-load.ts           # Webhook benchmark (Fastify injection)
│   ├── run-detection-benchmark.ts   # Fast path detection benchmark
│   ├── run-worker-benchmark.ts      # Queue + worker benchmark
│   ├── metrics.ts                   # Shared metrics collection (p50/p95/p99)
│   ├── report-template.ts           # Report generation
│   └── index.ts                     # CLI entry point
├── docs/
│   └── PERFORMANCE_RESULTS.md       # Benchmark results document
├── package.json
└── tsconfig.json

package.json (root)
├── scripts:
│   ├── bench:detection              # tsx tools/load-test/src/index.ts detection
│   ├── bench:webhook                # tsx tools/load-test/src/index.ts webhook
│   ├── bench:worker                 # tsx tools/load-test/src/index.ts worker
│   └── loadtest                     # tsx tools/load-test/src/index.ts all
```

---

## Task 1: Load Test Package Setup

**Files:**
- Create: `tools/load-test/package.json`
- Create: `tools/load-test/tsconfig.json`

```json
// tools/load-test/package.json
{
  "name": "@togi/load-test",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "detection": "tsx src/index.ts detection",
    "webhook": "tsx src/index.ts webhook",
    "worker": "tsx src/index.ts worker",
    "all": "tsx src/index.ts all",
    "report": "tsx src/report-template.ts"
  },
  "dependencies": {
    "@togi/detection-engine": "workspace:*",
    "@togi/policy-engine": "workspace:*",
    "@togi/test-utils": "workspace:*",
    "@togi/config": "workspace:*",
    "ioredis": "^5.3.0",
    "ioredis-mock": "^8.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  }
}
```

```json
// tools/load-test/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## Task 2: Metrics Collection Module

**Files:**
- Create: `tools/load-test/src/metrics.ts`

```typescript
// tools/load-test/src/metrics.ts
import { performance, PerformanceObserver } from 'perf_hooks';

export interface TimingResult {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  count: number;
}

export interface MetricsSummary {
  timings: Record<string, TimingResult>;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  timestamp: string;
  gitCommit: string;
}

export class MetricsCollector {
  private measurements: Map<string, number[]> = new Map();
  private startMemory: { heapUsed: number; heapTotal: number; external: number; rss: number } | null = null;

  startTimer(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.record(name, duration);
    };
  }

  record(name: string, value: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(value);
  }

  captureMemory(): void {
    const mem = process.memoryUsage();
    this.startMemory = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }

  getMemoryDelta(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    const current = process.memoryUsage();
    if (!this.startMemory) return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
    return {
      heapUsed: current.heapUsed - this.startMemory.heapUsed,
      heapTotal: current.heapTotal - this.startMemory.heapTotal,
      external: current.external - this.startMemory.external,
      rss: current.rss - this.startMemory.rss,
    };
  }

  calculatePercentiles(values: number[]): TimingResult {
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      p50: this.percentile(sorted, 0.50),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      min: sorted[0] || 0,
      max: sorted[count - 1] || 0,
      mean: count > 0 ? sum / count : 0,
      count,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }

  getSummary(): MetricsSummary {
    const timings: Record<string, TimingResult> = {};
    for (const [name, values] of this.measurements) {
      timings[name] = this.calculatePercentiles(values);
    }
    return {
      timings,
      memory: this.getMemoryDelta(),
      timestamp: new Date().toISOString(),
      gitCommit: this.getGitCommit(),
    };
  }

  private getGitCommit(): string {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 8);
    } catch {
      return 'unknown';
    }
  }

  printSummary(): void {
    const summary = this.getSummary();
    console.log('\n=== Performance Metrics ===');
    console.log(`Timestamp: ${summary.timestamp}`);
    console.log(`Git Commit: ${summary.gitCommit}`);
    console.log('\nTimings (ms):');
    for (const [name, result] of Object.entries(summary.timings)) {
      console.log(`  ${name}: p50=${result.p50.toFixed(2)}ms, p95=${result.p95.toFixed(2)}ms, p99=${result.p99.toFixed(2)}ms (n=${result.count})`);
    }
    console.log('\nMemory Delta (bytes):');
    console.log(`  heapUsed: ${summary.memory.heapUsed}`);
    console.log(`  rss: ${summary.memory.rss}`);
  }
}

export const globalMetrics = new MetricsCollector();
```

---

## Task 3: Synthetic Update Generator

**Files:**
- Create: `tools/load-test/src/generate-updates.ts`

```typescript
// tools/load-test/src/generate-updates.ts
import type { DetectionContext } from '@togi/detection-engine';

// Scenario types matching Phase 05 requirements
export type ScenarioType =
  | 'clean'
  | 'flood'
  | 'duplicate'
  | 'shortener'
  | 'blocked-domain'
  | 'new-user-probation-link'
  | 'mention-spam'
  | 'scam-phrase'
  | 'raid-join'
  | 'raid-message'
  | 'mixed';

export interface ScenarioConfig {
  type: ScenarioType;
  count: number;
  userId?: string;
  chatId?: string;
}

const SCAM_PHRASES = [
  'send me your password',
  'click this link to win prize',
  'your account has been compromised',
  'verify your identity now',
  'urgent: update your payment info',
];

const BLOCKED_DOMAINS = ['malware-site.com', 'phishing-123.xyz', 'spam-link.tk'];
const SHORTENER_DOMAINS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly'];

export class UpdateGenerator {
  private chatId = '-1001234567890';
  private userIdCounter = 1000;
  private messageIdCounter = 1;

  generateScenarios(): ScenarioConfig[] {
    return [
      { type: 'clean', count: 100 },
      { type: 'flood', count: 50 },
      { type: 'duplicate', count: 50 },
      { type: 'shortener', count: 30 },
      { type: 'blocked-domain', count: 30 },
      { type: 'new-user-probation-link', count: 30 },
      { type: 'mention-spam', count: 30 },
      { type: 'scam-phrase', count: 30 },
      { type: 'raid-join', count: 100 },
      { type: 'raid-message', count: 100 },
      { type: 'mixed', count: 200 },
    ];
  }

  generateUpdate(scenario: ScenarioType, index: number): DetectionContext {
    const userId = `user_${(index % 50) + 1}`;
    const username = `user${(index % 50) + 1}`;
    const isNewUser = index % 10 === 0;

    switch (scenario) {
      case 'clean':
        return this.cleanText(userId, username);
      case 'flood':
        return this.floodMessage(userId, username, index);
      case 'duplicate':
        return this.duplicateSpam(userId, username, index);
      case 'shortener':
        return this.shortenerLink(userId, username);
      case 'blocked-domain':
        return this.blockedDomainLink(userId, username);
      case 'new-user-probation-link':
        return this.newUserProbationLink(userId, username, isNewUser);
      case 'mention-spam':
        return this.mentionSpam(userId, username, index);
      case 'scam-phrase':
        return this.scamPhrase(userId, username, index);
      case 'raid-join':
        return this.raidJoin(index);
      case 'raid-message':
        return this.raidMessage(index);
      case 'mixed':
        return this.mixedTraffic(index);
      default:
        return this.cleanText(userId, username);
    }
  }

  private cleanText(userId: string, username: string): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'Hello everyone, how are you today?',
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000 * 30,
      timestamp: Date.now(),
    };
  }

  private floodMessage(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Message number ${index % 20}`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private duplicateSpam(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'Buy cheap followers click here bit.ly/spam',
      links: index % 3 === 0 ? ['https://bit.ly/spam'] : [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private shortenerLink(userId: string, username: string): DetectionContext {
    const domains = SHORTENER_DOMAINS;
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Check this out https://${domains[Math.floor(Math.random() * domains.length)]}/ promo`,
      links: [`https://${domains[Math.floor(Math.random() * domains.length)]}/ promo`],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private blockedDomainLink(userId: string, username: string): DetectionContext {
    const domains = BLOCKED_DOMAINS;
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Visit ${domains[Math.floor(Math.random() * domains.length)]} for more`,
      links: [`https://${domains[Math.floor(Math.random() * domains.length)]}`],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private newUserProbationLink(userId: string, username: string, isNewUser: boolean): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'New member here, check my website example.com',
      links: ['https://example.com'],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser,
      userMemberSince: isNewUser ? Date.now() - 60000 : Date.now() - 86400000 * 30,
      timestamp: Date.now(),
    };
  }

  private mentionSpam(userId: string, username: string, index: number): DetectionContext {
    const mentionCount = (index % 10) + 5;
    const mentions = Array.from({ length: mentionCount }, (_, i) => `user${i + 1}`);
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Hey ${mentions.join(' @')} check this out!`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions,
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private scamPhrase(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: SCAM_PHRASES[index % SCAM_PHRASES.length],
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private raidJoin(index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId: `raid_user_${index}`,
      username: `raiduser${index}`,
      text: undefined,
      links: [],
      mediaType: undefined,
      messageId: undefined,
      mentions: [],
      isNewUser: true,
      userMemberSince: Date.now(),
      timestamp: Date.now(),
    };
  }

  private raidMessage(index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId: `raid_user_${index % 20}`,
      username: `raiduser${index % 20}`,
      text: `Raid message ${index % 15}`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: true,
      userMemberSince: Date.now() - 300000,
      timestamp: Date.now(),
    };
  }

  private mixedTraffic(index: number): DetectionContext {
    const scenarios: ScenarioType[] = ['clean', 'flood', 'duplicate', 'shortener', 'scam-phrase'];
    return this.generateUpdate(scenarios[index % scenarios.length], index);
  }

  getScenarioName(scenario: ScenarioType): string {
    const names: Record<ScenarioType, string> = {
      clean: 'Clean Text Messages',
      flood: 'Flood Messages',
      duplicate: 'Duplicate Spam',
      shortener: 'Shortener Links',
      'blocked-domain': 'Blocklisted Domain Links',
      'new-user-probation-link': 'New User Probation Link',
      'mention-spam': 'Mention Spam',
      'scam-phrase': 'Scam Phrase',
      'raid-join': 'Raid Simulation (Joins)',
      'raid-message': 'Raid Simulation (Messages)',
      mixed: 'Mixed Realistic Traffic',
    };
    return names[scenario];
  }
}
```

---

## Task 4: Detection Benchmark

**Files:**
- Create: `tools/load-test/src/run-detection-benchmark.ts`

```typescript
// tools/load-test/src/run-detection-benchmark.ts
import { createMockRedisClient } from '@togi/test-utils';
import { runFastPath } from '@togi/detection-engine';
import { getDefaultPolicy } from '@togi/policy-engine';
import { UpdateGenerator, type ScenarioType } from './generate-updates.js';
import { globalMetrics } from './metrics.js';

export async function runDetectionBenchmark(scenario: ScenarioType, iterations: number): Promise<void> {
  console.log(`\n=== Detection Benchmark: ${scenario} (${iterations} iterations) ===`);
  
  const generator = new UpdateGenerator();
  const policy = getDefaultPolicy('BALANCED');
  const redisClient = createMockRedisClient();

  const end = globalMetrics.startTimer('detection.total');
  
  for (let i = 0; i < iterations; i++) {
    const update = generator.generateUpdate(scenario, i);
    
    const detectEnd = globalMetrics.startTimer('detection.fast-path');
    const result = await runFastPath(update, policy, undefined, redisClient);
    detectEnd();

    globalMetrics.record('detection.labels', result.labels.length);
    globalMetrics.record('detection.score', result.riskScore);
  }
  
  end();

  // Run detection for all scenarios
  const allScenarios = generator.generateScenarios();
  for (const config of allScenarios) {
    for (let i = 0; i < config.count; i++) {
      const update = generator.generateUpdate(config.type, i);
      const detectEnd = globalMetrics.startTimer(`detection.${config.type}`);
      const result = await runFastPath(update, policy, undefined, redisClient);
      detectEnd();
    }
  }

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
    
    const policy = getDefaultPolicy('BALANCED');
    const redisClient = createMockRedisClient();
    
    const start = performance.now();
    let highSeverity = 0;
    let totalScore = 0;

    for (let i = 0; i < config.count; i++) {
      const update = generator.generateUpdate(config.type, i);
      const result = await runFastPath(update, policy, undefined, redisClient);
      
      totalScore += result.riskScore;
      if (result.severity === 'HIGH' || result.severity === 'CRITICAL') {
        highSeverity++;
      }
    }

    const duration = performance.now() - start;
    const avgScore = totalScore / config.count;
    const detectionRate = (highSeverity / config.count) * 100;

    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Avg score: ${avgScore.toFixed(1)}`);
    console.log(`  High/Critical rate: ${detectionRate.toFixed(1)}%`);
    console.log(`  Per-message: ${(duration / config.count).toFixed(2)}ms`);
  }
}
```

---

## Task 5: Webhook Benchmark

**Files:**
- Create: `tools/load-test/src/run-webhook-load.ts`

```typescript
// tools/load-test/src/run-webhook-load.ts
import Fastify, { FastifyInstance } from 'fastify';
import { registerGroupRoutes } from '../../../apps/api/src/routes/groups.js';
import { registerWebhookRoutes } from '../../../apps/api/src/routes/webhook.js';
import { registerHealthRoutes } from '../../../apps/api/src/routes/health.js';
import { UpdateGenerator, type ScenarioType } from './generate-updates.js';
import { globalMetrics } from './metrics.js';

export async function runWebhookBenchmark(iterations: number): Promise<void> {
  console.log(`\n=== Webhook Load Benchmark (${iterations} iterations) ===`);

  const app: FastifyInstance = await Fastify({ logger: false });
  
  // Register minimal routes for testing
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));
  app.get('/ready', async () => ({ status: 'ready' }));

  await app.ready();

  const generator = new UpdateGenerator();

  // Warmup
  for (let i = 0; i < 10; i++) {
    const update = generator.generateUpdate('clean', i);
    await app.inject({
      method: 'POST',
      url: '/api/webhook',
      payload: update,
    });
  }

  // Benchmark
  const timings: number[] = [];
  const errors: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const update = generator.generateUpdate('mixed', i);
    
    const start = performance.now();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhook',
      payload: update,
    });
    const duration = performance.now() - start;

    timings.push(duration);
    if (response.statusCode >= 400) {
      errors.push(duration);
    }

    globalMetrics.record('webhook.latency', duration);
    globalMetrics.record('webhook.status', response.statusCode);
  }

  // Calculate percentiles
  const sorted = [...timings].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log('\n=== Webhook Results ===');
  console.log(`Total requests: ${iterations}`);
  console.log(`Errors: ${errors.length} (${((errors.length / iterations) * 100).toFixed(1)}%)`);
  console.log(`p50: ${p50.toFixed(2)}ms`);
  console.log(`p95: ${p95.toFixed(2)}ms`);
  console.log(`p99: ${p99.toFixed(2)}ms`);

  await app.close();
}
```

---

## Task 6: Worker Benchmark

**Files:**
- Create: `tools/load-test/src/run-worker-benchmark.ts`

```typescript
// tools/load-test/src/run-worker-benchmark.ts
import { createMockRedisClient } from '@togi/test-utils';
import { UpdateGenerator, type ScenarioType } from './generate-updates.js';
import { globalMetrics } from './metrics.js';

// Mock BullMQ queue operations
class MockQueue {
  private jobs: Array<{ name: string; data: any }> = [];

  async add(name: string, data: any): Promise<void> {
    const enqueueStart = performance.now();
    
    // Simulate queue add latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
    
    this.jobs.push({ name, data });
    const enqueueDuration = performance.now() - enqueueStart;
    globalMetrics.record('worker.queue-enqueue', enqueueDuration);
  }

  async process(handler: (job: { name: string; data: any }) => Promise<void>): Promise<void> {
    for (const job of this.jobs) {
      const processStart = performance.now();
      await handler(job);
      const processDuration = performance.now() - processStart;
      globalMetrics.record('worker.process', processDuration);
    }
  }

  get length(): number {
    return this.jobs.length;
  }
}

export async function runWorkerBenchmark(iterations: number): Promise<void> {
  console.log(`\n=== Worker Benchmark (${iterations} iterations) ===`);

  const queue = new MockQueue();
  const generator = new UpdateGenerator();
  const scenarios = generator.generateScenarios();

  // Benchmark queue enqueue
  console.log('\n--- Queue Enqueue Benchmark ---');
  const enqueueTimings: number[] = [];

  for (const config of scenarios) {
    for (let i = 0; i < Math.min(config.count, 50); i++) {
      const update = generator.generateUpdate(config.type, i);
      
      const start = performance.now();
      await queue.add('async-analysis', {
        detection: update,
        priority: update.isNewUser ? 'high' : 'normal',
      });
      const duration = performance.now() - start;
      enqueueTimings.push(duration);
    }
  }

  const sorted = [...enqueueTimings].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log(`Enqueue p50: ${p50.toFixed(2)}ms`);
  console.log(`Enqueue p95: ${p95.toFixed(2)}ms`);
  console.log(`Enqueue p99: ${p99.toFixed(2)}ms`);
  console.log(`Total jobs queued: ${queue.length}`);

  // Benchmark worker processing (without AI)
  console.log('\n--- Worker Process Benchmark ---');
  const processTimings: number[] = [];

  await queue.process(async (job) => {
    const start = performance.now();
    
    // Simulate processing (without AI call)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    const duration = performance.now() - start;
    processTimings.push(duration);
  });

  const procSorted = [...processTimings].sort((a, b) => a - b);
  const procP50 = procSorted[Math.floor(procSorted.length * 0.5)];
  const procP95 = procSorted[Math.floor(procSorted.length * 0.95)];
  const procP99 = procSorted[Math.floor(procSorted.length * 0.99)];

  console.log(`Process p50: ${procP50.toFixed(2)}ms`);
  console.log(`Process p95: ${procP95.toFixed(2)}ms`);
  console.log(`Process p99: ${procP99.toFixed(2)}ms`);
  console.log(`AI path: NOT measured (requires real API)`);
}
```

---

## Task 7: Redis Benchmark

**Files:**
- Create: `tools/load-test/src/run-redis-benchmark.ts`

```typescript
// tools/load-test/src/run-redis-benchmark.ts
import { createMockRedisClient, type MockRedisClient } from '@togi/test-utils';
import { globalMetrics } from './metrics.js';

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
    { name: 'setex', fn: async () => { await (redis as any).setex('key', 60, 'value'); } },
  ];

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

    console.log(`  ${op.name}: p50=${p50.toFixed(3)}ms, p95=${p95.toFixed(3)}ms, p99=${p99.toFixed(3)}ms`);
    globalMetrics.record(`redis.${op.name}`, p95);
  }
}
```

---

## Task 8: CLI Entry Point

**Files:**
- Create: `tools/load-test/src/index.ts`

```typescript
// tools/load-test/src/index.ts
import { runDetectionBenchmark, benchmarkAllScenarios } from './run-detection-benchmark.js';
import { runWebhookBenchmark } from './run-webhook-load.js';
import { runWorkerBenchmark } from './run-worker-benchmark.js';
import { runRedisBenchmark } from './run-redis-benchmark.js';
import { globalMetrics } from './metrics.js';

type Command = 'detection' | 'webhook' | 'worker' | 'redis' | 'all';

async function main() {
  const command = Bun.argv[2] as Command || 'all';
  const iterations = parseInt(Bun.argv[3] || '100', 10);

  console.log('=== TOGI Load Testing Suite ===');
  console.log(`Command: ${command}`);
  console.log(`Iterations: ${iterations}`);

  globalMetrics.captureMemory();

  switch (command) {
    case 'detection':
      await runDetectionBenchmark('mixed', iterations);
      break;
    case 'webhook':
      await runWebhookBenchmark(iterations);
      break;
    case 'worker':
      await runWorkerBenchmark(iterations);
      break;
    case 'redis':
      await runRedisBenchmark(iterations);
      break;
    case 'all':
      console.log('\n=== Running All Benchmarks ===');
      await runRedisBenchmark(iterations);
      await benchmarkAllScenarios();
      await runWorkerBenchmark(iterations);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Usage: tsx src/index.ts <detection|webhook|worker|redis|all> [iterations]');
      process.exit(1);
  }

  globalMetrics.printSummary();
}

main().catch(console.error);
```

---

## Task 9: Report Generation

**Files:**
- Create: `tools/load-test/src/report-template.ts`
- Create: `docs/PERFORMANCE_RESULTS.md`

```typescript
// tools/load-test/src/report-template.ts
import { globalMetrics } from './metrics.js';
import { writeFileSync } from 'fs';

interface PerformanceReport {
  environment: {
    nodeVersion: string;
    platform: string;
    timestamp: string;
    gitCommit: string;
  };
  hardware: {
    cpuCores: number;
    totalMemory: number;
  };
  targets: {
    fastPathP95: number;
    webhookP95: number;
    queueEnqueueP95: number;
    workerAsyncP95: number;
  };
  results: Record<string, { p50: number; p95: number; p99: number; count: number }>;
  verdict: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NOT_VERIFIED';
  bottlenecks: string[];
  recommendations: string[];
}

export function generateReport(): PerformanceReport {
  const summary = globalMetrics.getSummary();
  const timings = summary.timings;

  // Determine targets
  const fastPathTiming = timings['detection.fast-path'] || { p95: 999 };
  const webhookTiming = timings['webhook.latency'] || { p95: 999 };
  const queueTiming = timings['worker.queue-enqueue'] || { p95: 999 };
  const workerTiming = timings['worker.process'] || { p95: 999 };

  const targets = {
    fastPathP95: 20,    // < 20ms target
    webhookP95: 120,    // < 120ms target
    queueEnqueueP95: 50, // < 50ms target
    workerAsyncP95: 2000, // < 2s target (without AI)
  };

  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  if (fastPathTiming.p95 >= 20) {
    bottlenecks.push(`Fast path p95 (${fastPathTiming.p95.toFixed(2)}ms) exceeds 20ms target`);
  }
  if (webhookTiming.p95 >= 120) {
    bottlenecks.push(`Webhook p95 (${webhookTiming.p95.toFixed(2)}ms) exceeds 120ms target`);
  }
  if (queueTiming.p95 >= 50) {
    bottlenecks.push(`Queue enqueue p95 (${queueTiming.p95.toFixed(2)}ms) exceeds 50ms target`);
  }

  // Verdict
  let verdict: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NOT_VERIFIED' = 'VERIFIED';
  if (bottlenecks.length > 0) {
    verdict = bottlenecks.some(b => b.includes('exceeds')) ? 'PARTIALLY_VERIFIED' : 'VERIFIED';
  }

  return {
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: summary.timestamp,
      gitCommit: summary.gitCommit,
    },
    hardware: {
      cpuCores: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
    },
    targets,
    results: timings as any,
    verdict,
    bottlenecks,
    recommendations,
  };
}

export function saveReport(report: PerformanceReport): void {
  const path = 'docs/PERFORMANCE_RESULTS.md';
  const content = `# TOGI Performance Results

> Generated: ${report.environment.timestamp}
> Git Commit: ${report.environment.gitCommit}

## Environment

| Property | Value |
|----------|-------|
| Node.js | ${report.environment.nodeVersion} |
| Platform | ${report.environment.platform} |
| CPU Cores | ${report.hardware.cpuCores} |
| Total Memory | ${(report.hardware.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB |

## Performance Targets

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| Fast Path Decision (p95) | < ${report.targets.fastPathP95}ms | ${report.results['detection.fast-path']?.p95.toFixed(2) || 'N/A'}ms | ${(report.results['detection.fast-path']?.p95 || 999) < report.targets.fastPathP95 ? '✅ PASS' : '❌ FAIL'} |
| Webhook Latency (p95) | < ${report.targets.webhookP95}ms | ${report.results['webhook.latency']?.p95.toFixed(2) || 'N/A'}ms | ${(report.results['webhook.latency']?.p95 || 999) < report.targets.webhookP95 ? '✅ PASS' : '❌ FAIL'} |
| Queue Enqueue (p95) | < ${report.targets.queueEnqueueP95}ms | ${report.results['worker.queue-enqueue']?.p95.toFixed(2) || 'N/A'}ms | ${(report.results['worker.queue-enqueue']?.p95 || 999) < report.targets.queueEnqueueP95 ? '✅ PASS' : '❌ FAIL'} |
| Worker Async (p95) | < ${report.targets.workerAsyncP95}ms | ${report.results['worker.process']?.p95.toFixed(2) || 'N/A'}ms | ${(report.results['worker.process']?.p95 || 999) < report.targets.workerAsyncP95 ? '✅ PASS' : '❌ FAIL'} |

## Detailed Results

${Object.entries(report.results).map(([name, data]) => `
### ${name}

| Percentile | Value |
|------------|-------|
| p50 | ${data.p50.toFixed(2)}ms |
| p95 | ${data.p95.toFixed(2)}ms |
| p99 | ${data.p99.toFixed(2)}ms |
| min | ${data.min.toFixed(2)}ms |
| max | ${data.max.toFixed(2)}ms |
| count | ${data.count} |
`).join('\n')}

## Bottlenecks

${report.bottlenecks.length > 0 ? report.bottlenecks.map(b => `- ${b}`).join('\n') : 'None identified'}

## Recommendations

${report.recommendations.length > 0 ? report.recommendations.map(r => `- ${r}`).join('\n') : 'No recommendations at this time'}

## Verdict

**${report.verdict}**

${report.verdict === 'VERIFIED' ? 'All performance targets met. Sub-20ms fast path claim verified.' : report.verdict === 'PARTIALLY_VERIFIED' ? 'Some targets met, some exceeded. See bottlenecks.' : 'Performance targets not met. See bottlenecks.'}

---
*Report generated by TOGI load testing suite*
`;

  writeFileSync(path, content);
  console.log(`\nReport saved to ${path}`);
}
```

---

## Task 10: Add Bench Scripts to package.json

**Files:**
- Modify: `package.json` (add bench scripts)

Add to scripts section:

```json
{
  "bench:detection": "tsx tools/load-test/src/index.ts detection 100",
  "bench:webhook": "tsx tools/load-test/src/index.ts webhook 100",
  "bench:worker": "tsx tools/load-test/src/index.ts worker 100",
  "bench:redis": "tsx tools/load-test/src/index.ts redis 100",
  "loadtest": "tsx tools/load-test/src/index.ts all 100"
}
```

---

## Validation Commands

```bash
# Run detection benchmark
pnpm bench:detection

# Run webhook benchmark  
pnpm bench:webhook

# Run worker benchmark
pnpm bench:worker

# Run Redis benchmark
pnpm bench:redis

# Run all benchmarks
pnpm loadtest

# Generate report
pnpm --filter @togi/load-test run report
```

---

## Coverage Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Fast path decision p95 | < 20ms | perf_hooks timing |
| Webhook p95 | < 120ms | Fastify injection timing |
| Queue enqueue p95 | < 50ms | Mock queue timing |
| Worker processing p95 | < 2s (no AI) | Mock BullMQ timing |
| Redis operations p95 | < 5ms | ioredis-mock timing |
| Memory usage | tracked | process.memoryUsage() |
| Error rate | tracked | status code counting |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-load-testing-implementation.md`. Execution approach:**

**Inline Execution** - I'll execute these tasks in sequence since they're infrastructure code with clear specifications. The benchmark scripts are independent and can be built one by one.

**Which approach?**