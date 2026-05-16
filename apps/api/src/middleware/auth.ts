// Production-safe auth middleware — no dev bypasses
import { getEnv } from '@togi/config';

export function getDevAuthMiddleware() {
  const env = getEnv();

  return async function devAuthMiddleware(
    request: any,
    reply: any
  ): Promise<void> {
    // PRODUCTION: never allow dev auth bypass
    if (env.NODE_ENV === 'production') {
      return reply.status(401).send({
        error: {
          code: 'AUTH_NOT_IMPLEMENTED',
          message: 'Production auth uses Telegram Login Widget',
        },
      });
    }

    // DEVELOPMENT ONLY: explicit flag required
    if (env.ENABLE_DEV_AUTH !== 'true') {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Dev auth not enabled' },
      });
    }

    request.isDevAdmin = true;
  };
}

export function requireDevAuth(
  request: any,
  reply: any,
  done: (err?: Error) => void
) {
  const env = getEnv();

  if (env.NODE_ENV === 'production') {
    return done(new Error('Production auth not implemented'));
  }

  if (env.ENABLE_DEV_AUTH !== 'true') {
    return done(new Error('Dev auth not enabled'));
  }

  done();
}