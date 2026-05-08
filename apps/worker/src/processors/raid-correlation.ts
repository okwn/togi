// Raid Correlation Processor
import type { RaidCorrelationJob } from '../types';
import { createRaidSignal, shouldAutoLockdown } from '../raid/correlator';
import { recordJobComplete, recordJobFailure, recordRaidSignal } from '../metrics';
import { enqueueAuditEvent } from '../queues';

export async function processRaidCorrelation(
  job: RaidCorrelationJob,
  raidProtectionConfig: {
    enabled: boolean;
    joinWindowSeconds: number;
    maxJoins: number;
    autoLockdown: boolean;
  }
): Promise<{ signal: Awaited<ReturnType<typeof createRaidSignal>>; lockdownTriggered: boolean }> {
  const startTime = Date.now();

  try {
    console.log(`[RaidCorrelation] Processing raid correlation for group ${job.groupId}, ${job.joinEvents.length} joins`);

    const signal = createRaidSignal(job, {
      joinWindowSeconds: raidProtectionConfig.joinWindowSeconds,
      maxJoins: raidProtectionConfig.maxJoins,
      duplicateMessageCount: 0, // These would be passed in real implementation
      repeatedDomainCount: 0,
      newUserViolationCount: 0,
    });

    if (!signal) {
      const duration = Date.now() - startTime;
      recordJobComplete(duration);
      console.log(`[RaidCorrelation] No raid detected for group ${job.groupId}`);
      return { signal: null, lockdownTriggered: false };
    }

    recordRaidSignal();

    // Determine if lockdown should be triggered
    const lockdownTriggered = shouldAutoLockdown(signal, raidProtectionConfig);

    if (lockdownTriggered) {
      console.log(`[RaidCorrelation] RAID ALERT: Auto-lockdown triggered for group ${job.groupId}`);

      // Enqueue audit event for lockdown
      await enqueueAuditEvent({
        groupId: job.groupId,
        actorTelegramUserId: 0, // System action
        action: 'AUTO_LOCKDOWN',
        targetType: 'GROUP',
        targetId: job.chatId,
        metadata: {
          reason: 'Raid detected - auto lockdown triggered',
          signal: signal,
        },
      });
    }

    const duration = Date.now() - startTime;
    recordJobComplete(duration);

    console.log(
      `[RaidCorrelation] Raid detected - severity: ${signal.severity}, action: ${signal.recommendedAction}, lockdown: ${lockdownTriggered}`
    );

    return { signal, lockdownTriggered };
  } catch (error) {
    recordJobFailure();
    const duration = Date.now() - startTime;
    console.error(`[RaidCorrelation] Failed:`, error);
    throw error;
  }
}