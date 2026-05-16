import type { DetectionLabel, DetectionResult, Severity, RecommendedAction } from '@togi/detection-engine';

export function createDetectionResult(
  overrides: Partial<DetectionResult> = {}
): DetectionResult {
  const result: DetectionResult = {
    riskScore: 0,
    labels: [],
    severity: 'LOW' as Severity,
    recommendedAction: 'ALLOW' as RecommendedAction,
    reasons: [],
    fastPath: true,
    ...overrides,
  };

  // Validate inputs
  if (result.riskScore < 0 || result.riskScore > 100) {
    throw new Error(`riskScore must be 0-100, got: ${result.riskScore}`);
  }

  const validSeverities: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validSeverities.includes(result.severity)) {
    throw new Error(`severity must be one of ${validSeverities.join('|')}, got: ${result.severity}`);
  }

  const validActions: RecommendedAction[] = ['ALLOW', 'LOG', 'WARN', 'DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'];
  if (!validActions.includes(result.recommendedAction)) {
    throw new Error(`recommendedAction must be one of ${validActions.join('|')}, got: ${result.recommendedAction}`);
  }

  const validLabels: DetectionLabel[] = [
    'SPAM', 'FLOOD', 'DUPLICATE', 'LINK', 'SHORTENER', 'BLOCKED_DOMAIN',
    'NEW_USER_LINK', 'SCAM_PATTERN', 'PHISHING_PATTERN', 'THREAT',
    'HARASSMENT', 'MENTION_SPAM', 'MEDIA_FLOOD', 'RAID_SIGNAL', 'SUSPICIOUS_PROFILE',
  ];
  for (const label of result.labels) {
    if (!validLabels.includes(label)) {
      throw new Error(`labels must be valid DetectionLabel values, got: ${label}`);
    }
  }

  return result;
}