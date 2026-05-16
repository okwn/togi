import { createAgentRun, updateAgentRun } from '../db/agent-runs.js';
import { getGroupPolicy } from '../tools/get-group-policy.js';
import { getRecentViolations } from '../tools/get-recent-violations.js';
import { getUserRiskProfiles } from '../tools/get-user-risk-profiles.js';
import { getThreatIndicators } from '../tools/get-threat-indicators.js';
import { getBotPermissions } from '../tools/get-bot-permissions.js';
import { triggerLockdown } from '../tools/trigger-lockdown.js';
import { createReviewItem } from '../tools/create-review-items.js';
import { checkActionSafety } from '../safety/policy-checker.js';
import { logAgentAction, logAgentRunStarted, logAgentRunCompleted } from '../safety/audit-logger.js';
import { generateRecommendations } from '../planning/recommendation-engine.js';
import { analyzeRiskPosture } from '../planning/risk-analyzer.js';
import type { AgentConfig, ObservationResult, ExecutedAction, Reflection, Plan } from './types.js';
import type { TriggerType, SafetyLevel, PlannedAction } from './types.js';

async function observe(groupId: string, trigger: TriggerType): Promise<ObservationResult> {
  const violations = await getRecentViolations(groupId, 24);
  const riskyUsers = await getUserRiskProfiles(groupId);
  const threats = await getThreatIndicators(groupId);
  const policy = await getGroupPolicy(groupId);
  const permissions = await getBotPermissions(String(policy?.group?.telegramChatId));

  return {
    groupId,
    timestamp: Date.now(),
    violations: {
      countLastHour: violations.countLastHour,
      countLast24h: violations.countLast24h,
      trend: violations.trend,
      topTypes: violations.topTypes,
      topUsers: violations.topUsers,
    },
    security: {
      currentScore: policy?.groupSecurityScore ?? 0,
      scoreDelta: 0,
      botPermissionsOk: permissions?.canDelete ?? false,
      policyMode: policy?.policy?.mode ?? 'BALANCED',
      protectionEnabled: true,
    },
    topRiskyUsers: riskyUsers.map(u => ({ userId: u.userId, riskScore: u.riskScore })),
    threatIndicators: threats.map(t => ({ type: t.type, valueHash: t.valueHash, riskScore: t.riskScore })),
    joinRate: 0,
    botPermissions: permissions ?? {
      canDelete: false,
      canRestrict: false,
      canInvite: false,
      canManageVideoChats: false,
    },
  };
}

function analyze(observations: ObservationResult): Record<string, unknown> {
  return {
    riskPosture: analyzeRiskPosture(observations),
    anomalies: [],
    recommendations: [],
  };
}

async function executeOrRecommend(
  plan: Plan,
  agentConfig: AgentConfig
): Promise<{ executed: ExecutedAction[]; recommended: PlannedAction[] }> {
  const executed: ExecutedAction[] = [];
  const recommended: PlannedAction[] = [];

  for (const action of plan.actions) {
    const safetyResult = checkActionSafety(action, agentConfig);

    if (safetyResult.canExecute) {
      await executeAction(action);
      executed.push({
        action,
        status: 'EXECUTED',
        executedAt: Date.now(),
      });

      await logAgentAction({
        agentRunId: '',
        groupId: agentConfig.groupId,
        trigger: agentConfig.trigger,
        action: { action, status: 'EXECUTED' },
        safetyLevel: agentConfig.safetyLevel,
        outcome: 'EXECUTED',
      });
    } else if (safetyResult.requiresApproval) {
      recommended.push(action);
    }
  }

  return { executed, recommended };
}

async function executeAction(action: PlannedAction): Promise<void> {
  switch (action.type) {
    case 'CREATE_REVIEW_ITEMS':
      await createReviewItem({
        groupId: action.target,
        itemType: 'user',
        itemId: action.params.reason as string,
        reason: action.reason,
        reasonType: 'AGENT_OBSERVATION',
        labels: [],
        riskScore: 50,
      });
      break;

    case 'LOCKDOWN':
      await triggerLockdown({
        groupId: action.target,
        reason: action.reason,
        durationSeconds: (action.params.durationMinutes as number) * 60,
      });
      break;
  }
}

async function reflect(
  executed: ExecutedAction[],
  recommended: PlannedAction[],
  groupId: string
): Promise<Reflection> {
  const recentViolations = await getRecentViolations(groupId, 1);

  return {
    violationsAfter: recentViolations.countLastHour,
    violationsBefore: 0,
    falsePositivesDetected: false,
    adminOverrides: 0,
    recommendationAccuracy: recommended.length > 0 ? 0 : 1,
    shouldRollback: false,
    rollbackReason: null,
  };
}

export async function runAgentCycle(
  groupId: string,
  trigger: TriggerType,
  safetyLevel: SafetyLevel
): Promise<{ runId: string; executed: ExecutedAction[]; recommended: PlannedAction[] }> {
  const agentConfig: AgentConfig = {
    groupId,
    trigger,
    safetyLevel,
    autonomousPolicy: {
      enabled: true,
      mode: safetyLevel,
      allowAutoPolicyTuning: false,
      allowAutoDomainBlocking: false,
      allowAutoLockdown: false,
      allowAutoReports: true,
      maxActionsPerHour: 20,
      requireHumanApprovalForHighImpact: true,
    },
  };

  const run = await createAgentRun({
    groupId,
    triggerType: trigger,
    safetyLevel,
  });

  await logAgentRunStarted(run.id, groupId, trigger);

  try {
    const observations = await observe(groupId, trigger);
    await updateAgentRun(run.id, { observations });

    const analysis = analyze(observations);

    const plan = generateRecommendations(observations);
    await updateAgentRun(run.id, { plan });

    const { executed, recommended } = await executeOrRecommend(plan, agentConfig);

    const reflection = await reflect(executed, recommended, groupId);
    await updateAgentRun(run.id, {
      reflection,
      actions: executed.map(e => ({ ...e, status: e.status })),
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    await logAgentRunCompleted(run.id, groupId, {
      executed: executed.length,
      recommended: recommended.length,
      reflection,
    });

    return { runId: run.id, executed, recommended };
  } catch (error) {
    await updateAgentRun(run.id, {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export { observe, analyze, executeOrRecommend, reflect };