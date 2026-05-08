// Decision engine - determines recommended action based on score
// Thresholds are modified by policy mode

import {
  DetectionResult,
  DetectionLabel,
  Severity,
  RecommendedAction,
} from './types.js';
import type { PolicyContext } from './types.js';
import { THRESHOLD_MODIFIERS, PolicyMode } from './risk-score.js';

export interface DecisionThresholds {
  allowMax: number;
  warnMax: number;
  deleteMax: number;
  muteMax: number;
  banMax: number;
}

export function getThresholdsForMode(mode: PolicyMode): DecisionThresholds {
  return THRESHOLD_MODIFIERS[mode] || THRESHOLD_MODIFIERS.BALANCED;
}

export function determineAction(
  score: number,
  mode: PolicyMode
): RecommendedAction {
  const thresholds = getThresholdsForMode(mode);

  if (score > thresholds.banMax) {
    return 'DELETE_BAN';
  }
  if (score > thresholds.muteMax) {
    return 'DELETE_MUTE';
  }
  if (score > thresholds.deleteMax) {
    return 'DELETE_WARN';
  }
  if (score > thresholds.warnMax) {
    return 'DELETE';
  }
  if (score > thresholds.allowMax) {
    return 'WARN';
  }
  return 'ALLOW';
}

export function determineActionFromSeverity(
  severity: Severity,
  _mode: PolicyMode
): RecommendedAction {
  switch (severity) {
    case 'CRITICAL':
      return 'DELETE_BAN';
    case 'HIGH':
      return 'DELETE_MUTE';
    case 'MEDIUM':
      return 'DELETE_WARN';
    case 'LOW':
      return 'ALLOW';
    default:
      return 'ALLOW';
  }
}

export interface CombinedDetectionInput {
  labels: DetectionLabel[];
  reasons: string[];
  totalScore: number;
  severity: Severity;
}

export function mergeDetectionResults(
  inputs: Partial<DetectionResult>[]
): DetectionResult {
  // Collect all labels
  const allLabels = new Set<DetectionLabel>();
  const allReasons: string[] = [];
  let totalScore = 0;
  let maxSeverity: Severity = 'LOW';
  let hasRecommendAction = false;
  let recommendedAction: RecommendedAction = 'ALLOW';

  const severityOrder: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  for (const input of inputs) {
    if (!input) continue;

    for (const label of input.labels || []) {
      allLabels.add(label);
    }

    if (input.reasons) {
      allReasons.push(...input.reasons);
    }

    if (input.riskScore) {
      totalScore += input.riskScore;
    }

    if (input.severity) {
      const currentIndex = severityOrder.indexOf(input.severity);
      const maxIndex = severityOrder.indexOf(maxSeverity);
      if (currentIndex > maxIndex) {
        maxSeverity = input.severity;
      }
    }

    if (input.recommendedAction && input.recommendedAction !== 'ALLOW') {
      hasRecommendAction = true;
      // Use the most severe action
      const actionOrder: RecommendedAction[] = [
        'ALLOW', 'LOG', 'WARN', 'DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'
      ];
      const currentIndex = actionOrder.indexOf(input.recommendedAction);
      const recommendedIndex = actionOrder.indexOf(recommendedAction);
      if (currentIndex > recommendedIndex) {
        recommendedAction = input.recommendedAction;
      }
    }
  }

  // Cap total score at 100
  totalScore = Math.min(totalScore, 100);

  // Final action based on total score and mode context
  if (!hasRecommendAction) {
    recommendedAction = determineAction(totalScore, 'BALANCED');
  }

  return {
    riskScore: totalScore,
    labels: Array.from(allLabels),
    severity: maxSeverity,
    recommendedAction,
    reasons: [...new Set(allReasons)], // Dedupe
    fastPath: true,
  };
}

export function shouldEnqueueForAnalysis(result: DetectionResult): boolean {
  // If score is low and action is ALLOW/WARN/LOG, don't enqueue
  if (result.riskScore < 30 && ['ALLOW', 'LOG', 'WARN'].includes(result.recommendedAction)) {
    return false;
  }

  // If severity is HIGH or CRITICAL, always enqueue for deeper analysis
  if (['HIGH', 'CRITICAL'].includes(result.severity)) {
    return true;
  }

  // If specific labels present, enqueue
  const analysisLabels: DetectionLabel[] = ['SCAM_PATTERN', 'PHISHING_PATTERN', 'DOXXING' as DetectionLabel];
  for (const label of result.labels) {
    if (analysisLabels.includes(label)) {
      return true;
    }
  }

  return false;
}
