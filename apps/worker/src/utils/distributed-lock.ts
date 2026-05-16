// Distributed lock utility for multi-instance deployment
import { redis } from '@togi/db';

const SCHEDULED_JOB_LOCK_TTL = 300; // 5 minutes
const AGENT_RUN_LOCK_TTL = 600; // 10 minutes

/**
 * Acquire a distributed lock for scheduled jobs.
 * Prevents duplicate execution across multiple instances.
 *
 * @param jobName - Unique identifier for the job
 * @param ttlSeconds - Lock TTL (default 300s)
 * @returns true if lock acquired, false if already held by another instance
 */
export async function acquireScheduledJobLock(
  jobName: string,
  ttlSeconds: number = SCHEDULED_JOB_LOCK_TTL
): Promise<boolean> {
  const key = `scheduled_lock:${jobName}`;
  const result = await redis.set(key, process.pid.toString(), 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release a distributed lock for scheduled jobs.
 * Should be called in finally block after job completes.
 *
 * @param jobName - Unique identifier for the job
 */
export async function releaseScheduledJobLock(jobName: string): Promise<void> {
  const key = `scheduled_lock:${jobName}`;
  await redis.del(key);
}

/**
 * Extend the TTL of an existing lock.
 * Use when a job takes longer than expected.
 *
 * @param jobName - Unique identifier for the job
 * @param additionalSeconds - Seconds to add to lock TTL
 * @returns true if lock exists and was extended
 */
export async function extendScheduledJobLock(
  jobName: string,
  additionalSeconds: number = SCHEDULED_JOB_LOCK_TTL
): Promise<boolean> {
  const key = `scheduled_lock:${jobName}`;
  const current = await redis.get(key);
  if (current === process.pid.toString()) {
    await redis.expire(key, additionalSeconds);
    return true;
  }
  return false;
}

/**
 * Acquire a lock for agent run execution.
 * Prevents multiple instances from running agent analysis for same group.
 *
 * @param groupId - Group UUID
 * @param ttlSeconds - Lock TTL (default 600s)
 * @returns true if lock acquired
 */
export async function acquireAgentRunLock(
  groupId: string,
  ttlSeconds: number = AGENT_RUN_LOCK_TTL
): Promise<boolean> {
  const key = `agent_run_lock:${groupId}`;
  const result = await redis.set(key, process.pid.toString(), 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release an agent run lock.
 *
 * @param groupId - Group UUID
 */
export async function releaseAgentRunLock(groupId: string): Promise<void> {
  const key = `agent_run_lock:${groupId}`;
  await redis.del(key);
}

/**
 * Execute a scheduled job with distributed lock protection.
 *
 * @param jobName - Unique identifier for the job
 * @param fn - Async function to execute
 * @param options - Configuration options
 */
export async function withScheduledJobLock<T>(
  jobName: string,
  fn: () => Promise<T>,
  options: { lockTTL?: number; extendOnProgress?: boolean } = {}
): Promise<{ executed: boolean; result?: T; error?: Error }> {
  const lockTTL = options.lockTTL ?? SCHEDULED_JOB_LOCK_TTL;

  const lockAcquired = await acquireScheduledJobLock(jobName, lockTTL);
  if (!lockAcquired) {
    return { executed: false };
  }

  try {
    const result = await fn();
    return { executed: true, result };
  } catch (error) {
    return { executed: true, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    await releaseScheduledJobLock(jobName);
  }
}

/**
 * Execute agent run with distributed lock protection.
 */
export async function withAgentRunLock<T>(
  groupId: string,
  fn: () => Promise<T>,
  options: { lockTTL?: number } = {}
): Promise<{ executed: boolean; result?: T; error?: Error }> {
  const lockTTL = options.lockTTL ?? AGENT_RUN_LOCK_TTL;

  const lockAcquired = await acquireAgentRunLock(groupId, lockTTL);
  if (!lockAcquired) {
    return { executed: false };
  }

  try {
    const result = await fn();
    return { executed: true, result };
  } catch (error) {
    return { executed: true, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    await releaseAgentRunLock(groupId);
  }
}