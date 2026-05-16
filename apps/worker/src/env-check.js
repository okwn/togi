import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  WORKER_METRICS_PORT: z.coerce.number().default(4390),

  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string(),
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  console.error('Environment validation failed:\n' + errors.join('\n'));
  process.exit(1);
}

console.log('Environment validation passed');