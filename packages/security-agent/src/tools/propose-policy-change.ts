import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import type { PlannedAction } from '../agent/types.js';

export interface ProposePolicyChangeParams {
  agentRunId: string;
  groupId: string;
  currentMode: string;
  proposedMode: string;
  reason: string;
}

export async function proposePolicyChange(params: ProposePolicyChangeParams): Promise<{ id: string }> {
  const action: PlannedAction = {
    id: crypto.randomUUID(),
    type: 'POLICY_CHANGE',
    risk: 'MEDIUM',
    target: params.groupId,
    params: {
      currentMode: params.currentMode,
      proposedMode: params.proposedMode,
    },
    reason: params.reason,
  };

  const [rec] = await db.insert(recommendations).values({
    groupId: params.groupId,
    agentRunId: params.agentRunId,
    type: 'POLICY_CHANGE',
    priority: 'MEDIUM',
    status: 'PENDING',
    action,
    reason: params.reason,
    triggeredBy: `policy_change:${params.currentMode}->${params.proposedMode}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning();

  return { id: rec.id };
}