import type { SafetyLevel, ActionRisk } from '../agent/types.js';

export const HIGH_IMPACT_ACTIONS: ActionRisk[] = ['HIGH'];

export const SAFETY_LEVEL_ORDER: SafetyLevel[] = [
  'OBSERVE_ONLY',
  'RECOMMEND_ONLY',
  'AUTO_LOW_RISK',
  'AUTO_HIGH_RISK_WITH_POLICY',
];

export function canAutoExecute(safetyLevel: SafetyLevel, actionRisk: ActionRisk): boolean {
  switch (safetyLevel) {
    case 'OBSERVE_ONLY':
      return false;
    case 'RECOMMEND_ONLY':
      return false;
    case 'AUTO_LOW_RISK':
      return actionRisk === 'LOW';
    case 'AUTO_HIGH_RISK_WITH_POLICY':
      return actionRisk === 'LOW' || actionRisk === 'MEDIUM';
    default:
      return false;
  }
}

export function canRecommend(safetyLevel: SafetyLevel): boolean {
  return safetyLevel !== 'OBSERVE_ONLY';
}

export function isHighImpact(actionRisk: ActionRisk): boolean {
  return actionRisk === 'HIGH';
}

export function requiresApproval(safetyLevel: SafetyLevel, actionRisk: ActionRisk): boolean {
  if (isHighImpact(actionRisk)) {
    return true; // High-impact always requires approval
  }
  if (canAutoExecute(safetyLevel, actionRisk)) {
    return false;
  }
  return true;
}