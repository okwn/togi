// Raid Correlation - Detect coordinated raid attacks
import type { RaidCorrelationJob, RaidSignal, AISeverity } from '../types';

// Detect raid based on multiple signals
export function detectRaid(
  joinEvents: { userId: string; timestamp: number }[],
  joinWindowSeconds: number,
  maxJoins: number,
  duplicateMessageCount: number,
  repeatedDomainCount: number,
  newUserViolationCount: number
): { isRaid: boolean; severity: AISeverity } {
  // Check join spike
  const now = Date.now();
  const recentJoins = joinEvents.filter(
    (e) => now - e.timestamp < joinWindowSeconds * 1000
  );

  const joinSpike = recentJoins.length > maxJoins;

  // Calculate severity based on multiple factors
  let severityScore = 0;

  if (joinSpike) {
    severityScore += (recentJoins.length / maxJoins) * 30;
  }

  if (duplicateMessageCount > 5) {
    severityScore += Math.min(25, duplicateMessageCount * 2);
  }

  if (repeatedDomainCount > 3) {
    severityScore += Math.min(20, repeatedDomainCount * 3);
  }

  if (newUserViolationCount > 2) {
    severityScore += Math.min(25, newUserViolationCount * 5);
  }

  // Determine severity
  let severity: AISeverity = 'LOW';
  if (severityScore >= 60) {
    severity = 'CRITICAL';
  } else if (severityScore >= 40) {
    severity = 'HIGH';
  } else if (severityScore >= 20) {
    severity = 'MEDIUM';
  }

  return {
    isRaid: severityScore >= 20,
    severity,
  };
}

// Create raid signal
export function createRaidSignal(
  job: RaidCorrelationJob,
  options: {
    joinWindowSeconds: number;
    maxJoins: number;
    duplicateMessageCount: number;
    repeatedDomainCount: number;
    newUserViolationCount: number;
  }
): RaidSignal | null {
  const { isRaid, severity } = detectRaid(
    job.joinEvents,
    options.joinWindowSeconds,
    options.maxJoins,
    options.duplicateMessageCount,
    options.repeatedDomainCount,
    options.newUserViolationCount
  );

  if (!isRaid) {
    return null;
  }

  return {
    groupId: job.groupId,
    chatId: job.chatId,
    joinCount: job.joinEvents.length,
    joinWindowSeconds: options.joinWindowSeconds,
    duplicateMessageCount: options.duplicateMessageCount,
    repeatedDomainCount: options.repeatedDomainCount,
    newUserViolationCount: options.newUserViolationCount,
    severity,
    recommendedAction: severity === 'CRITICAL' ? 'LOCKDOWN' : 'ALERT',
    detectedAt: job.detectedAt,
  };
}

// Check if auto-lockdown should be triggered
export function shouldAutoLockdown(
  signal: RaidSignal,
  raidProtectionConfig: {
    enabled: boolean;
    autoLockdown: boolean;
  }
): boolean {
  return raidProtectionConfig.enabled && raidProtectionConfig.autoLockdown && signal.recommendedAction === 'LOCKDOWN';
}

// Track joins for raid detection
export async function trackJoins(
  groupId: string,
  userId: string,
  redisClient: { zadd: (key: string, score: number, member: string) => Promise<number>; zremrangebyscore: (key: string, min: number, max: number) => Promise<number>; zrange: (key: string, start: number, stop: number) => Promise<string[]> }
): Promise<number> {
  const key = `raid_joins:${groupId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  // Remove old entries
  await redisClient.zremrangebyscore(key, 0, now - windowMs);

  // Add new join
  await redisClient.zadd(key, now, `${userId}:${now}`);

  // Count recent joins
  const members = await redisClient.zrange(key, 0, -1);
  return members.length;
}

// Get recent join count
export async function getRecentJoinCount(
  groupId: string,
  redisClient: { zrange: (key: string, start: number, stop: number) => Promise<string[]> }
): Promise<number> {
  const key = `raid_joins:${groupId}`;
  const members = await redisClient.zrange(key, 0, -1);
  return members.length;
}