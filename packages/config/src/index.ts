import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // API Server
  API_PORT: z.coerce.number().default(4310),
  API_HOST: z.string().default('0.0.0.0'),

  // Web Dashboard
  WEB_PORT: z.coerce.number().default(4320),

  // Worker
  WORKER_METRICS_PORT: z.coerce.number().default(4390),

  // PostgreSQL
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('togi'),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string().default('togi'),
  DATABASE_URL: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().default('change-me-in-production'),

  // Security
  DEBUG_LOG_RAW_TEXT: z.enum(['true', 'false']).default('false'),
  ENABLE_DEV_AUTH: z.enum(['true', 'false']).default('false'),

  // Development
  DEV_ADMIN_TELEGRAM_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let cachedConfig: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Invalid environment variables:\n${errors.join('\n')}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function validateEnv(): EnvConfig {
  return getEnv();
}
