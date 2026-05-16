import { FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { db, groupAdmins } from '@togi/db';
import { eq, and, isNull } from 'drizzle-orm';
import { hasPermission, type Permission, type Role } from '../rbac';

export function requirePermission(permission: Permission) {
  return async function(
    request: FastifyRequest<RouteGenericInterface>,
    reply: FastifyReply
  ): Promise<void> {
    const session = (request as FastifyRequest & { session?: { telegramUserId: number } }).session;
    if (!session?.telegramUserId) {
      return reply.status(401).send({
        error: { code: 'AUTH_REQUIRED', message: 'Not authenticated', requestId: request.id }
      });
    }

    const params = request.params as { groupId?: string; id?: string };
    const groupId = params.groupId || params.id;
    if (!groupId) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'groupId required', requestId: request.id }
      });
    }

    const [admin] = await db
      .select()
      .from(groupAdmins)
      .where(and(
        eq(groupAdmins.groupId, groupId),
        eq(groupAdmins.telegramUserId, session.telegramUserId),
        isNull(groupAdmins.revokedAt)
      ))
      .limit(1);

    if (!admin) {
      return reply.status(403).send({
        error: { code: 'ACCESS_DENIED', message: 'You do not have access to this group', requestId: request.id }
      });
    }

    const role = admin.role as Role;
    if (!hasPermission(role, permission)) {
      return reply.status(403).send({
        error: { code: 'ACCESS_DENIED', message: `Permission denied: ${permission}`, requestId: request.id }
      });
    }
  };
}