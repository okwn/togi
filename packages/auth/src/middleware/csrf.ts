import { FastifyRequest, FastifyReply } from 'fastify';
import { validateCsrfToken } from '../csrf';
import '../types/fastify-plugins';

export async function requireCsrf(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // GET requests are read-only, no CSRF needed
  if (request.method === 'GET') return;

  const token = request.headers['x-csrf-token'] as string | undefined;
  const session = (request as FastifyRequest & { session?: { csrfToken: string } }).session;

  if (!token || !session?.csrfToken) {
    return reply.status(403).send({
      error: { code: 'CSRF_INVALID', message: 'CSRF token required', requestId: request.id }
    });
  }

  if (!validateCsrfToken(session.csrfToken, token)) {
    return reply.status(403).send({
      error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token', requestId: request.id }
    });
  }
}