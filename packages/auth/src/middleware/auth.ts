import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession } from '../session';
import type { SessionWithUser } from '../session';
import '../types/fastify-plugins';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionWithUser['user'];
    session: SessionWithUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.cookies['session_id'];
  if (!sessionId) {
    return reply.status(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'No session cookie', requestId: request.id }
    });
  }

  const session = await validateSession(sessionId);
  if (!session) {
    return reply.status(401).send({
      error: { code: 'SESSION_EXPIRED', message: 'Session invalid or expired', requestId: request.id }
    });
  }

  request.user = session.user;
  request.session = session;
}