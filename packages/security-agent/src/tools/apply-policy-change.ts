import { db } from '@togi/db';
import { groupPolicies, recommendations } from '@togi/db/src/schema';
import { eq } from 'drizzle-orm';
import { proposePolicyChange } from './propose-policy-change.js';

export interface ApplyPolicyChangeParams {
  groupId: string;
  agentRunId: string;
  proposedMode: string;
  reason: string;
}

export async function applyPolicyChange(params: ApplyPolicyChangeParams): Promise<{ success: boolean; recommendationId?: string; error?: string }> {
  const { id } = await proposePolicyChange({
    agentRunId: params.agentRunId,
    groupId: params.groupId,
    currentMode: 'BALANCED',
    proposedMode: params.proposedMode,
    reason: params.reason,
  });

  const [policy] = await db.update(groupPolicies)
    .set({
      mode: params.proposedMode,
      updatedAt: new Date(),
    })
    .where(eq(groupPolicies.groupId, params.groupId))
    .returning();

  if (!policy) {
    return { success: false, error: 'Policy not found' };
  }

  await db.update(recommendations)
    .set({ status: 'APPLIED', appliedAt: new Date() })
    .where(eq(recommendations.id, id));

  return { success: true, recommendationId: id };
}