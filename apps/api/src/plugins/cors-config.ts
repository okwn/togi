import { FastifyInstance } from 'fastify';
import { getEnv } from '@togi/config';

export function registerCors(app: FastifyInstance) {
  const env = getEnv();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim());

  app.register(async (instance) => {
    instance.addHook('preHandler', async (request, reply) => {
      const origin = request.headers.origin;
      if (!origin) return;

      // In production, never allow wildcard
      if (env.NODE_ENV === 'production' && env.CORS_ALLOWED_ORIGINS === '*') {
        request.log.error('FATAL: Wildcard CORS not allowed in production');
        return reply.status(500).send({ error: 'Server misconfigured: CORS wildcard in production' });
      }

      if (allowedOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With');
        reply.header('Access-Control-Max-Age', '86400');
      }
    });

    instance.options('*', async (request, reply) => {
      return reply.status(204);
    });
  });
}