import type { ObservationResult, Plan, PlannedAction } from '../agent/types.js';
import { analyzeRiskPosture, detectAnomalies } from './risk-analyzer.js';

export function generateRecommendations(observations: ObservationResult): Plan {
  const anomalies = detectAnomalies(observations);
  const actions: PlannedAction[] = [];

  if (anomalies.some(a => a.includes('raid'))) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'LOCKDOWN',
      risk: 'HIGH',
      target: observations.groupId,
      params: { durationMinutes: 30 },
      reason: 'Raid detected - recommend temporary lockdown',
    });
  }

  if (observations.violations.trend === 'increasing' && observations.violations.countLast24h > 30) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'POLICY_CHANGE',
      risk: 'MEDIUM',
      target: observations.groupId,
      params: { proposedMode: 'STRICT', currentMode: observations.security.policyMode },
      reason: `Violation trend increasing (${observations.violations.countLast24h} in 24h) - recommend STRICT mode`,
    });
  }

  for (const indicator of observations.threatIndicators) {
    if (indicator.riskScore >= 80 && indicator.type === 'DOMAIN') {
      actions.push({
        id: crypto.randomUUID(),
        type: 'DOMAIN_BLOCK',
        risk: 'HIGH',
        target: indicator.valueHash,
        params: { domain: indicator.valueHash, riskScore: indicator.riskScore },
        reason: `High-risk domain (score: ${indicator.riskScore}) detected across multiple groups`,
      });
    }
  }

  for (const user of observations.topRiskyUsers.slice(0, 3)) {
    if (user.riskScore >= 70) {
      actions.push({
        id: crypto.randomUUID(),
        type: 'USER_MUTE',
        risk: 'MEDIUM',
        target: user.userId,
        params: { durationMinutes: 60 },
        reason: `User risk score ${user.riskScore} - recommend temporary mute for review`,
      });
    }
  }

  if (anomalies.length > 0) {
    actions.push({
      id: crypto.randomUUID(),
      type: 'CREATE_REVIEW_ITEMS',
      risk: 'LOW',
      target: observations.groupId,
      params: { reason: anomalies.join('; ') },
      reason: `Anomalies detected: ${anomalies.join(', ')}`,
    });
  }

  const summary = `Analyzed ${observations.groupId}: ${anomalies.length} anomalies, generated ${actions.length} actions`;

  return { actions, summary };
}