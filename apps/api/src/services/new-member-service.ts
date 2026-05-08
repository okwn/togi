// New Member Service
// Handles probation state, verification challenges, and join tracking

import { redis, keys } from '@togi/db';
import { getMutePresetDuration } from '@togi/telegram-client';

export interface ProbationInfo {
  userId: number;
  chatId: number;
  joinedAt: number;
  probationUntil: number;
  verified: boolean;
}

export interface RaidState {
  active: boolean;
  startedAt: number;
  reason: string;
  expiresAt: number;
  triggerStats: {
    joins: number;
    messages: number;
    links: number;
    newUsersLinks: number;
    mentions: number;
  };
}

const PROBATION_TTL = 60 * 60 * 24; // 24 hours max
const VERIFY_CHALLENGE_TTL = 5 * 60; // 5 minutes to verify
const RAID_STATE_TTL = 60 * 60; // 1 hour max

/**
 * Check if a user is in probation for a chat
 */
export async function isUserInProbation(
  chatId: number,
  userId: number
): Promise<boolean> {
  const key = keys.probation(chatId, userId);
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Get probation info for a user
 */
export async function getProbationInfo(
  chatId: number,
  userId: number
): Promise<ProbationInfo | null> {
  const key = keys.probation(chatId, userId);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as ProbationInfo;
  } catch {
    return null;
  }
}

/**
 * Set user in probation
 */
export async function setUserInProbation(
  chatId: number,
  userId: number,
  probationMinutes: number
): Promise<void> {
  const key = keys.probation(chatId, userId);
  const now = Date.now();
  const probationUntil = now + probationMinutes * 60 * 1000;

  const info: ProbationInfo = {
    userId,
    chatId,
    joinedAt: now,
    probationUntil,
    verified: false,
  };

  await redis.setex(key, PROBATION_TTL, JSON.stringify(info));
}

/**
 * Mark user as verified
 */
export async function markUserVerified(
  chatId: number,
  userId: number
): Promise<void> {
  const key = keys.probation(chatId, userId);
  const data = await redis.get(key);

  if (data) {
    const info = JSON.parse(data) as ProbationInfo;
    info.verified = true;
    await redis.setex(key, PROBATION_TTL, JSON.stringify(info));
  }

  // Also set a verified key for quick lookup
  const verifiedKey = keys.verified(chatId, userId);
  await redis.setex(verifiedKey, PROBATION_TTL, '1');
}

/**
 * Check if user is verified
 */
export async function isUserVerified(
  chatId: number,
  userId: number
): Promise<boolean> {
  const key = keys.verified(chatId, userId);
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Create verification challenge
 */
export async function createVerifyChallenge(
  chatId: number,
  userId: number
): Promise<string> {
  const key = keys.verifyChallenge(chatId, userId);
  const challenge = `verify_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await redis.setex(key, VERIFY_CHALLENGE_TTL, challenge);
  return challenge;
}

/**
 * Get verification challenge
 */
export async function getVerifyChallenge(
  chatId: number,
  userId: number
): Promise<string | null> {
  const key = keys.verifyChallenge(chatId, userId);
  return redis.get(key);
}

/**
 * Remove verification challenge (after verification)
 */
export async function removeVerifyChallenge(
  chatId: number,
  userId: number
): Promise<void> {
  const key = keys.verifyChallenge(chatId, userId);
  await redis.del(key);
}

/**
 * Record a join for spike detection
 */
export async function recordJoin(
  chatId: number,
  config: { threshold: number; windowSeconds: number }
): Promise<{ isSpike: boolean; count: number }> {
  const key = keys.joinSpike(chatId);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  // Remove old entries and count recent joins
  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  // Add this join
  await redis.zadd(key, now, `${now}_${Math.random().toString(36).slice(2)}`);
  await redis.expire(key, config.windowSeconds + 10);

  return {
    isSpike: count + 1 >= config.threshold,
    count: count + 1,
  };
}

/**
 * Get raid state for a chat
 */
export async function getRaidState(chatId: number): Promise<RaidState | null> {
  const key = keys.raidState(chatId);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    const state = JSON.parse(data) as RaidState;
    // Check if expired
    if (state.expiresAt < Date.now()) {
      await redis.del(key);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * Activate raid state
 */
export async function activateRaidState(
  chatId: number,
  reason: string,
  lockdownMinutes: number,
  triggerStats: RaidState['triggerStats']
): Promise<void> {
  const key = keys.raidState(chatId);
  const now = Date.now();

  const state: RaidState = {
    active: true,
    startedAt: now,
    reason,
    expiresAt: now + lockdownMinutes * 60 * 1000,
    triggerStats,
  };

  await redis.setex(key, RAID_STATE_TTL, JSON.stringify(state));
}

/**
 * Deactivate raid state (manual unlock)
 */
export async function deactivateRaidState(chatId: number): Promise<void> {
  const key = keys.raidState(chatId);
  await redis.del(key);
}

/**
 * Check if chat is in lockdown
 */
export async function isChatInLockdown(chatId: number): Promise<boolean> {
  const key = keys.lockdown(chatId);
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Set lockdown state
 */
export async function setLockdown(
  chatId: number,
  lockdownMinutes: number
): Promise<void> {
  const key = keys.lockdown(chatId);
  await redis.setex(key, lockdownMinutes * 60, JSON.stringify({
    startedAt: Date.now(),
    duration: lockdownMinutes * 60 * 1000,
  }));
}

/**
 * Remove lockdown state
 */
export async function removeLockdown(chatId: number): Promise<void> {
  const key = keys.lockdown(chatId);
  await redis.del(key);
}

/**
 * Remove user from probation
 */
export async function removeProbation(
  chatId: number,
  userId: number
): Promise<void> {
  const key = keys.probation(chatId, userId);
  await redis.del(key);

  const verifiedKey = keys.verified(chatId, userId);
  await redis.del(verifiedKey);
}
