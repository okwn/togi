import { canAutoExecute, isHighImpact } from './safety-levels.js';
import type { SafetyLevel, PlannedAction, AgentConfig } from '../agent/types.js';

export interface SafetyCheckResult {
  canExecute: boolean;
  requiresApproval: boolean;
  blockedReason?: string;
}

export function checkActionSafety(
  action: PlannedAction,
  agentConfig: AgentConfig
): SafetyCheckResult {
  const { safetyLevel, autonomousPolicy } = agentConfig;

  if (isHighImpact(action.risk)) {
    if (autonomousPolicy.requireHumanApprovalForHighImpact) {
      return {
        canExecute: false,
        requiresApproval: true,
        blockedReason: 'High-impact action requires human approval',
      };
    }
  }

  if (canAutoExecute(safetyLevel, action.risk)) {
    if (autonomousPolicy.maxActionsPerHour > 0) {
      return { canExecute: true, requiresApproval: false };
    }
  }

  if (!canAutoExecute(safetyLevel, action.risk)) {
    return {
      canExecute: false,
      requiresApproval: true,
      blockedReason: `Action risk ${action.risk} not allowed in ${safetyLevel} mode`,
    };
  }

  return { canExecute: true, requiresApproval: false };
}

export function filterExecutableActions(
  actions: PlannedAction[],
  agentConfig: AgentConfig
): { executable: PlannedAction[]; needsApproval: PlannedAction[] } {
  const executable: PlannedAction[] = [];
  const needsApproval: PlannedAction[] = [];

  for (const action of actions) {
    const result = checkActionSafety(action, agentConfig);
    if (result.canExecute) {
      executable.push(action);
    } else {
      needsApproval.push(action);
    }
  }

  return { executable, needsApproval };
}