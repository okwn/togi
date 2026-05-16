// tools/load-test/src/metrics.ts
import { performance } from 'perf_hooks';

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