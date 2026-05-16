import type { ObservationResult, SecuritySummary } from '../agent/types.js';

export function analyzeRiskPosture(observations: ObservationResult): SecuritySummary {
  const violations = observations.violations;
  const security = observations.security;

  let scoreDelta = 0;

  if (violations.trend === 'increasing') {
    scoreDelta -= 10;
  } else if (violations.trend === 'decreasing') {
    scoreDelta += 5;
  }

  if (violations.countLast24h > 50) {
    scoreDelta -= 15;
  } else if (violations.countLast24h > 20) {
    scoreDelta -= 5;
  }

  if (!observations.botPermissions.canDelete) {
    scoreDelta -= 10;
  }

  return {
    currentScore: security.currentScore,
    scoreDelta,
    botPermissionsOk: observations.botPermissions.canDelete && observations.botPermissions.canRestrict,
    policyMode: security.policyMode,
    protectionEnabled: security.protectionEnabled,
  };
}

export function detectAnomalies(observations: ObservationResult): string[] {
  const anomalies: string[] = [];

  if (observations.violations.countLastHour > 10) {
    anomalies.push(`High violation rate: ${observations.violations.countLastHour}/hour`);
  }

  if (observations.violations.trend === 'increasing' && observations.violations.countLastHour > 5) {
    anomalies.push('Sudden violation spike detected');
  }

  if (observations.threatIndicators.some(t => t.riskScore >= 80)) {
    anomalies.push('High-risk threat indicator detected');
  }

  if (observations.joinRate > 20) {
    anomalies.push(`High join rate: ${observations.joinRate} joins/hour - potential raid`);
  }

  if (observations.topRiskyUsers.length > 0 && observations.violations.trend === 'increasing') {
    anomalies.push('Top risky users showing increased activity');
  }

  return anomalies;
}