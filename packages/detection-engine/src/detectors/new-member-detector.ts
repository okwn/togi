// New member detector - detects violations by new users
// Rules:
// - New user sends media during probation: +30
// - New user sends links during probation: +50

import { DetectionResult, DetectionLabel, Severity } from '../types.js';

export interface NewMemberConfig {
  enabled: boolean;
  probationMinutes: number;
  mediaScore: number;
  linkScore: number;
  restrictions: string[];
}

const DEFAULT_CONFIG: NewMemberConfig = {
  enabled: true,
  probationMinutes: 5,
  mediaScore: 30,
  linkScore: 50,
  restrictions: ['links'],
};

export interface NewMemberResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  isNewUser: boolean;
  probationEnd: number | null;
  violations: string[];
}

export function checkNewMember(
  isNewUser: boolean,
  userMemberSince: number | undefined,
  probationMinutes: number,
  hasMedia: boolean,
  hasLinks: boolean,
  restrictions: string[] = ['links'],
  config: NewMemberConfig = DEFAULT_CONFIG
): NewMemberResult {
  const result: NewMemberResult = {
    score: 0,
    level: 'NONE',
    isNewUser,
    probationEnd: null,
    violations: [],
  };

  if (!config.enabled || !isNewUser) {
    return result;
  }

  // Calculate if user is still in probation
  if (userMemberSince) {
    const probationEnd = userMemberSince + probationMinutes * 60 * 1000;
    result.probationEnd = probationEnd;

    if (Date.now() > probationEnd) {
      // User passed probation
      return result;
    }
  }

  // Check restrictions
  if (restrictions.includes('media') && hasMedia) {
    result.score += config.mediaScore;
    result.violations.push('media during probation');
  }

  if (restrictions.includes('links') && hasLinks) {
    result.score += config.linkScore;
    result.violations.push('links during probation');
  }

  // Determine level
  if (result.score >= 50) {
    result.level = 'HIGH';
  } else if (result.score >= 30) {
    result.level = 'MEDIUM';
  } else if (result.score > 0) {
    result.level = 'LOW';
  }

  return result;
}

export function newMemberToDetection(
  newMemberResult: NewMemberResult,
  hasMedia: boolean,
  hasLinks: boolean
): Partial<DetectionResult> {
  if (newMemberResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['NEW_USER_LINK'];

  if (hasMedia && newMemberResult.violations.includes('media during probation')) {
    labels.push('MEDIA_FLOOD');
  }

  const reasons: string[] = newMemberResult.violations.map(
    (v) => `New user: ${v}`
  );

  return {
    riskScore: newMemberResult.score,
    labels,
    severity: newMemberResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
    recommendedAction: newMemberResult.level === 'HIGH' ? 'DELETE_MUTE' : 'DELETE_WARN',
    reasons,
    fastPath: true,
  };
}
