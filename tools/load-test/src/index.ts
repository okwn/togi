// tools/load-test/src/index.ts
import { performance } from 'perf_hooks';
import { runDetectionBenchmark, benchmarkAllScenarios } from './run-detection-benchmark.js';
import { runWebhookBenchmark } from './run-webhook-load.js';
import { runWorkerBenchmark } from './run-worker-benchmark.js';
import { runRedisBenchmark } from './run-redis-benchmark.js';
import { globalMetrics } from './metrics.js';

type Command = 'detection' | 'webhook' | 'worker' | 'redis' | 'all';

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || 'all') as Command;
  const iterations = parseInt(args[1] || '100', 10);

  console.log('=== TOGI Load Testing Suite ===');
  console.log(`Command: ${command}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);

  globalMetrics.captureMemory();
  const startTime = Date.now();

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

  const totalDuration = Date.now() - startTime;
  console.log(`\n=== Total Duration: ${totalDuration.toFixed(2)}ms ===`);

  globalMetrics.printSummary();
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});