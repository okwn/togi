// Duplicate detector - detects repeated messages
// Rules:
// - Same text hash within 120 seconds: +35
// - Same user repeats same message 3 times: +50

import { DetectionResult, DetectionLabel, Severity } from '../types.js';
import { keys, redis } from '@togi/db';
import type { RedisClient } from '@togi/db';
import { hashText } from '../text-normalizer.js';

export interface DuplicateConfig {
  windowSeconds: number;
  maxRepeats: number;
  hashScore: number;
  repeatScore: number;
}

const DEFAULT_CONFIG: DuplicateConfig = {
  windowSeconds: 120,
  maxRepeats: 3,
  hashScore: 35,
  repeatScore: 50,
};

export interface DuplicateResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  isDuplicate: boolean;
  repeatCount: number;
  textHash: string;
}

export async function checkDuplicate(
  chatId: string,
  userId: string,
  text: string | undefined,
  messageId: number | undefined,
  config: DuplicateConfig = DEFAULT_CONFIG,
  redisClient: RedisClient = redis
): Promise<DuplicateResult> {
  const result: DuplicateResult = {
    score: 0,
    level: 'NONE',
    isDuplicate: false,
    repeatCount: 0,
    textHash: '',
  };

  if (!text) {
    return result;
  }

  try {
    const textHash = hashText(text);
    result.textHash = textHash;

    const duplicateKey = keys.duplicate(chatId, textHash);

    // Check for existing duplicate entry
    const existing = await redisClient.get(duplicateKey);

    if (existing) {
      const data = JSON.parse(existing);
      const age = Date.now() - data.timestamp;

      if (age < config.windowSeconds * 1000) {
        result.isDuplicate = true;
        result.repeatCount = data.count || 1;

        // Same text hash within window: +35
        result.score += config.hashScore;

        // Same user repeats 3 times: additional +50
        if (data.userId === userId && result.repeatCount >= config.maxRepeats) {
          result.score += config.repeatScore;
        }

        // Increment repeat count
        data.count = (data.count || 1) + 1;
        await redisClient.setex(
          duplicateKey,
          config.windowSeconds,
          JSON.stringify(data)
        );
      }
    } else {
      // First occurrence
      await redisClient.setex(
        duplicateKey,
        config.windowSeconds,
        JSON.stringify({
          userId,
          messageId,
          textHash,
          timestamp: Date.now(),
          count: 1,
        })
      );
    }

    // Determine level
    if (result.score >= 50) {
      result.level = 'HIGH';
    } else if (result.score >= 35) {
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

export function duplicateToDetection(
  duplicateResult: DuplicateResult
): Partial<DetectionResult> {
  if (duplicateResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['DUPLICATE'];

  return {
    riskScore: duplicateResult.score,
    labels,
    severity: duplicateResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
    recommendedAction: duplicateResult.level === 'HIGH' ? 'DELETE_MUTE' : 'DELETE',
    reasons: [
      duplicateResult.repeatCount > 1
        ? `Message repeated ${duplicateResult.repeatCount} times`
        : 'Duplicate message detected',
    ],
    fastPath: true,
  };
}
