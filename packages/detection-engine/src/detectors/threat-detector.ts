// Threat keyword detector - detects threats and harassment
// Rules:
// - Direct threat pattern: +75
// - Severe harassment pattern: +45
// - Doxxing-like pattern: +80

import { DetectionResult, DetectionLabel, Severity } from '../types.js';
import {
  containsThreatPattern,
  containsHarassment,
} from '../static-lists/threat-patterns.js';
import { normalizeText } from '../text-normalizer.js';

export interface ThreatConfig {
  enabled: boolean;
  threatScore: number;
  doxxingScore: number;
  harassmentScore: number;
}

const DEFAULT_CONFIG: ThreatConfig = {
  enabled: true,
  threatScore: 75,
  doxxingScore: 80,
  harassmentScore: 45,
};

export interface ThreatResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  hasThreat: boolean;
  hasHarassment: boolean;
  hasDoxxing: boolean;
  matchedPatterns: string[];
}

export function checkThreat(
  text: string | undefined,
  config: ThreatConfig = DEFAULT_CONFIG
): ThreatResult {
  const result: ThreatResult = {
    score: 0,
    level: 'NONE',
    hasThreat: false,
    hasHarassment: false,
    hasDoxxing: false,
    matchedPatterns: [],
  };

  if (!config.enabled || !text) {
    return result;
  }

  const normalized = normalizeText(text).normalized;

  // Check for doxxing patterns first (highest severity)
  if (normalized.includes('dox') || normalized.includes('doxx')) {
    result.hasDoxxing = true;
    result.score += config.doxxingScore;
    result.matchedPatterns.push('doxxing');
  }

  if (normalized.includes('leak') && (normalized.includes('address') || normalized.includes('phone') || normalized.includes('email'))) {
    result.hasDoxxing = true;
    result.score += config.doxxingScore;
    result.matchedPatterns.push('doxxing-leak');
  }

  // Check for direct threats
  const threatKeywords = ['kill', 'murder', 'die', 'bomb', 'weapon', 'gun', 'knife', 'stab', 'shoot', 'poison'];
  for (const keyword of threatKeywords) {
    if (normalized.includes(keyword)) {
      result.hasThreat = true;
      result.score += config.threatScore;
      result.matchedPatterns.push(`threat:${keyword}`);
      break;
    }
  }

  // Check for severe harassment
  const harassmentKeywords = ['slur', 'racist', 'bigot', 'nazi', 'fasci'];
  for (const keyword of harassmentKeywords) {
    if (normalized.includes(keyword)) {
      result.hasThreat = true;
      result.score += config.threatScore;
      result.matchedPatterns.push(`harassment:${keyword}`);
      break;
    }
  }

  // Check for general harassment (lower score)
  if (containsHarassment(text) && !result.hasThreat) {
    result.hasHarassment = true;
    result.score += config.harassmentScore;
    result.matchedPatterns.push('general-harassment');
  }

  // Determine level
  if (result.score >= 80) {
    result.level = 'CRITICAL';
  } else if (result.score >= 75) {
    result.level = 'HIGH';
  } else if (result.score >= 45) {
    result.level = 'MEDIUM';
  } else if (result.score > 0) {
    result.level = 'LOW';
  }

  return result;
}

export function threatToDetection(threatResult: ThreatResult): Partial<DetectionResult> {
  if (threatResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['THREAT'];

  if (threatResult.hasDoxxing) {
    labels.push('DOXXING' as DetectionLabel);
  }

  if (threatResult.hasHarassment) {
    labels.push('HARASSMENT');
  }

  return {
    riskScore: threatResult.score,
    labels,
    severity: threatResult.level === 'CRITICAL' ? 'CRITICAL' :
              threatResult.level === 'HIGH' ? 'HIGH' :
              threatResult.level === 'MEDIUM' ? 'HIGH' : 'MEDIUM',
    recommendedAction: threatResult.level === 'CRITICAL' ? 'DELETE_BAN' :
                      threatResult.level === 'HIGH' ? 'DELETE_MUTE' :
                      threatResult.level === 'MEDIUM' ? 'DELETE_WARN' : 'DELETE',
    reasons: threatResult.matchedPatterns.length > 0
      ? [`Matched: ${threatResult.matchedPatterns.join(', ')}`]
      : ['Threat pattern detected'],
    fastPath: true,
  };
}
