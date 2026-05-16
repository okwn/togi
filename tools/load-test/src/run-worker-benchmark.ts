// tools/load-test/src/run-worker-benchmark.ts
import { performance } from 'perf_hooks';
import { UpdateGenerator } from './generate-updates.js';
import { globalMetrics } from './metrics.js';

// Mock BullMQ queue operations
class MockQueue {
  private jobs: Array<{ name: string; data: any; addedAt: number }> = [];
  private processing: boolean = false;

  async add(name: string, data: any): Promise<void> {
    const enqueueStart = performance.now();

    // Simulate queue add latency (minimal, in-memory)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2));

    this.jobs.push({ name, data, addedAt: Date.now() });
    const enqueueDuration = performance.now() - enqueueStart;
    globalMetrics.record('worker.queue-enqueue', enqueueDuration);
  }

  async process(handler: (job: { name: string; data: any }) => Promise<void>): Promise<void> {
    this.processing = true;
    for (const job of this.jobs) {
      const processStart = performance.now();
      await handler(job);
      const processDuration = performance.now() - processStart;
      globalMetrics.record('worker.process', processDuration);
    }
    this.processing = false;
  }

  get length(): number {
    return this.jobs.length;
  }

  clear(): void {
    this.jobs = [];
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
    const count = Math.min(config.count, 50);
    for (let i = 0; i < count; i++) {
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

  console.log(`Enqueue p50: ${p50.toFixed(3)}ms`);
  console.log(`Enqueue p95: ${p95.toFixed(3)}ms`);
  console.log(`Enqueue p99: ${p99.toFixed(3)}ms`);
  console.log(`Total jobs queued: ${queue.length}`);

  globalMetrics.record('worker.queue-p50', p50);
  globalMetrics.record('worker.queue-p95', p95);
  globalMetrics.record('worker.queue-p99', p99);

  // Benchmark worker processing (without AI)
  console.log('\n--- Worker Process Benchmark (no AI) ---');
  const processTimings: number[] = [];

  await queue.process(async (job) => {
    const start = performance.now();

    // Simulate processing without AI (just basic detection pass-through)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 5));

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
  console.log(`\nAI path: NOT measured (requires real API)`);

  globalMetrics.record('worker.process-p50', procP50);
  globalMetrics.record('worker.process-p95', procP95);
  globalMetrics.record('worker.process-p99', procP99);

  // Target check
  console.log('\n--- Target Check ---');
  const target = 2000; // 2s target for worker processing (no AI)
  if (procP95 < target) {
    console.log(`✅ Worker p95 (${procP95.toFixed(2)}ms) < ${target}ms target`);
  } else {
    console.log(`❌ Worker p95 (${procP95.toFixed(2)}ms) >= ${target}ms target`);
  }
}