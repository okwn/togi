// Risk score calculator
// Aggregates scores from all detectors and applies policy mode modifiers

import { DetectionResult, Severity } from './types.js';
import type { PolicyContext } from './types.js';

export interface RiskScoreInput {
  rateLimitScore: number;
  duplicateScore: number;
  linkScore: number;
  threatScore: number;
  newMemberScore: number;
  mentionScore: number;
  mediaFloodScore: number;
  raidScore: number;
}

export interface RiskScoreResult {
  totalScore: number;
  severity: Severity;
  breakdown: {
    flood: number;
    duplicate: number;
    link: number;
    threat: number;
    newMember: number;
    mention: number;
    media: number;
    raid: number;
  };
}

export function calculateRiskScore(
  input: RiskScoreInput,
  _policy: PolicyContext
): RiskScoreResult {
  const breakdown = {
    flood: input.rateLimitScore,
    duplicate: input.duplicateScore,
    link: input.linkScore,
    threat: input.threatScore,
    newMember: input.newMemberScore,
    mention: input.mentionScore,
    media: input.mediaFloodScore,
    raid: input.raidScore,
  };

  // Sum all scores, capped at 100
  const totalScore = Math.min(
    100,
    input.rateLimitScore +
    input.duplicateScore +
    input.linkScore +
    input.threatScore +
    input.newMemberScore +
    input.mentionScore +
    input.mediaFloodScore +
    input.raidScore
  );

  const severity = scoreToSeverity(totalScore);

  return {
    totalScore,
    severity,
    breakdown,
  };
}

export function scoreToSeverity(score: number): Severity {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'LOW';
}

// Threshold modifiers per policy mode
export const THRESHOLD_MODIFIERS = {
  RELAXED: {
    allowMax: 39,      // 0-39: ALLOW
    warnMax: 59,       // 40-59: WARN
    deleteMax: 79,     // 80-79: DELETE
    muteMax: 89,      // 80-89: DELETE_MUTE
    banMax: 100,       // 90-100: DELETE_BAN
  },
  BALANCED: {
    allowMax: 29,      // 0-29: ALLOW
    warnMax: 49,       // 30-49: WARN
    deleteMax: 69,    // 50-69: DELETE
    muteMax: 89,      // 70-89: DELETE_MUTE
    banMax: 100,       // 90-100: DELETE_BAN
  },
  STRICT: {
    allowMax: 19,      // 0-19: ALLOW
    warnMax: 39,       // 20-39: WARN
    deleteMax: 59,     // 40-59: DELETE
    muteMax: 79,      // 60-79: DELETE_MUTE
    banMax: 100,       // 80-100: DELETE_BAN
  },
  PARANOID: {
    allowMax: 9,       // 0-9: ALLOW
    warnMax: 29,       // 10-29: WARN
    deleteMax: 49,     // 30-49: DELETE
    muteMax: 69,      // 50-69: DELETE_MUTE
    banMax: 100,       // 70-100: DELETE_BAN
  },
  CUSTOM: {
    allowMax: 29,      // Same as balanced
    warnMax: 49,
    deleteMax: 69,
    muteMax: 89,
    banMax: 100,
  },
};

export type PolicyMode = keyof typeof THRESHOLD_MODIFIERS;

export function getThresholds(mode: PolicyMode) {
  return THRESHOLD_MODIFIERS[mode] || THRESHOLD_MODIFIERS.BALANCED;
}
