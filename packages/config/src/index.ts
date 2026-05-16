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

  // Rate Limiting
  RATE_LIMIT_PUBLIC_AUTH_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_PUBLIC_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_DASHBOARD_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_DASHBOARD_MAX: z.coerce.number().default(100),
  RATE_LIMIT_POLICY_WINDOW_MS: z.coerce.number().default(300000),
  RATE_LIMIT_POLICY_MAX: z.coerce.number().default(10),
  RATE_LIMIT_DOMAIN_RULES_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_DOMAIN_RULES_MAX: z.coerce.number().default(20),
  RATE_LIMIT_REVIEW_QUEUE_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_REVIEW_QUEUE_MAX: z.coerce.number().default(30),
  RATE_LIMIT_WEBHOOK_WINDOW_MS: z.coerce.number().default(1000),
  RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().default(30),
  RATE_LIMIT_ABUSE_FAILED_LOGIN_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_ABUSE_FAILED_LOGIN_MAX: z.coerce.number().default(5),
  RATE_LIMIT_ABUSE_BLOCK_DURATION_MS: z.coerce.number().default(3600000),

  // Webhook
  WEBHOOK_BODY_MAX_BYTES: z.coerce.number().default(65536),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:4320'),

  // Degraded Mode
  REDIS_DEGRADED_MODE: z.enum(['fail_closed', 'fail_open']).default('fail_open'),
  DB_DEGRADED_MODE: z.enum(['fail_closed', 'fail_open']).default('fail_closed'),

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
