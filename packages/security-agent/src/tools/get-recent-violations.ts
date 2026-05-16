import { db } from '@togi/db';
import { violations } from '@togi/db/src/schema';
import { eq, desc } from 'drizzle-orm';

export async function getRecentViolations(groupId: string, hours: number = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const recent = await db.query.violations.findMany({
    where: eq(violations.groupId, groupId),
    orderBy: [desc(violations.createdAt)],
    limit: 1000,
  });

  const lastHour = recent.filter(v => v.createdAt > new Date(Date.now() - 60 * 60 * 1000));
  const last24h = recent.filter(v => v.createdAt > cutoff);

  const typeCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const v of last24h) {
    typeCounts[v.violationType] = (typeCounts[v.violationType] || 0) + 1;
    if (v.telegramUserId) {
      userCounts[String(v.telegramUserId)] = (userCounts[String(v.telegramUserId)] || 0) + 1;
    }
  }

  const topTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const hourBeforeLast = lastHour.filter(v => v.createdAt > new Date(Date.now() - 2 * 60 * 60 * 1000));
  const trend = lastHour.length > hourBeforeLast.length ? 'increasing' : lastHour.length < hourBeforeLast.length ? 'decreasing' : 'stable';

  return {
    countLastHour: lastHour.length,
    countLast24h: last24h.length,
    trend,
    topTypes,
    topUsers,
  };
}