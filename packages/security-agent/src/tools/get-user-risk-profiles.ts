import { db } from '@togi/db';
import { groupUserProfiles } from '@togi/db/src/schema';
import { eq, desc } from 'drizzle-orm';

export async function getUserRiskProfiles(groupId: string, limit: number = 10) {
  const profiles = await db.query.groupUserProfiles.findMany({
    where: eq(groupUserProfiles.groupId, groupId),
    orderBy: [desc(groupUserProfiles.riskScore)],
    limit,
  });

  return profiles.map(p => ({
    userId: String(p.telegramUserId),
    riskScore: p.riskScore,
    trustScore: p.trustScore,
    violationCount: p.violationCount,
    messageCount: p.messageCount,
  }));
}