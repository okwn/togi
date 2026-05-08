// Rate limit detector - detects message floods
// Rules:
// - 4+ messages in 5 seconds: +30
// - 7+ messages in 10 seconds: +45
// - 15+ messages in 60 seconds: +60

import { DetectionResult, DetectionLabel, Severity } from '../types.js';
import { keys, redis } from '@togi/db';
import type { RedisClient } from '@togi/db';

export interface RateLimitConfig {
  maxMessagesShort: number;   // 4+ in 5s
  windowShortSeconds: number;
  maxMessagesMedium: number; // 7+ in 10s
  windowMediumSeconds: number;
  maxMessagesLong: number;   // 15+ in 60s
  windowLongSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxMessagesShort: 4,
  windowShortSeconds: 5,
  maxMessagesMedium: 7,
  windowMediumSeconds: 10,
  maxMessagesLong: 15,
  windowLongSeconds: 60,
};

export interface RateLimitResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageCount: number;
  windowSize: number;
}

export async function checkRateLimit(
  chatId: string,
  userId: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
  redisClient: RedisClient = redis
): Promise<RateLimitResult> {
  const result: RateLimitResult = {
    score: 0,
    level: 'NONE',
    messageCount: 0,
    windowSize: 0,
  };

  try {
    const key = keys.rate(chatId, userId);

    // Get current rate data from Redis
    const data = await redisClient.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      // First message, initialize
      await redisClient.hset(key, {
        count: '1',
        firstTime: Date.now().toString(),
        lastTime: Date.now().toString(),
      });
      await redisClient.expire(key, config.windowLongSeconds);
      return result;
    }

    const count = parseInt(data.count || '0', 10);
    const firstTime = parseInt(data.firstTime || '0', 10);
    const lastTime = parseInt(data.lastTime || '0', 10);
    const now = Date.now();

    // Calculate windows
    const shortWindow = (now - firstTime) / 1000;

    // Check short window (5 seconds)
    if (shortWindow <= config.windowShortSeconds) {
      if (count >= config.maxMessagesShort) {
        result.score += 30;
        result.messageCount = count;
        result.windowSize = shortWindow;
      }
    }

    // Check medium window (10 seconds)
    if (shortWindow <= config.windowMediumSeconds) {
      if (count >= config.maxMessagesMedium) {
        result.score += 45;
        result.messageCount = count;
        result.windowSize = shortWindow;
      }
    }

    // Check long window (60 seconds)
    const longWindow = (now - firstTime) / 1000;
    if (longWindow <= config.windowLongSeconds) {
      if (count >= config.maxMessagesLong) {
        result.score += 60;
        result.messageCount = count;
        result.windowSize = longWindow;
      }
    }

    // Increment counter
    await redisClient.hincrby(key, 'count', 1);
    await redisClient.hset(key, 'lastTime', now.toString());
    await redisClient.expire(key, config.windowLongSeconds);

    // Determine level
    if (result.score >= 60) {
      result.level = 'CRITICAL';
    } else if (result.score >= 45) {
      result.level = 'HIGH';
    } else if (result.score >= 30) {
      result.level = 'MEDIUM';
    } else if (result.score > 0) {
      result.level = 'LOW';
    }

    return result;
  } catch (error) {
    // Fail open - don't block on Redis errors
    return result;
  }
}

export function rateLimitToDetection(
  rateLimitResult: RateLimitResult
): Partial<DetectionResult> {
  if (rateLimitResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['FLOOD'];
  const severityMap: Record<string, Severity> = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  };

  const actionMap: Record<string, string> = {
    LOW: 'LOG',
    MEDIUM: 'DELETE',
    HIGH: 'DELETE_WARN',
    CRITICAL: 'DELETE_MUTE',
  };

  return {
    riskScore: rateLimitResult.score,
    labels,
    severity: severityMap[rateLimitResult.level] || 'MEDIUM',
    recommendedAction: actionMap[rateLimitResult.level] as DetectionResult['recommendedAction'],
    reasons: [
      `${rateLimitResult.messageCount} messages in ${Math.round(rateLimitResult.windowSize)}s`,
    ],
    fastPath: true,
  };
}
