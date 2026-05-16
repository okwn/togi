// Security Middleware - Rate limiting with enforced blocking, auth, and abuse prevention
import { FastifyRequest, FastifyReply } from 'fastify';
import { redis, keys, auditLogs, db } from '@togi/db';
import { getEnv } from '@togi/config';
import { rateLimitService } from '../services/rate-limit-service';
import { eq } from 'drizzle-orm';

// IP-based rate limit for public endpoints
export function ipRateLimitPreHandler(windowMs: number, maxRequests: number) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    // Use X-Forwarded-For if behind proxy, else request.ip
    const forwarded = request.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0]?.trim() : request.ip;
    const ipHash = Buffer.from(ip).toString('base64').slice(0, 32);

    const result = await rateLimitService.isAllowed(`ip:${ipHash}`, windowMs, maxRequests);

    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString());

    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.retryAfterMs || 0) / 1000).toString());

      // Log the blocked attempt
      await logBlockedEvent(request, 'IP_RATE_LIMIT', { ipHash });

      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests from your IP. Please try again later.',
          requestId: request.id,
        }
      });
    }
  };
}

// Session-based rate limit for dashboard API
export function sessionRateLimitPreHandler(windowMs: number, maxRequests: number) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const sessionId = request.cookies['session_id'] || request.headers['x-session-id'] || 'anonymous';
    const result = await rateLimitService.isAllowed(`session:${sessionId}`, windowMs, maxRequests);

    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', result.remaining.toString());
    reply.header('X-RateLimit-Reset', Math.floor(result.resetAt / 1000).toString());

    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.retryAfterMs || 0) / 1000).toString());
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down.',
          requestId: request.id,
        }
      });
    }
  };
}

async function logBlockedEvent(request: FastifyRequest, eventType: string, metadata: Record<string, unknown>) {
  try {
    await db.insert(auditLogs).values({
      groupId: null,
      actorTelegramUserId: null,
      action: eventType,
      targetType: 'RATE_LIMIT',
      targetId: request.id,
      metadata: { ...metadata, ip: request.ip, userAgent: request.headers['user-agent'] },
    });
  } catch {
    // Don't fail the request if audit log fails
  }
}

// Per-group action rate limiter (keep existing function for Telegram action limiting)
export async function checkGroupActionRateLimit(
  chatId: number,
  action: string,
  maxActions: number = 10,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `action_rate:${chatId}:${action}`;
  const now = Date.now();

  try {
    await redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
    const count = await redis.zcard(key);

    if (count >= maxActions) {
      return false; // Rate limited
    }

    await redis.zadd(key, now, `${now}`);
    await redis.expire(key, windowSeconds);
    return true;
  } catch {
    return true; // Fail open
  }
}

// Per-user command rate limiter (keep existing function)
export async function checkUserCommandRateLimit(
  userId: number,
  command: string,
  maxCommands: number = 5,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `cmd_rate:${userId}:${command}`;
  const now = Date.now();

  try {
    await redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
    const count = await redis.zcard(key);

    if (count >= maxCommands) {
      return false;
    }

    await redis.zadd(key, now, `${now}`);
    await redis.expire(key, windowSeconds);
    return true;
  } catch {
    return true;
  }
}

// Global Telegram API throttle
export async function checkGlobalApiThrottle(): Promise<boolean> {
  const result = await rateLimitService.isAllowed('global_api:global', 1000, 25);
  return result.allowed;
}

// Request ID generator
export function generateRequestId(): string {
  return `togi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// IP logging middleware with rate limit tracking
export function ipLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
) {
  const ip = request.ip;
  const requestId = request.id;

  request.log.info({ requestId, ip }, 'Request from IP');
  reply.header('X-Request-ID', requestId);

  done();
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