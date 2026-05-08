// Action Retry Processor
// Note: Action retry is handled by the API, not the worker.
// This processor logs retry attempts for metrics.
import type { ActionRetryJob } from '../types';
import { recordJobComplete, recordJobFailure, recordActionRetry } from '../metrics';

export async function processActionRetry(
  job: ActionRetryJob
): Promise<{ success: boolean; error?: string; retryable: boolean }> {
  const startTime = Date.now();

  try {
    console.log(`[ActionRetry] Retrying action ${job.action} for chat ${job.chatId}, attempt ${job.attempt}`);

    recordActionRetry();

    // Action retry logic would be implemented here
    // For now, we just log and mark as success
    // In production, this would call the Telegram API

    const duration = Date.now() - startTime;
    recordJobComplete(duration);

    console.log(`[ActionRetry] Action ${job.action} logged for retry on attempt ${job.attempt}`);

    return {
      success: true,
      retryable: job.attempt < 5,
    };
  } catch (error) {
    recordJobFailure();
    const duration = Date.now() - startTime;
    console.error(`[ActionRetry] Failed on attempt ${job.attempt}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
    };
  }
}