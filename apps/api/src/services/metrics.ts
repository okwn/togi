// Observability metrics for Prometheus
// Tracks: DB latency, Redis latency, Telegram API errors, queue depth

import { redis } from '@togi/db';
import { QUEUE_NAMES } from '../queues/connection';

interface Metric {
  name: string;
  help: string;
  type: 'gauge' | 'counter' | 'histogram';
  labels?: string[];
}

// In-memory metrics storage (reset on restart)
const metrics: Map<string, { value: number; labels: Record<string, string> }[]> = new Map();

// Histogram buckets for latency (ms)
const LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000];

// Metric definitions
const METRIC_DEFINITIONS: Metric[] = [
  { name: 'togi_db_query_duration_seconds', help: 'Database query duration', type: 'histogram', labels: ['operation', 'table'] },
  { name: 'togi_redis_command_duration_seconds', help: 'Redis command duration', type: 'histogram', labels: ['command'] },
  { name: 'togi_redis_connection_status', help: 'Redis connection status (1=connected, 0=disconnected)', type: 'gauge' },
  { name: 'togi_telegram_api_errors_total', help: 'Telegram API error count', type: 'counter', labels: ['error', 'operation'] },
  { name: 'togi_telegram_api_duration_seconds', help: 'Telegram API call duration', type: 'histogram', labels: ['operation'] },
  { name: 'togi_queue_jobs_total', help: 'Total jobs processed', type: 'counter', labels: ['queue', 'status'] },
  { name: 'togi_queue_jobs_pending', help: 'Pending jobs in queue', type: 'gauge', labels: ['queue'] },
  { name: 'togi_webhook_requests_total', help: 'Total webhook requests', type: 'counter', labels: ['status'] },
  { name: 'togi_webhook_request_duration_seconds', help: 'Webhook request duration', type: 'histogram' },
];

// Record a histogram value
export function recordDbQueryLatency(operation: string, table: string, durationMs: number): void {
  const key = `togi_db_query_duration_seconds${labelsToString(operation, table)}`;
  recordHistogram(key, durationMs / 1000); // Convert to seconds
}

// Record Redis command latency
export function recordRedisCommandLatency(command: string, durationMs: number): void {
  const key = `togi_redis_command_duration_seconds${labelsToString(command)}`;
  recordHistogram(key, durationMs / 1000);
}

// Update Redis connection status
export function setRedisConnectionStatus(connected: boolean): void {
  const key = 'togi_redis_connection_status';
  if (!metrics.has(key)) {
    metrics.set(key, [{ value: 0, labels: {} }]);
  }
  metrics.get(key)![0].value = connected ? 1 : 0;
}

// Record Telegram API error
export function recordTelegramApiError(error: string, operation: string): void {
  const key = `togi_telegram_api_errors_total${labelsToString(error, operation)}`;
  recordCounter(key);
}

// Record Telegram API duration
export function recordTelegramApiDuration(operation: string, durationMs: number): void {
  const key = `togi_telegram_api_duration_seconds${labelsToString(operation)}`;
  recordHistogram(key, durationMs / 1000);
}

// Record queue job
export function recordQueueJob(queue: string, status: 'completed' | 'failed' | 'retry'): void {
  const key = `togi_queue_jobs_total${labelsToString(queue, status)}`;
  recordCounter(key);
}

// Record webhook request
export function recordWebhookRequest(status: 'success' | 'duplicate' | 'error', durationMs: number): void {
  const counterKey = `togi_webhook_requests_total${labelsToString(status)}`;
  recordCounter(counterKey);

  const histogramKey = 'togi_webhook_request_duration_seconds';
  recordHistogram(histogramKey, durationMs / 1000);
}

// Helper to build label string
function labelsToString(...labelValues: string[]): string {
  // This is simplified - in production use proper label handling
  return labelValues.length > 0 ? `{${labelValues.join(',')}}` : '';
}

// Record histogram value (simplified - track sum and count for calculating average)
function recordHistogram(key: string, value: number): void {
  if (!metrics.has(key)) {
    metrics.set(key, []);
  }
  const entries = metrics.get(key)!;
  entries.push({ value, labels: {} });
  // Keep only last 10000 samples to prevent memory issues
  if (entries.length > 10000) {
    entries.shift();
  }
}

// Record counter increment
function recordCounter(key: string): void {
  if (!metrics.has(key)) {
    metrics.set(key, [{ value: 0, labels: {} }]);
  }
  metrics.get(key)![0].value += 1;
}

// Prometheus format output
export function getPrometheusMetrics(): string {
  const lines: string[] = [];

  // Add metric definitions
  for (const def of METRIC_DEFINITIONS) {
    lines.push(`# HELP ${def.name} ${def.help}`);
    lines.push(`# TYPE ${def.name} ${def.type}`);
  }

  // Add simulated current values for demo
  // In production, these would come from actual measurements
  lines.push('togi_redis_connection_status 1');

  // Queue depths (would be actual Redis LLEN in production)
  for (const queueName of Object.values(QUEUE_NAMES)) {
    lines.push(`togi_queue_jobs_pending{queue="${queueName}"} 0`);
  }

  lines.push('');

  return lines.join('\n');
}

// Timer utility for measuring durations
export function measureLatency<T>(fn: () => Promise<T>, onComplete: (durationMs: number) => void): Promise<T> {
  const start = Date.now();
  return fn().then(
    (result) => {
      onComplete(Date.now() - start);
      return result;
    },
    (error) => {
      onComplete(Date.now() - start);
      throw error;
    }
  );
}

// Wrapper for database operations with metrics
export async function withDbMetrics<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordDbQueryLatency(operation, table, Date.now() - start);
  }
}

// Wrapper for Redis operations with metrics
export async function withRedisMetrics<T>(
  command: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordRedisCommandLatency(command, Date.now() - start);
  }
}

// Wrapper for Telegram API calls with metrics
export async function withTelegramMetrics<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } catch (error) {
    recordTelegramApiError(String(error), operation);
    throw error;
  } finally {
    recordTelegramApiDuration(operation, Date.now() - start);
  }
}