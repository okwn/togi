// Queue exports
export {
  QUEUE_NAMES,
  createRedisConnection,
  DEFAULT_JOB_OPTIONS,
  QUEUE_CONFIGS,
} from './connection';
export type { QueueName } from './connection';

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection, QUEUE_NAMES, QUEUE_CONFIGS, DEFAULT_JOB_OPTIONS } from './connection';
import type { AsyncAnalysisJob, ActionRetryJob, AuditEventJob, DomainIntelJob, RaidCorrelationJob } from '../types';

// Queue instances
let queues: Record<string, Queue> = {};

export function getQueues(): Record<string, Queue> {
  if (Object.keys(queues).length === 0) {
    const connection = createRedisConnection();

    for (const name of Object.values(QUEUE_NAMES)) {
      queues[name] = new Queue(name, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
    }
  }
  return queues;
}

export function getQueue(name: string): Queue {
  const allQueues = getQueues();
  if (!allQueues[name]) {
    throw new Error(`Queue ${name} not found`);
  }
  return allQueues[name];
}

// Enqueue helper functions
export async function enqueueAsyncAnalysis(job: Omit<AsyncAnalysisJob, never>) {
  const queue = getQueue(QUEUE_NAMES.ASYNC_ANALYSIS);
  await queue.add('analysis', job, {
    jobId: `analysis-${job.eventId}`,
  });
}

export async function enqueueActionRetry(job: Omit<ActionRetryJob, 'attempt'> & { attempt?: number }) {
  const queue = getQueue(QUEUE_NAMES.ACTION_RETRY);
  await queue.add('retry', job, {
    jobId: `retry-${job.action}-${job.chatId}-${job.messageId || 'no-msg'}`,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  });
}

export async function enqueueAuditEvent(job: AuditEventJob) {
  const queue = getQueue(QUEUE_NAMES.AUDIT_EVENTS);
  await queue.add('audit', job, {
    jobId: `audit-${job.groupId}-${job.targetId}-${Date.now()}`,
  });
}

export async function enqueueDomainIntel(job: Omit<DomainIntelJob, never>) {
  const queue = getQueue(QUEUE_NAMES.DOMAIN_INTEL);
  await queue.add('intel', job, {
    jobId: `domain-intel-${job.eventId}`,
  });
}

export async function enqueueRaidCorrelation(job: Omit<RaidCorrelationJob, never>) {
  const queue = getQueue(QUEUE_NAMES.RAID_CORRELATION);
  await queue.add('correlation', job, {
    jobId: `raid-${job.groupId}-${job.detectedAt}`,
  });
}

// Graceful shutdown
export async function closeQueues() {
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
  queues = {};
}