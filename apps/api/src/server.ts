import { FastifyInstance } from 'fastify';
import { createServer } from './logger';
import { registerWebhookRoutes } from './routes/webhook';
import { registerHealthRoutes } from './routes/health';
import { registerGroupRoutes } from './routes/groups';
import { registerSecurityHeaders } from './plugins/security-headers';
import { registerCors } from './plugins/cors-config';
import { registerAuthRoutes } from '@togi/auth';
import { TelegramBot, TelegramActionExecutor, createTelegramBot } from '@togi/telegram-client';
import { getEnv } from '@togi/config';
import { createSecurityEvent, enqueueSecurityEvent } from '@togi/shared';
import { redis } from '@togi/db';

let bot: TelegramBot | null = null;
let actionExecutor: TelegramActionExecutor | null = null;

async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();

  const server = await createServer(
    { host: env.API_HOST, port: env.API_PORT },
    { level: env.LOG_LEVEL }
  );
  server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body.toString()));
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  // Set body size limit (defensive - may fail in some fastify versions)
  try {
    Object.defineProperty(server, 'initialConfig', {
      value: { ...server.initialConfig, bodyLimit: env.WEBHOOK_BODY_MAX_BYTES },
      writable: true,
      configurable: true,
    });
  } catch {
    // Ignore - bodyLimit is read-only in this fastify version
  }

  // Register security plugins
  registerSecurityHeaders(server);
  registerCors(server);

  // Initialize Telegram bot and action executor
  bot = createTelegramBot({
    botToken: env.TELEGRAM_BOT_TOKEN || 'dev-placeholder-token',
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
  });

  actionExecutor = new TelegramActionExecutor(bot.Bot, redis);

  // Register routes
  await registerHealthRoutes(server);
  await registerGroupRoutes(server);
  await registerAuthRoutes(server);
  await registerWebhookRoutes(server, { bot, actionExecutor, env });

  return server;
}

async function start() {
  const env = getEnv();

  // Production boot validation — FAIL FAST
  if (env.NODE_ENV === 'production') {
    if (process.env.ENABLE_DEV_AUTH === 'true') {
      throw new Error('FATAL: ENABLE_DEV_AUTH=true is not allowed in production');
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new Error('FATAL: TELEGRAM_BOT_TOKEN is required');
    }
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error('FATAL: TELEGRAM_WEBHOOK_SECRET is required');
    }
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters');
    }
  }

  const server = await buildApp();

  try {
    await server.listen({ host: env.API_HOST, port: env.API_PORT });
    console.log(`🚀 TOGI API running on http://${env.API_HOST}:${env.API_PORT}`);
    console.log(`📋 Health: http://${env.API_HOST}:${env.API_PORT}/health`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
