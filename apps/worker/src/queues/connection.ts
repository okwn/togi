// Queue setup and connection
import { Redis } from 'ioredis';

export const QUEUE_NAMES = {
  CRITICAL_ACTIONS: 'critical-actions',
  ASYNC_ANALYSIS: 'async-analysis',
  AUDIT_EVENTS: 'audit-events',
  DOMAIN_INTEL: 'domain-intel',
  RAID_CORRELATION: 'raid-correlation',
  MEDIA_ANALYSIS: 'media-analysis',
  REPORT_GENERATION: 'report-generation',
  REPORT_DELIVERY: 'report-delivery',
  SCHEDULED_REPORTS: 'scheduled-reports',
  LOW_PRIORITY_INTEL: 'low-priority-intel',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Queue priority (lower = more urgent in BullMQ)
export const QUEUE_PRIORITIES: Record<QueueName, number> = {
  [QUEUE_NAMES.CRITICAL_ACTIONS]: 1,    // Highest priority
  [QUEUE_NAMES.ASYNC_ANALYSIS]: 2,       // High priority
  [QUEUE_NAMES.REPORT_GENERATION]: 3,   // Medium priority
  [QUEUE_NAMES.MEDIA_ANALYSIS]: 4,      // Normal priority
  [QUEUE_NAMES.DOMAIN_INTEL]: 4,        // Normal priority
  [QUEUE_NAMES.AUDIT_EVENTS]: 5,        // Normal priority
  [QUEUE_NAMES.REPORT_DELIVERY]: 6,     // Low priority
  [QUEUE_NAMES.RAID_CORRELATION]: 7,   // Low priority
  [QUEUE_NAMES.LOW_PRIORITY_INTEL]: 8, // Very low priority
  [QUEUE_NAMES.SCHEDULED_REPORTS]: 10,  // Lowest priority
} as const;

// Dead letter queue name
export const DEAD_LETTER_QUEUE = 'dead-letter';

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
  [QUEUE_NAMES.CRITICAL_ACTIONS]: {
    concurrency: parseInt(process.env.CRITICAL_ACTIONS_CONCURRENCY || '5'),
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
  [QUEUE_NAMES.ASYNC_ANALYSIS]: {
    concurrency: parseInt(process.env.ASYNC_ANALYSIS_CONCURRENCY || '5'),
    limiter: {
      max: 10,
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
  [QUEUE_NAMES.MEDIA_ANALYSIS]: {
    concurrency: parseInt(process.env.MEDIA_ANALYSIS_CONCURRENCY || '3'),
    limiter: {
      max: 5,
      duration: 1000,
    },
  },
  [QUEUE_NAMES.REPORT_GENERATION]: {
    concurrency: parseInt(process.env.REPORT_GENERATION_CONCURRENCY || '2'),
  },
  [QUEUE_NAMES.REPORT_DELIVERY]: {
    concurrency: parseInt(process.env.REPORT_DELIVERY_CONCURRENCY || '5'),
  },
  [QUEUE_NAMES.SCHEDULED_REPORTS]: {
    concurrency: parseInt(process.env.SCHEDULED_REPORTS_CONCURRENCY || '1'),
  },
  [QUEUE_NAMES.LOW_PRIORITY_INTEL]: {
    concurrency: parseInt(process.env.LOW_PRIORITY_INTEL_CONCURRENCY || '2'),
  },
} as const;

// Default job options with dead letter queue handling
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 5000,  // Keep failed jobs for debugging before moving to DLQ
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
} as const;

// Failed job move to dead letter after max attempts
export const DEAD_LETTER_JOB_OPTIONS = {
  removeOnComplete: false,
  removeOnFail: {
    count: 10000,  // Keep in DLQ for longer
  },
  attempts: 1,
};