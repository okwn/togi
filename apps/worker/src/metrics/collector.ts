// Worker Metrics Collection
import type { WorkerMetrics, QueueMetrics } from '../types';
import { getQueues, QUEUE_NAMES } from '../queues';

// In-memory metrics storage
const metrics = {
  processedJobs: 0,
  failedJobs: 0,
  totalProcessingTime: 0,
  processingTimes: [] as number[],
  aiTimeoutCount: 0,
  actionRetryCount: 0,
  raidSignalCount: 0,
};

// Record job completion
export function recordJobComplete(durationMs: number): void {
  metrics.processedJobs++;
  metrics.totalProcessingTime += durationMs;
  metrics.processingTimes.push(durationMs);

  // Keep only last 1000 times for p95 calculation
  if (metrics.processingTimes.length > 1000) {
    metrics.processingTimes.shift();
  }
}

// Record job failure
export function recordJobFailure(): void {
  metrics.failedJobs++;
}

// Record AI timeout
export function recordAiTimeout(): void {
  metrics.aiTimeoutCount++;
}

// Record action retry
export function recordActionRetry(): void {
  metrics.actionRetryCount++;
}

// Record raid signal
export function recordRaidSignal(): void {
  metrics.raidSignalCount++;
}

// Calculate p95 processing time
function calculateP95(): number {
  if (metrics.processingTimes.length === 0) return 0;

  const sorted = [...metrics.processingTimes].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index] || 0;
}

// Get queue metrics
async function getQueueMetrics(name: string): Promise<QueueMetrics> {
  try {
    const queue = getQueues()[name];
    if (!queue) {
      return { name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { name, waiting, active, completed, failed, delayed };
  } catch (error) {
    console.error(`Error getting metrics for queue ${name}:`, error);
    return { name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}

// Get all worker metrics
export async function getWorkerMetrics(): Promise<WorkerMetrics> {
  const queueMetricsPromises = Object.values(QUEUE_NAMES).map((name) =>
    getQueueMetrics(name)
  );

  const queueMetrics = await Promise.all(queueMetricsPromises);

  // Calculate average latency (simplified - real implementation would track queue add time)
  const avgLatency = metrics.processedJobs > 0
    ? Math.round(metrics.totalProcessingTime / metrics.processedJobs)
    : 0;

  return {
    processedJobs: metrics.processedJobs,
    failedJobs: metrics.failedJobs,
    queueLatency: avgLatency,
    p95ProcessingDuration: calculateP95(),
    aiTimeoutCount: metrics.aiTimeoutCount,
    actionRetryCount: metrics.actionRetryCount,
    raidSignalCount: metrics.raidSignalCount,
    queues: queueMetrics,
  };
}

// Reset metrics (for testing)
export function resetMetrics(): void {
  metrics.processedJobs = 0;
  metrics.failedJobs = 0;
  metrics.totalProcessingTime = 0;
  metrics.processingTimes = [];
  metrics.aiTimeoutCount = 0;
  metrics.actionRetryCount = 0;
  metrics.raidSignalCount = 0;
}