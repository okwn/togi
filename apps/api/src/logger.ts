import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getEnv } from '@togi/config';

export interface LoggerConfig {
  level: string;
}

export interface ServerConfig {
  host: string;
  port: number;
}

export function createLogger(config: LoggerConfig) {
  return {
    level: config.level,
    transport:
      config.level === 'debug'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  };
}

export async function createServer(config: ServerConfig, logger: LoggerConfig): Promise<FastifyInstance> {
  const env = getEnv();

  const fastify = Fastify({
    logger: createLogger(logger),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => `togi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });

  // Add request hooks for logging
  fastify.addHook('onRequest', async (request, reply) => {
    request.log.info({
      reqId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info({
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    });
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, shutting down gracefully...`);
      await fastify.close();
      process.exit(0);
    });
  }

  return fastify;
}
