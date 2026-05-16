import type { DetectionResult, Severity, RecommendedAction } from '@togi/detection-engine';

export function createDetectionResult(
  overrides: Partial<DetectionResult> = {}
): DetectionResult {
  return {
    riskScore: 0,
    labels: [],
    severity: 'LOW' as Severity,
    recommendedAction: 'ALLOW' as RecommendedAction,
    reasons: [],
    fastPath: true,
    ...overrides,
  };
}