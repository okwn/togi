// Media flood detector - detects excessive media
// Rules:
// - Sticker/GIF burst: +40
// - New user sends media during probation: +30

import { DetectionResult, DetectionLabel, Severity } from '../types.js';

export interface MediaFloodConfig {
  enabled: boolean;
  stickerBurstScore: number;
  gifBurstScore: number;
  mediaProbationScore: number;
  stickerBurstLimit: number;
  gifBurstLimit: number;
}

const DEFAULT_CONFIG: MediaFloodConfig = {
  enabled: true,
  stickerBurstScore: 40,
  gifBurstScore: 40,
  mediaProbationScore: 30,
  stickerBurstLimit: 5,
  gifBurstLimit: 3,
};

export interface MediaFloodResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  stickerCount: number;
  gifCount: number;
  isProbationViolation: boolean;
}

export function checkMediaFlood(
  mediaType: string | undefined,
  stickerCount: number = 0,
  gifCount: number = 0,
  isNewUser: boolean = false,
  isInProbation: boolean = false,
  config: MediaFloodConfig = DEFAULT_CONFIG
): MediaFloodResult {
  const result: MediaFloodResult = {
    score: 0,
    level: 'NONE',
    stickerCount,
    gifCount,
    isProbationViolation: false,
  };

  if (!config.enabled) {
    return result;
  }

  // Check sticker burst
  if (stickerCount >= config.stickerBurstLimit) {
    result.score += config.stickerBurstScore;
  }

  // Check GIF burst
  if (gifCount >= config.gifBurstLimit) {
    result.score += config.gifBurstScore;
  }

  // New user media during probation
  if (isNewUser && isInProbation && mediaType && mediaType !== 'unknown') {
    result.score += config.mediaProbationScore;
    result.isProbationViolation = true;
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

export function mediaFloodToDetection(
  mediaFloodResult: MediaFloodResult,
  mediaType: string | undefined
): Partial<DetectionResult> {
  if (mediaFloodResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['MEDIA_FLOOD'];

  const reasons: string[] = [];

  if (mediaFloodResult.stickerCount >= 5) {
    reasons.push(`Sticker burst: ${mediaFloodResult.stickerCount}`);
  }

  if (mediaFloodResult.gifCount >= 3) {
    reasons.push(`GIF burst: ${mediaFloodResult.gifCount}`);
  }

  if (mediaFloodResult.isProbationViolation) {
    reasons.push('New user media during probation');
  }

  return {
    riskScore: mediaFloodResult.score,
    labels,
    severity: mediaFloodResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
    recommendedAction: mediaFloodResult.level === 'HIGH' ? 'DELETE_MUTE' : 'DELETE_WARN',
    reasons,
    fastPath: true,
  };
}
