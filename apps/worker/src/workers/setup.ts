// Worker setup and registration
import { Worker } from 'bullmq';
import { createRedisConnection, QUEUE_NAMES, QUEUE_CONFIGS, DEFAULT_JOB_OPTIONS } from '../queues/connection';
import { processAsyncAnalysis } from '../processors/async-analysis';
import { processActionRetry } from '../processors/action-retry';
import { processAuditEvent } from '../processors/audit-event';
import { processDomainIntel } from '../processors/domain-intel';
import { processRaidCorrelation } from '../processors/raid-correlation';
import type { AsyncAnalysisJob, ActionRetryJob, AuditEventJob, DomainIntelJob, RaidCorrelationJob } from '../types';

// Worker instances
let workers: Record<string, Worker> = {};

export function createWorkers(): Record<string, Worker> {
  const connection = createRedisConnection();

  // Async Analysis Worker
  const asyncAnalysisWorker = new Worker(
    QUEUE_NAMES.ASYNC_ANALYSIS,
    async (job) => {
      const data = job.data as AsyncAnalysisJob;
      return await processAsyncAnalysis(data);
    },
    {
      connection,
      concurrency: QUEUE_CONFIGS[QUEUE_NAMES.ASYNC_ANALYSIS].concurrency,
      limiter: QUEUE_CONFIGS[QUEUE_NAMES.ASYNC_ANALYSIS].limiter,
    }
  );

  asyncAnalysisWorker.on('completed', (job) => {
    console.log(`[Worker] AsyncAnalysis job ${job.id} completed`);
  });

  asyncAnalysisWorker.on('failed', (job, err) => {
    console.error(`[Worker] AsyncAnalysis job ${job?.id} failed:`, err.message);
  });

  // Action Retry Worker
  const actionRetryWorker = new Worker(
    QUEUE_NAMES.ACTION_RETRY,
    async (job) => {
      const data = job.data as ActionRetryJob;
      // In real impl, pass bot instance through worker context
      console.log(`[Worker] Processing action retry for ${data.action}`);
      return { success: true };
    },
    {
      connection,
      concurrency: QUEUE_CONFIGS[QUEUE_NAMES.ACTION_RETRY].concurrency,
    }
  );

  actionRetryWorker.on('completed', (job) => {
    console.log(`[Worker] ActionRetry job ${job.id} completed`);
  });

  actionRetryWorker.on('failed', (job, err) => {
    console.error(`[Worker] ActionRetry job ${job?.id} failed:`, err.message);
  });

  // Audit Events Worker
  const auditEventsWorker = new Worker(
    QUEUE_NAMES.AUDIT_EVENTS,
    async (job) => {
      const data = job.data as AuditEventJob;
      return await processAuditEvent(data);
    },
    {
      connection,
      concurrency: QUEUE_CONFIGS[QUEUE_NAMES.AUDIT_EVENTS].concurrency,
    }
  );

  auditEventsWorker.on('completed', (job) => {
    console.log(`[Worker] AuditEvent job ${job.id} completed`);
  });

  auditEventsWorker.on('failed', (job, err) => {
    console.error(`[Worker] AuditEvent job ${job?.id} failed:`, err.message);
  });

  // Domain Intel Worker
  const domainIntelWorker = new Worker(
    QUEUE_NAMES.DOMAIN_INTEL,
    async (job) => {
      const data = job.data as DomainIntelJob;
      return await processDomainIntel(data);
    },
    {
      connection,
      concurrency: QUEUE_CONFIGS[QUEUE_NAMES.DOMAIN_INTEL].concurrency,
      limiter: QUEUE_CONFIGS[QUEUE_NAMES.DOMAIN_INTEL].limiter,
    }
  );

  domainIntelWorker.on('completed', (job) => {
    console.log(`[Worker] DomainIntel job ${job.id} completed`);
  });

  domainIntelWorker.on('failed', (job, err) => {
    console.error(`[Worker] DomainIntel job ${job?.id} failed:`, err.message);
  });

  // Raid Correlation Worker
  const raidCorrelationWorker = new Worker(
    QUEUE_NAMES.RAID_CORRELATION,
    async (job) => {
      const data = job.data as RaidCorrelationJob;
      return await processRaidCorrelation(data, {
        enabled: true,
        joinWindowSeconds: 60,
        maxJoins: 10,
        autoLockdown: true,
      });
    },
    {
      connection,
      concurrency: QUEUE_CONFIGS[QUEUE_NAMES.RAID_CORRELATION].concurrency,
    }
  );

  raidCorrelationWorker.on('completed', (job) => {
    console.log(`[Worker] RaidCorrelation job ${job.id} completed`);
  });

  raidCorrelationWorker.on('failed', (job, err) => {
    console.error(`[Worker] RaidCorrelation job ${job?.id} failed:`, err.message);
  });

  workers = {
    [QUEUE_NAMES.ASYNC_ANALYSIS]: asyncAnalysisWorker,
    [QUEUE_NAMES.ACTION_RETRY]: actionRetryWorker,
    [QUEUE_NAMES.AUDIT_EVENTS]: auditEventsWorker,
    [QUEUE_NAMES.DOMAIN_INTEL]: domainIntelWorker,
    [QUEUE_NAMES.RAID_CORRELATION]: raidCorrelationWorker,
  };

  return workers;
}

export async function closeWorkers(): Promise<void> {
  for (const [name, worker] of Object.entries(workers)) {
    console.log(`[Worker] Closing ${name} worker...`);
    await worker.close();
  }
  workers = {};
}

export function getWorkers(): Record<string, Worker> {
  return workers;
}

export function logQueueHealth(): void {
  console.log('\n=== Queue Health ===');
  console.log(`Workers running: ${Object.keys(workers).length}`);
  console.log('Queue statuses:');
  for (const [name, worker] of Object.entries(workers)) {
    console.log(`  ${name}: ${worker.name}`);
  }
  console.log('====================\n');
}