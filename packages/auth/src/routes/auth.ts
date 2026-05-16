import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyInitData } from '../verify-init-data';
import { createSession, validateSession, revokeSession } from '../session';
import { requireAuth } from '../middleware/auth';
import { db, users, groupAdmins, groups } from '@togi/db';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ROLE_PERMISSIONS } from '../rbac';
import '../types/fastify-plugins';

const telegramCallbackSchema = z.object({
  initData: z.string().min(1),
});

const roleChangeSchema = z.object({
  telegramUserId: z.number(),
  role: z.enum(['SUPERVISOR', 'MODERATOR', 'VIEWER']).nullable(),
});

export async function registerAuthRoutes(fastify: FastifyInstance) {
  const env = process.env;

  // POST /api/auth/telegram/callback
  fastify.post('/auth/telegram/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = telegramCallbackSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'initData required', requestId: request.id }
      });
    }

    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Bot token not configured', requestId: request.id }
      });
    }

    const verified = verifyInitData(body.data.initData, botToken);
    if (!verified) {
      return reply.status(401).send({
        error: { code: 'INVALID_HASH', message: 'Invalid Telegram login', requestId: request.id }
      });
    }

    // Upsert user
    const [user] = await db
      .insert(users)
      .values({
        telegramUserId: verified.telegramUserId,
        username: verified.username,
        firstName: verified.firstName,
        lastName: verified.lastName,
        languageCode: verified.languageCode,
      })
      .onConflictDoUpdate({
        target: users.telegramUserId,
        set: {
          username: verified.username,
          firstName: verified.firstName,
          lastName: verified.lastName,
          languageCode: verified.languageCode,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Create session
    const session = await createSession({
      telegramUserId: verified.telegramUserId,
      userAgent: request.headers['user-agent'] || '',
      ip: request.ip,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    reply.setCookie('session_id', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return reply.send({
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      csrfToken: session.csrfToken,
    });
  });

  // GET /api/auth/me
  fastify.get('/auth/me', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;

    const memberships = await db
      .select({
        groupId: groupAdmins.groupId,
        role: groupAdmins.role,
        permissions: groupAdmins.permissions,
        group: {
          telegramChatId: groups.telegramChatId,
          title: groups.title,
          status: groups.status,
        },
      })
      .from(groupAdmins)
      .innerJoin(groups, eq(groupAdmins.groupId, groups.id))
      .where(and(
        eq(groupAdmins.telegramUserId, session.telegramUserId),
        isNull(groupAdmins.revokedAt)
      ));

    return reply.send({
      user: request.user,
      groups: memberships.map(m => ({
        groupId: m.groupId,
        telegramChatId: m.group.telegramChatId,
        title: m.group.title,
        role: m.role,
        permissions: m.permissions,
        status: m.group.status,
      })),
    });
  });

  // GET /api/auth/session
  fastify.get('/auth/session', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
    return reply.send({
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      csrfToken: session.csrfToken,
      user: { telegramUserId: session.telegramUserId, username: null },
    });
  });

  // POST /api/auth/logout
  fastify.post('/auth/logout', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies['session_id'];
    if (sessionId) {
      await revokeSession(sessionId);
    }
    reply.clearCookie('session_id', { path: '/' });
    return reply.send({ ok: true });
  });

  // POST /api/auth/groups/:groupId/role
  fastify.post<{ Params: { groupId: string } }>(
    '/auth/groups/:groupId/role',
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { groupId: string } }>, reply: FastifyReply) => {
      const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
      const body = roleChangeSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } });
      }

      const { groupId } = request.params;
      const { telegramUserId, role } = body.data;

      const [requesterAdmin] = await db
        .select()
        .from(groupAdmins)
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, session.telegramUserId),
          isNull(groupAdmins.revokedAt)
        ))
        .limit(1);

      if (!requesterAdmin || requesterAdmin.role !== 'OWNER') {
        return reply.status(403).send({
          error: { code: 'OWNER_REQUIRED', message: 'Only OWNER can manage roles', requestId: request.id }
        });
      }

      if (role === null) {
        await db
          .update(groupAdmins)
          .set({ revokedAt: new Date() })
          .where(and(
            eq(groupAdmins.groupId, groupId),
            eq(groupAdmins.telegramUserId, telegramUserId)
          ));
      } else {
        const [existingAdmin] = await db
          .select()
          .from(groupAdmins)
          .where(and(
            eq(groupAdmins.groupId, groupId),
            eq(groupAdmins.telegramUserId, telegramUserId)
          ))
          .limit(1);

        if (existingAdmin) {
          await db
            .update(groupAdmins)
            .set({ role, permissions: ROLE_PERMISSIONS[role], revokedAt: null, verifiedAt: new Date() })
            .where(eq(groupAdmins.id, existingAdmin.id));
        } else {
          await db
            .insert(groupAdmins)
            .values({
              groupId,
              telegramUserId,
              role,
              permissions: ROLE_PERMISSIONS[role],
              addedByTelegramUserId: session.telegramUserId,
              verifiedAt: new Date(),
            });
        }
      }

      return reply.send({ ok: true });
    }
  );

  // DELETE /api/auth/groups/:groupId/admins/:userId
  fastify.delete<{ Params: { groupId: string; userId: string } }>(
    '/auth/groups/:groupId/admins/:userId',
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Params: { groupId: string; userId: string } }>, reply: FastifyReply) => {
      const session = (request as FastifyRequest & { session: NonNullable<typeof request.session> }).session;
      const { groupId, userId } = request.params;

      const [requesterAdmin] = await db
        .select()
        .from(groupAdmins)
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, session.telegramUserId),
          isNull(groupAdmins.revokedAt)
        ))
        .limit(1);

      if (!requesterAdmin || requesterAdmin.role !== 'OWNER') {
        return reply.status(403).send({
          error: { code: 'OWNER_REQUIRED', message: 'Only OWNER can remove admins', requestId: request.id }
        });
      }

      await db
        .update(groupAdmins)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.telegramUserId, parseInt(userId, 10))
        ));

      return reply.send({ ok: true });
    }
  );
}