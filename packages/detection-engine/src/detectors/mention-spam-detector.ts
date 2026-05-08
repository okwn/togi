// Mention spam detector - detects excessive mentions
// Rules:
// - 5+ mentions: +35
// - 10+ mentions: +60

import { DetectionResult, DetectionLabel, Severity } from '../types.js';

export interface MentionConfig {
  enabled: boolean;
  softLimit: number;  // 5 mentions
  softScore: number;
  hardLimit: number;  // 10 mentions
  hardScore: number;
}

const DEFAULT_CONFIG: MentionConfig = {
  enabled: true,
  softLimit: 5,
  softScore: 35,
  hardLimit: 10,
  hardScore: 60,
};

export interface MentionResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  mentionCount: number;
  mentionedUsers: string[];
}

export function checkMentionSpam(
  mentions: string[],
  config: MentionConfig = DEFAULT_CONFIG
): MentionResult {
  const result: MentionResult = {
    score: 0,
    level: 'NONE',
    mentionCount: mentions.length,
    mentionedUsers: [...new Set(mentions)].filter(Boolean),
  };

  if (!config.enabled || mentions.length === 0) {
    return result;
  }

  // Check soft limit
  if (mentions.length >= config.softLimit) {
    result.score += config.softScore;
  }

  // Check hard limit
  if (mentions.length >= config.hardLimit) {
    result.score += config.hardScore;
  }

  // Determine level
  if (result.score >= 60) {
    result.level = 'HIGH';
  } else if (result.score >= 35) {
    result.level = 'MEDIUM';
  } else if (result.score > 0) {
    result.level = 'LOW';
  }

  return result;
}

export function mentionToDetection(mentionResult: MentionResult): Partial<DetectionResult> {
  if (mentionResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  return {
    riskScore: mentionResult.score,
    labels: ['MENTION_SPAM'],
    severity: mentionResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
    recommendedAction: mentionResult.level === 'HIGH' ? 'DELETE_MUTE' : 'DELETE_WARN',
    reasons: [
      `${mentionResult.mentionCount} mentions (${mentionResult.mentionedUsers.length} unique users)`,
    ],
    fastPath: true,
  };
}
