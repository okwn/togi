import { db } from '@togi/db';
import { domainRules, recommendations } from '@togi/db/src/schema';
import { eq } from 'drizzle-orm';
import { proposeDomainBlock } from './propose-domain-block.js';

export interface ApplyDomainBlockParams {
  groupId: string;
  agentRunId: string;
  domain: string;
  reason: string;
  riskScore: number;
}

export async function applyDomainBlock(params: ApplyDomainBlockParams): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  const { id } = await proposeDomainBlock({
    agentRunId: params.agentRunId,
    groupId: params.groupId,
    domain: params.domain,
    reason: params.reason,
    riskScore: params.riskScore,
  });

  const [rule] = await db.insert(domainRules).values({
    groupId: params.groupId,
    domain: params.domain,
    ruleType: 'BLOCK',
    reason: params.reason,
  }).returning();

  await db.update(recommendations)
    .set({ status: 'APPLIED', appliedAt: new Date() })
    .where(eq(recommendations.id, id));

  return { success: true, ruleId: rule.id };
}