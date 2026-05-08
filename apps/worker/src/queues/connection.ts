// Queue setup and connection
import { Redis } from 'ioredis';

export const QUEUE_NAMES = {
  ASYNC_ANALYSIS: 'async-analysis',
  ACTION_RETRY: 'action-retry',
  AUDIT_EVENTS: 'audit-events',
  DOMAIN_INTEL: 'domain-intel',
  RAID_CORRELATION: 'raid-correlation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Create Redis connection for BullMQ
export function createRedisConnection(): Redis {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379');
  const password = process.env.REDIS_PASSWORD;

  return new Redis({
    host,
    port,
    password: password || undefined,
    maxRetriesPerRequest: null,
  });
}

// Queue configurations
export const QUEUE_CONFIGS = {
  [QUEUE_NAMES.ASYNC_ANALYSIS]: {
    concurrency: parseInt(process.env.ASYNC_ANALYSIS_CONCURRENCY || '5'),
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
  [QUEUE_NAMES.ACTION_RETRY]: {
    concurrency: parseInt(process.env.ACTION_RETRY_CONCURRENCY || '3'),
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
  [QUEUE_NAMES.AUDIT_EVENTS]: {
    concurrency: parseInt(process.env.AUDIT_EVENTS_CONCURRENCY || '10'),
  },
  [QUEUE_NAMES.DOMAIN_INTEL]: {
    concurrency: parseInt(process.env.DOMAIN_INTEL_CONCURRENCY || '5'),
    limiter: {
      max: 20,
      duration: 1000,
    },
  },
  [QUEUE_NAMES.RAID_CORRELATION]: {
    concurrency: parseInt(process.env.RAID_CORRELATION_CONCURRENCY || '3'),
  },
} as const;

// Default job options
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};