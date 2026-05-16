import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, keys, redis } from '@togi/db';
import {
  groups,
  groupPolicies,
  violations,
  auditLogs,
  users,
  messageFingerprints,
  domainRules,
  groupAdmins,
  punishments,
  reviewQueue,
} from '@togi/db';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  getRaidState,
  setLockdown,
  removeLockdown,
  deactivateRaidState,
} from '../services/new-member-service.js';
import {
  getDefaultPolicy,
  validatePolicyConfig,
  mergePolicy,
  calculateSecurityScore,
  isValidMode,
  PolicyConfig,
  PolicyMode,
  BotPermissions,
} from '@togi/policy-engine';
import { getEnv } from '@togi/config';
import { requireAuth, requirePermission } from '@togi/auth/middleware';

interface GroupParams {
  id: string;
}

interface PolicyParams {
  id: string;
}

export async function registerGroupRoutes(fastify: FastifyInstance) {

  // GET /api/groups - List all groups
  fastify.get('/groups', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allGroups = await db.select().from(groups).orderBy(desc(groups.createdAt));
      return reply.send({ groups: allGroups });
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch groups');
      return reply.status(500).send({ error: 'Failed to fetch groups' });
    }
  });

  // GET /api/groups/:id - Get group details
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        return reply.send({ group });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch group');
        return reply.status(500).send({ error: 'Failed to fetch group' });
      }
    }
  );

  // GET /api/groups/:id/policy - Get group policy
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/policy',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Get the group first
        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        // Get the active policy
        const [policy] = await db
          .select()
          .from(groupPolicies)
          .where(eq(groupPolicies.groupId, id))
          .orderBy(desc(groupPolicies.version))
          .limit(1);

        if (!policy) {
          // Return default BALANCED policy
          return reply.send({
            policy: {
              mode: 'BALANCED',
              config: getDefaultPolicy('BALANCED'),
              version: 0,
              isDefault: true,
            },
          });
        }

        return reply.send({
          policy: {
            ...policy,
            isDefault: false,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch group policy');
        return reply.status(500).send({ error: 'Failed to fetch policy' });
      }
    }
  );

  // PATCH /api/groups/:id/policy - Update group policy
  fastify.patch<{ Params: GroupParams }>(
    '/groups/:id/policy',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:write')(req, reply); } },
    async (
      request: FastifyRequest<{ Params: GroupParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const body = request.body as { mode?: PolicyMode; config?: Partial<PolicyConfig> };

        // Validate mode if provided
        if (body.mode && !isValidMode(body.mode)) {
          return reply.status(400).send({ error: 'Invalid policy mode' });
        }

        // Validate config if provided
        if (body.config && !validatePolicyConfig(body.config)) {
          return reply.status(400).send({ error: 'Invalid policy configuration' });
        }

        // Get the group
        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        // Get existing policy
        const [existingPolicy] = await db
          .select()
          .from(groupPolicies)
          .where(eq(groupPolicies.groupId, id))
          .orderBy(desc(groupPolicies.version))
          .limit(1);

        const mode = body.mode || (existingPolicy?.mode as PolicyMode) || 'BALANCED';
        let newConfig: PolicyConfig;

        if (body.config) {
          // Merge with base mode config
          const baseConfig = getDefaultPolicy(mode);
          newConfig = mergePolicy(baseConfig, body.config);
        } else if (existingPolicy?.config) {
          newConfig = existingPolicy.config as PolicyConfig;
        } else {
          newConfig = getDefaultPolicy(mode);
        }

        const newVersion = existingPolicy ? existingPolicy.version + 1 : 1;

        // Insert new policy version
        const [newPolicy] = await db
          .insert(groupPolicies)
          .values({
            groupId: id,
            mode,
            config: newConfig,
            version: newVersion,
          })
          .returning();

        // Log to audit
        await db.insert(auditLogs).values({
          groupId: id,
          action: 'POLICY_UPDATE',
          targetType: 'POLICY',
          targetId: newPolicy.id,
          metadata: {
            mode,
            version: newVersion,
            previousVersion: existingPolicy?.version || 0,
          },
        });

        return reply.send({ policy: newPolicy });
      } catch (error) {
        request.log.error({ error }, 'Failed to update group policy');
        return reply.status(500).send({ error: 'Failed to update policy' });
      }
    }
  );

  // GET /api/groups/:id/security-score - Get security score
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/security-score',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('policy:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Get the group
        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        // Get the active policy
        const [policy] = await db
          .select()
          .from(groupPolicies)
          .where(eq(groupPolicies.groupId, id))
          .orderBy(desc(groupPolicies.version))
          .limit(1);

        const config = (policy?.config && typeof policy.config === 'object')
          ? policy.config as unknown as PolicyConfig
          : getDefaultPolicy('BALANCED');

        // Check for blocklist/allowlist
        const domainRulesResult = await db
          .select()
          .from(domainRules)
          .where(eq(domainRules.groupId, id));

        const hasBlocklist = domainRulesResult.some((r) => r.ruleType === 'BLOCK');
        const hasAllowlist = domainRulesResult.some((r) => r.ruleType === 'ALLOW');

        // Create a permissions object based on bot admin status
        const permissions: BotPermissions = {
          canDeleteMessages: group.botAdminStatus === 'ADMIN',
          canRestrictMembers: group.botAdminStatus === 'ADMIN',
          canChangeInfo: group.botAdminStatus === 'ADMIN',
          canInviteUsers: group.botAdminStatus === 'ADMIN',
          canPinMessages: group.botAdminStatus === 'ADMIN',
          canPromoteMembers: group.botAdminStatus === 'ADMIN',
          canManageVideoChats: group.botAdminStatus === 'ADMIN',
          isAdmin: group.botAdminStatus === 'ADMIN',
          status: group.botAdminStatus as 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN',
        };

        const securityScore = calculateSecurityScore(
          permissions,
          config,
          hasBlocklist,
          hasAllowlist,
          true // audit logging always enabled
        );

        return reply.send({
          score: securityScore,
          botAdminStatus: group.botAdminStatus,
          mode: policy?.mode || 'BALANCED',
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to calculate security score');
        return reply.status(500).send({ error: 'Failed to calculate security score' });
      }
    }
  );

  // GET /api/groups/:id/violations - Get group violations
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/violations',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('logs:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const query = request.query as { limit?: string; offset?: string };

        const limit = parseInt(query.limit || '50');
        const offset = parseInt(query.offset || '0');

        const groupViolations = await db
          .select()
          .from(violations)
          .where(eq(violations.groupId, id))
          .orderBy(desc(violations.createdAt))
          .limit(limit)
          .offset(offset);

        return reply.send({ violations: groupViolations });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch violations');
        return reply.status(500).send({ error: 'Failed to fetch violations' });
      }
    }
  );

  // GET /api/groups/:id/audit-logs - Get audit logs
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/audit-logs',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('logs:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const query = request.query as { limit?: string; offset?: string };

        const limit = parseInt(query.limit || '50');
        const offset = parseInt(query.offset || '0');

        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.groupId, id))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
          .offset(offset);

        return reply.send({ auditLogs: logs });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch audit logs');
        return reply.status(500).send({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  // GET /api/groups/:id/review-queue - Get review queue items
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/review-queue',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('reviewQueue:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const query = request.query as { status?: string; limit?: string; offset?: string };

        const status = query.status || 'PENDING';
        const limit = parseInt(query.limit || '50');
        const offset = parseInt(query.offset || '0');

        const items = await db
          .select()
          .from(reviewQueue)
          .where(and(
            eq(reviewQueue.groupId, id),
            eq(reviewQueue.status, status)
          ))
          .orderBy(desc(reviewQueue.createdAt))
          .limit(limit)
          .offset(offset);

        return reply.send({ items });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch review queue');
        return reply.status(500).send({ error: 'Failed to fetch review queue' });
      }
    }
  );

  // POST /api/groups/:id/review-queue/:itemId/approve
  fastify.post<{ Params: GroupParams & { itemId: string } }>(
    '/groups/:id/review-queue/:itemId/approve',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('reviewQueue:approve')(req, reply); } },
    async (
      request: FastifyRequest<{ Params: GroupParams & { itemId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id, itemId } = request.params;
        const body = request.body as { note?: string };
        const reviewerId = 0; // TODO: Get from auth

        const [item] = await db
          .select()
          .from(reviewQueue)
          .where(eq(reviewQueue.id, itemId))
          .limit(1);

        if (!item) {
          return reply.status(404).send({ error: 'Review item not found' });
        }

        if (item.groupId !== id) {
          return reply.status(400).send({ error: 'Item does not belong to this group' });
        }

        await db
          .update(reviewQueue)
          .set({
            status: 'APPROVED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewNote: body.note || null,
          })
          .where(eq(reviewQueue.id, itemId));

        return reply.send({ success: true });
      } catch (error) {
        request.log.error({ error }, 'Failed to approve review item');
        return reply.status(500).send({ error: 'Failed to approve item' });
      }
    }
  );

  // POST /api/groups/:id/review-queue/:itemId/reject
  fastify.post<{ Params: GroupParams & { itemId: string } }>(
    '/groups/:id/review-queue/:itemId/reject',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('reviewQueue:approve')(req, reply); } },
    async (
      request: FastifyRequest<{ Params: GroupParams & { itemId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id, itemId } = request.params;
        const body = request.body as { note?: string };
        const reviewerId = 0; // TODO: Get from auth

        const [item] = await db
          .select()
          .from(reviewQueue)
          .where(eq(reviewQueue.id, itemId))
          .limit(1);

        if (!item) {
          return reply.status(404).send({ error: 'Review item not found' });
        }

        if (item.groupId !== id) {
          return reply.status(400).send({ error: 'Item does not belong to this group' });
        }

        await db
          .update(reviewQueue)
          .set({
            status: 'REJECTED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewNote: body.note || null,
          })
          .where(eq(reviewQueue.id, itemId));

        return reply.send({ success: true });
      } catch (error) {
        request.log.error({ error }, 'Failed to reject review item');
        return reply.status(500).send({ error: 'Failed to reject item' });
      }
    }
  );

  // GET /api/groups/:id/raid-status
  fastify.get<{ Params: GroupParams }>(
    '/groups/:id/raid-status',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('logs:read')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        const raidState = await getRaidState(group.telegramChatId);

        return reply.send({
          active: raidState?.active || false,
          startedAt: raidState?.startedAt || null,
          reason: raidState?.reason || null,
          expiresAt: raidState?.expiresAt || null,
          triggerStats: raidState?.triggerStats || {
            joins: 0,
            messages: 0,
            links: 0,
            newUsersLinks: 0,
            mentions: 0,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch raid status');
        return reply.status(500).send({ error: 'Failed to fetch raid status' });
      }
    }
  );

  // POST /api/groups/:id/lockdown
  fastify.post<{ Params: GroupParams }>(
    '/groups/:id/lockdown',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('group:settings')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = request.body as { minutes?: number } || {};
        const lockdownMinutes = body.minutes || 30;

        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        await setLockdown(group.telegramChatId, lockdownMinutes);
        await deactivateRaidState(group.telegramChatId);

        return reply.send({ success: true, lockdownMinutes });
      } catch (error) {
        request.log.error({ error }, 'Failed to set lockdown');
        return reply.status(500).send({ error: 'Failed to set lockdown' });
      }
    }
  );

  // DELETE /api/groups/:id/lockdown
  fastify.delete<{ Params: GroupParams }>(
    '/groups/:id/lockdown',
    { preHandler: async (req, reply) => { await requireAuth(req, reply); if (!reply.sent) await requirePermission('group:settings')(req, reply); } },
    async (request: FastifyRequest<{ Params: GroupParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
        if (!group) {
          return reply.status(404).send({ error: 'Group not found' });
        }

        await removeLockdown(group.telegramChatId);

        return reply.send({ success: true });
      } catch (error) {
        request.log.error({ error }, 'Failed to remove lockdown');
        return reply.status(500).send({ error: 'Failed to remove lockdown' });
      }
    }
  );
}
