// apps/api/src/services/idempotency.ts
import { redis } from '@togi/db';

export enum UpdateState {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED_RETRIABLE = 'FAILED_RETRIABLE',
  FAILED_FINAL = 'FAILED_FINAL',
}

export class IdempotencyService {
  private readonly UPDATE_TTL_SECONDS = 86400; // 24h
  private readonly ACTION_LOCK_TTL_SECONDS = 300; // 5min

  /**
   * Check if an update has already been processed.
   * Returns the state if already seen, null if new.
   */
  async checkUpdate(updateId: string): Promise<UpdateState | null> {
    const key = `update_state:${updateId}`;
    const state = await redis.get(key);
    if (!state) return null;
    return state as UpdateState;
  }

  /**
   * Atomically try to claim an update for processing.
   * Returns true if we acquired the lock (new or retriable), false if already processed.
   */
  async tryClaimUpdate(updateId: string): Promise<boolean> {
    const key = `update_state:${updateId}`;
    const lockKey = `update_lock:${updateId}`;

    // Try to set to PROCESSING if not exists or if retriable
    const current = await redis.get(key);

    if (current === UpdateState.PROCESSED) return false;
    if (current === UpdateState.FAILED_FINAL) return false;

    // Try to acquire lock
    const acquired = await redis.set(lockKey, process.pid.toString(), 'EX', 30, 'NX');
    if (!acquired) return false; // Another process has the lock

    if (current === UpdateState.FAILED_RETRIABLE) {
      // Re-process retriable
      await redis.set(key, UpdateState.PROCESSING, 'EX', this.UPDATE_TTL_SECONDS);
      return true;
    }

    if (!current) {
      // New update — claim it
      await redis.set(key, UpdateState.PROCESSING, 'EX', this.UPDATE_TTL_SECONDS);
      return true;
    }

    return false;
  }

  /**
   * Mark update as successfully processed.
   */
  async markProcessed(updateId: string): Promise<void> {
    await redis.set(`update_state:${updateId}`, UpdateState.PROCESSED, 'EX', this.UPDATE_TTL_SECONDS);
    await redis.del(`update_lock:${updateId}`);
  }

  /**
   * Mark update as retriable failure (e.g. Telegram API temporarily failed).
   */
  async markFailedRetriable(updateId: string): Promise<void> {
    await redis.set(`update_state:${updateId}`, UpdateState.FAILED_RETRIABLE, 'EX', this.UPDATE_TTL_SECONDS);
    await redis.del(`update_lock:${updateId}`);
  }

  /**
   * Mark update as final failure (no more retries).
   */
  async markFailedFinal(updateId: string): Promise<void> {
    await redis.set(`update_state:${updateId}`, UpdateState.FAILED_FINAL, 'EX', this.UPDATE_TTL_SECONDS);
    await redis.del(`update_lock:${updateId}`);
  }

  /**
   * Action lock: prevents duplicate destructive Telegram actions.
   * Key: action_lock:{chatId}:{messageId}:{actionType}
   * Returns true if lock acquired (action should proceed), false if duplicate.
   */
  async tryLockAction(chatId: number, messageId: number, actionType: string): Promise<boolean> {
    const key = `action_lock:${chatId}:${messageId}:${actionType}`;
    const result = await redis.set(key, '1', 'EX', this.ACTION_LOCK_TTL_SECONDS, 'NX');
    return result === 'OK';
  }

  /**
   * Release action lock (e.g. if action failed and should be retryable).
   */
  async unlockAction(chatId: number, messageId: number, actionType: string): Promise<void> {
    const key = `action_lock:${chatId}:${messageId}:${actionType}`;
    await redis.del(key);
  }
}

export const idempotencyService = new IdempotencyService();