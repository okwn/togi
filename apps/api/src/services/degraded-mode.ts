// apps/api/src/services/degraded-mode.ts
import { redis } from '@togi/db';
import { getEnv } from '@togi/config';

export enum DegradedComponent {
  REDIS = 'REDIS',
  DB = 'DB',
}

let redisAvailable = true;
let dbAvailable = true;

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function isDbAvailable(): boolean {
  return dbAvailable;
}

export function setRedisAvailable(available: boolean): void {
  if (redisAvailable !== available) {
    redisAvailable = available;
    console.warn(`[DEGRADED] Redis ${available ? 'restored' : 'unavailable'}`);
  }
}

export function setDbAvailable(available: boolean): void {
  if (dbAvailable !== available) {
    dbAvailable = available;
    console.warn(`[DEGRADED] Database ${available ? 'restored' : 'unavailable'}`);
  }
}

// Health check for Redis
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    const available = result === 'PONG' || result === true;
    setRedisAvailable(available);
    return available;
  } catch {
    setRedisAvailable(false);
    return false;
  }
}

// For webhook: if Redis is down, use fail_open (allow minimal processing)
export function shouldWebhookProcessDestructively(): boolean {
  const env = getEnv();
  if (!isRedisAvailable()) {
    return env.REDIS_DEGRADED_MODE === 'fail_open';
  }
  return true;
}

// For dashboard mutations: if Redis is down, fail closed
export function shouldAllowMutation(): boolean {
  const env = getEnv();
  if (!isRedisAvailable()) {
    return env.REDIS_DEGRADED_MODE === 'fail_open';
  }
  return true;
}