import { db } from '@togi/db';
import { reviewQueue } from '@togi/db/src/schema';

export interface CreateReviewItemParams {
  groupId: string;
  itemType: 'message' | 'user';
  itemId: string;
  telegramUserId?: string;
  reason: string;
  reasonType: string;
  labels: string[];
  riskScore: number;
}

export async function createReviewItem(params: CreateReviewItemParams): Promise<{ id: string }> {
  const [item] = await db.insert(reviewQueue).values({
    groupId: params.groupId,
    itemType: params.itemType,
    itemId: BigInt(params.itemId),
    telegramUserId: params.telegramUserId ? BigInt(params.telegramUserId) : null,
    reason: params.reason,
    reasonType: params.reasonType,
    labels: params.labels,
    riskScore: params.riskScore,
    status: 'PENDING',
  }).returning();

  return { id: item.id };
}