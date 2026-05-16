import { db } from '@togi/db';
import { agentRuns } from '@togi/db/src/schema';
import { eq, desc } from 'drizzle-orm';
import type { AgentRun, AgentRunStatus, TriggerType, SafetyLevel } from '../agent/types.js';

export interface CreateAgentRunParams {
  groupId: string;
  triggerType: TriggerType;
  safetyLevel: SafetyLevel;
}

export async function createAgentRun(params: CreateAgentRunParams): Promise<AgentRun> {
  const [run] = await db.insert(agentRuns).values({
    groupId: params.groupId,
    triggerType: params.triggerType,
    status: 'RUNNING',
    safetyLevelUsed: params.safetyLevel,
    observations: {},
    plan: {},
    actions: [],
    reflection: {},
    adminApprovals: [],
  }).returning();

  return run;
}

export async function updateAgentRun(
  runId: string,
  updates: {
    status?: AgentRunStatus;
    observations?: Record<string, unknown>;
    plan?: Record<string, unknown>;
    actions?: unknown[];
    reflection?: Record<string, unknown>;
    adminApprovals?: unknown[];
    completedAt?: Date;
    errorMessage?: string;
  }
): Promise<AgentRun> {
  const [run] = await db.update(agentRuns)
    .set(updates)
    .where(eq(agentRuns.id, runId))
    .returning();

  return run;
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  return db.query.agentRuns.findFirst({
    where: eq(agentRuns.id, runId),
  });
}

export async function getRecentAgentRuns(groupId: string, limit: number = 10): Promise<AgentRun[]> {
  return db.query.agentRuns.findMany({
    where: eq(agentRuns.groupId, groupId),
    orderBy: [desc(agentRuns.startedAt)],
    limit,
  });
}