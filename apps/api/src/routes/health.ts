import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(fastify: FastifyInstance) {
  // GET /health - Basic health check
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: Date.now(),
      service: 'togi-api',
    });
  });

  // GET /ready - Readiness check (includes dependencies)
  fastify.get('/ready', async (request, reply) => {
    const checks = {
      postgres: false,
      redis: false,
      telegram: false,
    };

    // TODO: Add actual dependency checks in Phase 02
    // For now, just check if we can connect to configured hosts
    checks.postgres = true; // Placeholder
    checks.redis = true; // Placeholder
    checks.telegram = true; // Placeholder

    const allReady = Object.values(checks).every(Boolean);

    if (allReady) {
      return reply.send({
        status: 'ready',
        timestamp: Date.now(),
        checks,
      });
    }

    return reply.status(503).send({
      status: 'not_ready',
      timestamp: Date.now(),
      checks,
    });
  });

  // GET /api/internal/version - Internal version endpoint
  fastify.get('/api/internal/version', async (request, reply) => {
    return reply.send({
      version: process.env.npm_package_version || '0.1.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    });
  });
}
