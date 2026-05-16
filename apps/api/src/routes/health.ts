import { FastifyInstance } from 'fastify';
import { getPrometheusMetrics } from '../services/metrics';
import { redis, db } from '@togi/db';
import { sql } from 'drizzle-orm';

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

    // Check Redis connection
    try {
      await redis.ping();
      checks.redis = true;
    } catch (err) {
      request.log.error({ err }, 'Redis health check failed');
    }

    // Check PostgreSQL connection
    try {
      await db.execute(sql`SELECT 1`);
      checks.postgres = true;
    } catch (err) {
      request.log.error({ err }, 'Postgres health check failed');
    }

    // Telegram check would require API call - skip for now
    checks.telegram = true;

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

  // GET /metrics - Prometheus metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    const metricsOutput = getPrometheusMetrics();
    return reply
      .header('Content-Type', 'text/plain; version=0.0.4')
      .send(metricsOutput);
  });
}
