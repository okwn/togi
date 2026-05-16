import { db } from '@togi/db';
import { auditLogs } from '@togi/db/src/schema';
import type { ExecutedAction, TriggerType } from '../agent/types.js';

export interface AuditEntry {
  agentRunId: string;
  groupId: string;
  trigger: TriggerType;
  action: ExecutedAction;
  safetyLevel: string;
  outcome: 'EXECUTED' | 'BLOCKED' | 'APPROVED' | 'REJECTED';
  metadata?: Record<string, unknown>;
}

export async function logAgentAction(entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    groupId: entry.groupId,
    actorTelegramUserId: null,
    action: `AGENT_${entry.action.status}:${entry.action.action.type}`,
    targetType: 'AGENT',
    targetId: entry.agentRunId,
    metadata: {
      trigger: entry.trigger,
      safetyLevel: entry.safetyLevel,
      actionType: entry.action.action.type,
      actionParams: entry.action.action.params,
      outcome: entry.outcome,
      ...entry.metadata,
    },
  });
}

export async function logAgentRunStarted(runId: string, groupId: string, trigger: TriggerType): Promise<void> {
  await db.insert(auditLogs).values({
    groupId,
    action: 'AGENT_RUN_STARTED',
    targetType: 'AGENT_RUN',
    targetId: runId,
    metadata: { trigger },
  });
}

export async function logAgentRunCompleted(runId: string, groupId: string, summary: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogs).values({
    groupId,
    action: 'AGENT_RUN_COMPLETED',
    targetType: 'AGENT_RUN',
    targetId: runId,
    metadata: summary,
  });
}