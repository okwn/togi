import { FastifyRequest, FastifyReply } from 'fastify';
import { getEnv } from '@togi/config';

export interface AuthContext {
  userId?: string;
  isDevAdmin: boolean;
}

export function getDevAuthMiddleware() {
  const env = getEnv();
  const devAdminId = env.DEV_ADMIN_TELEGRAM_ID;

  return async function devAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip auth in production or if no dev admin configured
    if (env.NODE_ENV === 'production' || !devAdminId) {
      return;
    }

    // Check for dev auth header
    const devAuthHeader = request.headers['x-togi-dev-auth'];

    if (devAuthHeader === devAdminId) {
      // Valid dev admin
      request.server.addHook('onRequest', (req, res, done) => {
        (req as FastifyRequest & AuthContext).userId = devAdminId;
        (req as FastifyRequest & AuthContext).isDevAdmin = true;
        done();
      });
      return;
    }

    // For development, allow if header matches or if no header but we're in dev mode
    // This is a simple dev auth - in production this would use Telegram Login Widget
    if (env.NODE_ENV === 'development') {
      request.server.addHook('onRequest', (req, _res, done) => {
        (req as FastifyRequest & AuthContext).isDevAdmin = true;
        done();
      });
      return;
    }

    return reply.status(401).send({ error: 'Unauthorized' });
  };
}

export function requireDevAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
) {
  const env = getEnv();

  // In production, this endpoint requires proper auth
  if (env.NODE_ENV === 'production') {
    // TODO: Implement Telegram Login Widget auth
    return done(new Error('Production auth not implemented'));
  }

  // In development, allow access
  done();
}
