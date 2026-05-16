import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import type { PlannedAction } from '../agent/types.js';

export interface ProposeDomainBlockParams {
  agentRunId: string;
  groupId: string;
  domain: string;
  reason: string;
  riskScore: number;
}

export async function proposeDomainBlock(params: ProposeDomainBlockParams): Promise<{ id: string }> {
  const priority = params.riskScore >= 80 ? 'HIGH' : params.riskScore >= 60 ? 'MEDIUM' : 'LOW';

  const action: PlannedAction = {
    id: crypto.randomUUID(),
    type: 'DOMAIN_BLOCK',
    risk: 'HIGH',
    target: params.domain,
    params: {
      domain: params.domain,
      riskScore: params.riskScore,
    },
    reason: params.reason,
  };

  const [rec] = await db.insert(recommendations).values({
    groupId: params.groupId,
    agentRunId: params.agentRunId,
    type: 'DOMAIN_BLOCK',
    priority,
    status: 'PENDING',
    action,
    reason: params.reason,
    triggeredBy: `threat_indicator:${params.domain}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }).returning();

  return { id: rec.id };
}