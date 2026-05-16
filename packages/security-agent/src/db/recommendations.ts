import { db } from '@togi/db';
import { recommendations } from '@togi/db/src/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { Recommendation } from '../agent/types.js';

export async function getPendingRecommendations(groupId: string): Promise<Recommendation[]> {
  return db.query.recommendations.findMany({
    where: and(
      eq(recommendations.groupId, groupId),
      eq(recommendations.status, 'PENDING')
    ),
    orderBy: [desc(recommendations.createdAt)],
  });
}

export async function approveRecommendation(
  recommendationId: string,
  approvedBy: string,
  note?: string
): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'APPROVED',
      adminResponse: {
        action: 'APPROVED',
        by: approvedBy,
        at: new Date().toISOString(),
        note,
      },
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}

export async function rejectRecommendation(
  recommendationId: string,
  rejectedBy: string,
  note?: string
): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'REJECTED',
      adminResponse: {
        action: 'REJECTED',
        by: rejectedBy,
        at: new Date().toISOString(),
        note,
      },
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}

export async function markRecommendationApplied(recommendationId: string): Promise<Recommendation> {
  const [rec] = await db.update(recommendations)
    .set({
      status: 'APPLIED',
      appliedAt: new Date(),
    })
    .where(eq(recommendations.id, recommendationId))
    .returning();

  return rec;
}