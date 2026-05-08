// Raid signal detector - detects mass join attacks
// Rules:
// - Multiple joins in short window triggers raid mode
// - Enabled by policy configuration

import { DetectionResult, DetectionLabel, Severity } from '../types.js';
import { keys, redis } from '@togi/db';
import type { RedisClient } from '@togi/db';

export interface RaidConfig {
  enabled: boolean;
  joinWindowSeconds: number;
  maxJoinsPerWindow: number;
  joinScore: number;
  raidScore: number;
  alertAdmins: boolean;
  autoProtect: boolean;
}

const DEFAULT_CONFIG: RaidConfig = {
  enabled: true,
  joinWindowSeconds: 60,
  maxJoinsPerWindow: 15,
  joinScore: 30,
  raidScore: 80,
  alertAdmins: true,
  autoProtect: true,
};

export interface RaidState {
  joinCount: number;
  windowStart: number;
  isRaid: boolean;
  detected: boolean;
}

export interface RaidResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  joinCount: number;
  isRaid: boolean;
  windowStart: number;
}

export async function checkRaidJoin(
  chatId: string,
  redisClient: RedisClient = redis,
  config: RaidConfig = DEFAULT_CONFIG
): Promise<RaidResult> {
  const result: RaidResult = {
    score: 0,
    level: 'NONE',
    joinCount: 0,
    isRaid: false,
    windowStart: 0,
  };

  if (!config.enabled) {
    return result;
  }

  try {
    const key = keys.raidState(chatId);
    const now = Date.now();

    // Get current raid state
    const data = await redisClient.get(key);

    if (data) {
      const state = JSON.parse(data) as RaidState;
      const windowAge = (now - state.windowStart) / 1000;

      // Check if we're still in the detection window
      if (windowAge < config.joinWindowSeconds) {
        // Increment join count
        state.joinCount += 1;
        result.joinCount = state.joinCount;
        result.windowStart = state.windowStart;

        // Check for raid conditions
        if (state.joinCount >= config.maxJoinsPerWindow) {
          state.isRaid = true;
          result.isRaid = true;
          result.score = config.raidScore;
        } else if (state.joinCount >= config.maxJoinsPerWindow / 2) {
          // Partial detection
          result.score = config.joinScore;
        }

        // Update state
        await redisClient.setex(key, config.joinWindowSeconds, JSON.stringify(state));
      } else {
        // Window expired, reset
        const newState: RaidState = {
          joinCount: 1,
          windowStart: now,
          isRaid: false,
          detected: false,
        };
        result.windowStart = now;
        result.joinCount = 1;
        await redisClient.setex(key, config.joinWindowSeconds, JSON.stringify(newState));
      }
    } else {
      // First join in window
      const newState: RaidState = {
        joinCount: 1,
        windowStart: now,
        isRaid: false,
        detected: false,
      };
      result.windowStart = now;
      result.joinCount = 1;
      await redisClient.setex(key, config.joinWindowSeconds, JSON.stringify(newState));
    }

    // Determine level
    if (result.isRaid) {
      result.level = 'CRITICAL';
    } else if (result.score >= 30) {
      result.level = 'MEDIUM';
    } else if (result.score > 0) {
      result.level = 'LOW';
    }

    return result;
  } catch (error) {
    // Fail open
    return result;
  }
}

export async function isRaidActive(
  chatId: string,
  redisClient: RedisClient = redis
): Promise<boolean> {
  try {
    const key = keys.raidState(chatId);
    const data = await redisClient.get(key);

    if (!data) return false;

    const state = JSON.parse(data) as RaidState;
    return state.isRaid && state.detected;
  } catch {
    return false;
  }
}

export function raidToDetection(raidResult: RaidResult): Partial<DetectionResult> {
  if (raidResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['RAID_SIGNAL'];

  return {
    riskScore: raidResult.score,
    labels,
    severity: raidResult.isRaid ? 'CRITICAL' : 'MEDIUM',
    recommendedAction: raidResult.isRaid ? 'DELETE_BAN' : 'DELETE_WARN',
    reasons: [
      raidResult.isRaid
        ? `RAID DETECTED: ${raidResult.joinCount} joins in window`
        : `${raidResult.joinCount} joins in detection window`,
    ],
    fastPath: true,
  };
}
