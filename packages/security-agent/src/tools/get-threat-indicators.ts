import { db } from '@togi/db';
import { threatIndicators } from '@togi/db/src/schema';
import { desc, gte, and } from 'drizzle-orm';

export async function getThreatIndicators(groupId: string, status: string[] = ['BLOCK', 'WATCH']) {
  const indicators = await db.query.threatIndicators.findMany({
    where: and(
      gte(threatIndicators.riskScore, 50),
    ),
    orderBy: [desc(threatIndicators.riskScore)],
    limit: 50,
  });

  return indicators
    .filter(i => status.includes(i.status))
    .map(i => ({
      id: i.id,
      type: i.type,
      valueHash: i.valueHash,
      riskScore: i.riskScore,
      labels: i.labels,
      seenCount: i.seenCount,
      status: i.status,
    }));
}