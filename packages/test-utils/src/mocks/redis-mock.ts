import Redis from 'ioredis-mock';

export function createMockRedis() {
  const redis = new Redis();
  return redis;
}

// Redis client interface matching what detectors need
export interface MockRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, ...args: any[]): Promise<any>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  expireat(key: string, timestamp: number): Promise<number>;
  ttl(key: string): Promise<number>;
  lpush(key: string, ...values: any[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<string>;
  llen(key: string): Promise<number>;
  hset(key: string, ...fieldAndValues: any[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  // Set operations (for auth/sessions)
  sadd(key: string, ...members: any[]): Promise<number>;
  sismember(key: string, member: any): Promise<number>;
  srem(key: string, ...members: any[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  // Sorted set operations (for rate limiting)
  zadd(key: string, score: number, member: any): Promise<number>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
}

export function createMockRedisClient(): MockRedisClient {
  const redis = createMockRedis() as any;
  return {
    get: redis.get.bind(redis),
    set: redis.set.bind(redis),
    setex: redis.setex.bind(redis),
    del: redis.del.bind(redis),
    incr: redis.incr.bind(redis),
    expire: redis.expire.bind(redis),
    expireat: redis.expireat.bind(redis),
    ttl: redis.ttl.bind(redis),
    lpush: redis.lpush.bind(redis),
    lrange: redis.lrange.bind(redis),
    ltrim: redis.ltrim.bind(redis),
    llen: redis.llen.bind(redis),
    hset: (key: string, ...fieldAndValues: any[]) => {
      // Handle object argument: hset(key, { field: value }) -> use hmset
      if (fieldAndValues.length === 1 && typeof fieldAndValues[0] === 'object' && fieldAndValues[0] !== null) {
        return redis.hmset(key, fieldAndValues[0]);
      }
      return redis.hset(key, ...fieldAndValues);
    },
    hget: redis.hget.bind(redis),
    hdel: redis.hdel.bind(redis),
    hgetall: redis.hgetall.bind(redis),
    hincrby: redis.hincrby.bind(redis),
    keys: redis.keys.bind(redis),
    // Set operations
    sadd: redis.sadd.bind(redis),
    sismember: redis.sismember.bind(redis),
    srem: redis.srem.bind(redis),
    smembers: redis.smembers.bind(redis),
    // Sorted set operations
    zadd: redis.zadd.bind(redis),
    zcard: redis.zcard.bind(redis),
    zremrangebyscore: redis.zremrangebyscore.bind(redis),
  };
}