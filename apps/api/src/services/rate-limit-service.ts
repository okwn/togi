import { redis } from '@togi/db';
import { getEnv } from '@togi/config';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export class RateLimitService {
  async isAllowed(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    try {
      // Remove old entries outside the window
      await redis.zremrangebyscore(redisKey, 0, windowStart);

      // Count current requests in window
      const count = await redis.zcard(redisKey);

      if (count >= maxRequests) {
        const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        const resetAt = oldest.length >= 2
          ? parseInt(oldest[1]) + windowMs
          : now + windowMs;
        const retryAfterMs = resetAt - now;
        return { allowed: false, remaining: 0, resetAt, retryAfterMs };
      }

      // Add new request with unique member
      await redis.zadd(redisKey, now, `${now}:${Math.random().toString(36).slice(2, 10)}`);
      await redis.expire(redisKey, Math.ceil(windowMs / 1000) + 1);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
        resetAt: now + windowMs,
      };
    } catch (err) {
      // Redis unavailable: fail open for read-heavy, fail closed for mutations
      const isMutation = key.includes('policy') || key.includes('domain') || key.includes('review');
      if (isMutation) {
        return { allowed: false, remaining: 0, resetAt: Date.now() + 5000, retryAfterMs: 5000 };
      }
      return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
    }
  }

  async checkAbuseFailedLogin(ipHash: string): Promise<boolean> {
    const env = getEnv();
    const key = `abuse:failed_login:${ipHash}`;
    const now = Date.now();

    try {
      const count = await redis.zcard(key);
      if (count >= env.RATE_LIMIT_ABUSE_FAILED_LOGIN_MAX) {
        return true; // Blocked
      }
      await redis.zadd(key, now, `${now}`);
      await redis.expire(key, Math.ceil(env.RATE_LIMIT_ABUSE_FAILED_LOGIN_WINDOW_MS / 1000));
      return false;
    } catch {
      return false; // Fail open on Redis error
    }
  }
}

export const rateLimitService = new RateLimitService();

// Fastify preHandler factory for rate limiting
export function rateLimitPreHandler(config: {
  keyFn: (req: FastifyRequest) => string;
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const key = `${config.keyPrefix}:${config.keyFn(request)}`;
    const result = await rateLimitService.isAllowed(key, config.windowMs, config.maxRequests);

    reply.header('X-RateLimit-Limit', config.maxRequests.toString());
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