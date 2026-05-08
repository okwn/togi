// Security Middleware - Rate limiting, auth, and abuse prevention
import { FastifyRequest, FastifyReply } from 'fastify';
import { redis, keys } from '@togi/db';
import { getEnv } from '@togi/config';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async isAllowed(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const count = await redis.zcard(key);

    if (count >= this.config.maxRequests) {
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length >= 2 ? parseInt(oldest[1]) + this.config.windowMs : now + this.config.windowMs;
      return { allowed: false, remaining: 0, resetAt };
    }

    // Add new request
    await redis.zadd(key, now, `${now}_${Math.random().toString(36).slice(2)}`);
    await redis.expire(key, Math.ceil(this.config.windowMs / 1000));

    return {
      allowed: true,
      remaining: this.config.maxRequests - count - 1,
      resetAt: now + this.config.windowMs,
    };
  }
}

// Per-group action rate limiter
export async function checkGroupActionRateLimit(
  chatId: number,
  action: string,
  maxActions: number = 10,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `action_rate:${chatId}:${action}`;
  const now = Date.now();

  await redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
  const count = await redis.zcard(key);

  if (count >= maxActions) {
    return false; // Rate limited
  }

  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, windowSeconds);
  return true;
}

// Per-user command rate limiter
export async function checkUserCommandRateLimit(
  userId: number,
  command: string,
  maxCommands: number = 5,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `cmd_rate:${userId}:${command}`;
  const now = Date.now();

  await redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
  const count = await redis.zcard(key);

  if (count >= maxCommands) {
    return false; // Rate limited
  }

  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, windowSeconds);
  return true;
}

// Global Telegram API throttle
const globalApiThrottle = new RateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 25, // Telegram limits 30 msg/sec per chat, be safe with 25
  keyPrefix: 'global_api',
});

export async function checkGlobalApiThrottle(): Promise<boolean> {
  const result = await globalApiThrottle.isAllowed('global');
  return result.allowed;
}

// Request ID generator
export function generateRequestId(): string {
  return `togi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// IP logging middleware (logs IP but doesn't block by default)
export function ipLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
) {
  const ip = request.ip;
  const requestId = request.id;

  // Log IP for audit purposes - we log but don't block
  request.log.info({ requestId, ip }, 'Request from IP');

  // Add request ID to response headers for tracing
  reply.header('X-Request-ID', requestId);

  done();
}

// Production auth check
export async function requireProductionAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const env = getEnv();

  if (env.NODE_ENV !== 'production') {
    return; // Skip auth in dev
  }

  // TODO: Implement Telegram Login Widget auth
  // For now, reject in production
  return reply.status(401).send({
    error: 'Unauthorized',
    code: 'AUTH_NOT_IMPLEMENTED',
    message: 'Production auth uses Telegram Login Widget (not yet implemented)',
  });
}

// Structured error codes
export enum ErrorCode {
  INVALID_UPDATE = 'INVALID_UPDATE',
  MISSING_SECRET = 'MISSING_SECRET',
  INVALID_SECRET = 'INVALID_SECRET',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',
  BOT_NOT_ADMIN = 'BOT_NOT_ADMIN',
  DB_ERROR = 'DB_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  TELEGRAM_ERROR = 'TELEGRAM_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface StructuredError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function createError(code: ErrorCode, message: string, details?: unknown, requestId?: string): StructuredError {
  return { code, message, details, requestId };
}

export function isStructuredError(error: unknown): error is StructuredError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
