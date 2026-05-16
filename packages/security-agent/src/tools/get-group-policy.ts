import { db } from '@togi/db';
import { groupPolicies, groups } from '@togi/db/src/schema';
import { eq } from 'drizzle-orm';

export async function getGroupPolicy(groupId: string) {
  const policy = await db.query.groupPolicies.findFirst({
    where: eq(groupPolicies.groupId, groupId),
  });

  if (!policy) {
    return null;
  }

  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  return {
    policy,
    groupSecurityScore: group?.securityScore ?? 0,
  };
}