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
    redisOpsP95: number;
  };
  results: Record<string, { p50: number; p95: number; p99: number; count: number }>;
  verdict: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NOT_VERIFIED';
  bottlenecks: string[];
  recommendations: string[];
}

export function generateReport(): PerformanceReport {
  const summary = globalMetrics.getSummary();
  const timings = summary.timings;

  // Determine actual results
  const fastPathTiming = timings['detection.fast-path'] || timings['detection.total'] || { p95: 999, p50: 999, p99: 999, count: 0 };
  const webhookTiming = timings['webhook.latency'] || { p95: 999, p50: 999, p99: 999, count: 0 };
  const queueTiming = timings['worker.queue-enqueue'] || { p95: 999, p50: 999, p99: 999, count: 0 };
  const workerTiming = timings['worker.process'] || { p95: 999, p50: 999, p99: 999, count: 0 };
  const redisTiming = timings['redis.get'] || { p95: 999, p50: 999, p99: 999, count: 0 };

  const targets = {
    fastPathP95: 20,     // < 20ms target
    webhookP95: 120,     // < 120ms target
    queueEnqueueP95: 50, // < 50ms target
    workerAsyncP95: 2000, // < 2s target (without AI)
    redisOpsP95: 5,     // < 5ms target
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
  if (workerTiming.p95 >= 2000) {
    bottlenecks.push(`Worker process p95 (${workerTiming.p95.toFixed(2)}ms) exceeds 2000ms target`);
  }

  // Verdict logic
  let verdict: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'NOT_VERIFIED' = 'VERIFIED';
  const exceededCount = bottlenecks.filter(b => b.includes('exceeds')).length;

  if (exceededCount === 0) {
    verdict = 'VERIFIED';
  } else if (exceededCount <= 2) {
    verdict = 'PARTIALLY_VERIFIED';
  } else {
    verdict = 'NOT_VERIFIED';
  }

  // Generate recommendations based on bottlenecks
  if (fastPathTiming.p95 >= 20) {
    recommendations.push('Consider adding Redis caching for hot paths');
    recommendations.push('Profile detection engine to identify slowest detectors');
  }
  if (webhookTiming.p95 >= 120) {
    recommendations.push('Review webhook middleware stack for unnecessary processing');
    recommendations.push('Consider connection pooling for database/Redis');
  }
  if (queueTiming.p95 >= 50) {
    recommendations.push('Check Redis connection latency');
    recommendations.push('Consider batch operations for queue add');
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

  const verifications = [
    {
      name: 'Fast Path Decision (p95)',
      target: report.targets.fastPathP95,
      result: report.results['detection.fast-path']?.p95 || report.results['detection.total']?.p95 || 999,
    },
    {
      name: 'Webhook Latency (p95)',
      target: report.targets.webhookP95,
      result: report.results['webhook.latency']?.p95 || 999,
    },
    {
      name: 'Queue Enqueue (p95)',
      target: report.targets.queueEnqueueP95,
      result: report.results['worker.queue-enqueue']?.p95 || 999,
    },
    {
      name: 'Worker Async (p95)',
      target: report.targets.workerAsyncP95,
      result: report.results['worker.process']?.p95 || 999,
    },
  ];

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
${verifications.map(v => `| ${v.name} | < ${v.target}ms | ${v.result === 999 ? 'N/A' : v.result.toFixed(2) + 'ms'} | ${v.result < v.target ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

## Detailed Results

${Object.entries(report.results).map(([name, data]) => `
### ${name}

| Percentile | Value |
|------------|-------|
| p50 | ${data.p50?.toFixed(2) || 'N/A'}ms |
| p95 | ${data.p95?.toFixed(2) || 'N/A'}ms |
| p99 | ${data.p99?.toFixed(2) || 'N/A'}ms |
| min | ${data.min?.toFixed(2) || 'N/A'}ms |
| max | ${data.max?.toFixed(2) || 'N/A'}ms |
| count | ${data.count || 0} |
`).join('\n')}

## Bottlenecks

${report.bottlenecks.length > 0 ? report.bottlenecks.map(b => `- ${b}`).join('\n') : 'None identified'}

## Recommendations

${report.recommendations.length > 0 ? report.recommendations.map(r => `- ${r}`).join('\n') : 'No recommendations at this time'}

## Verdict

**${report.verdict}**

${report.verdict === 'VERIFIED' ? '✅ All performance targets met. TOGI\'s sub-20ms fast path claim is verified.' : report.verdict === 'PARTIALLY_VERIFIED' ? '⚠️ Some targets met, some exceeded. See bottlenecks for details.' : '❌ Performance targets not met. See bottlenecks for details.'}

---
*Report generated by TOGI load testing suite*
`;

  writeFileSync(path, content);
  console.log(`\nReport saved to ${path}`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateReport();
  saveReport(report);
}