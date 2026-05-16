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

  // Lua script for atomic claim update
  // Returns: 1 = claimed, 0 = already processed/failed, -1 = lock held by another
  private readonly CLAIM_UPDATE_SCRIPT = `
    local stateKey = KEYS[1]
    local lockKey = KEYS[2]
    local ttl = tonumber(ARGV[1])
    local processedState = ARGV[2]
    local failedFinalState = ARGV[3]
    local failedRetriableState = ARGV[4]
    local processingState = ARGV[5]
    local pid = ARGV[6]

    local current = redis.call('GET', stateKey)

    if current == processedState then
      return 0
    end

    if current == failedFinalState then
      return 0
    end

    local lockAcquired = redis.call('SET', lockKey, pid, 'EX', 30, 'NX')
    if not lockAcquired then
      return -1
    end

    if current == failedRetriableState then
      redis.call('SET', stateKey, processingState, 'EX', ttl)
      return 1
    end

    if not current then
      redis.call('SET', stateKey, processingState, 'EX', ttl)
      return 1
    end

    return 0
  `;

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
    const stateKey = `update_state:${updateId}`;
    const lockKey = `update_lock:${updateId}`;

    // Use Lua script for atomicity - prevents race condition window
    const result = await redis.eval(
      this.CLAIM_UPDATE_SCRIPT,
      2,
      stateKey,
      lockKey,
      this.UPDATE_TTL_SECONDS,
      UpdateState.PROCESSED,
      UpdateState.FAILED_FINAL,
      UpdateState.FAILED_RETRIABLE,
      UpdateState.PROCESSING,
      process.pid.toString()
    );

    // result: 1 = claimed, 0 = already processed/failed, -1 = lock held
    return result === 1;
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