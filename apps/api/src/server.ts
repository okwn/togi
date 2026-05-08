import { FastifyInstance } from 'fastify';
import { createServer } from './logger';
import { registerWebhookRoutes } from './routes/webhook';
import { registerHealthRoutes } from './routes/health';
import { registerGroupRoutes } from './routes/groups';
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

  // Initialize Telegram bot and action executor
  bot = createTelegramBot({
    botToken: env.TELEGRAM_BOT_TOKEN || 'dev-placeholder-token',
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
  });

  actionExecutor = new TelegramActionExecutor(bot.Bot, redis);

  // Register routes
  await registerHealthRoutes(server);
  await registerGroupRoutes(server);
  await registerWebhookRoutes(server, { bot, actionExecutor, env });

  return server;
}

async function start() {
  const env = getEnv();

  // Validate required env vars
  if (env.NODE_ENV === 'production' && !env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is required in production');
    process.exit(1);
  }

  if (env.NODE_ENV === 'production' && !env.TELEGRAM_WEBHOOK_SECRET) {
    console.error('TELEGRAM_WEBHOOK_SECRET is required in production');
    process.exit(1);
  }

  if (env.DEBUG_LOG_RAW_TEXT === 'true' && env.NODE_ENV === 'production') {
    console.error('DEBUG_LOG_RAW_TEXT=true is not allowed in production');
    process.exit(1);
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
