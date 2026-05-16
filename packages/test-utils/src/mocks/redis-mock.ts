import Redis from 'ioredis-mock';

export function createMockRedis() {
  const redis = new Redis();
  return redis;
}

// Redis client interface matching what detectors need
export interface MockRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, ...args: any[]): Promise<any>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  lpush(key: string, ...values: any[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<string>;
  llen(key: string): Promise<number>;
  hset(key: string, ...fieldAndValues: any[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  expireat(key: string, timestamp: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

export function createMockRedisClient(): MockRedisClient {
  const redis = createMockRedis();
  return {
    get: redis.get.bind(redis),
    set: redis.set.bind(redis),
    del: redis.del.bind(redis),
    incr: redis.incr.bind(redis),
    expire: redis.expire.bind(redis),
    ttl: redis.ttl.bind(redis),
    lpush: redis.lpush.bind(redis),
    lrange: redis.lrange.bind(redis),
    ltrim: redis.ltrim.bind(redis),
    llen: redis.llen.bind(redis),
    hset: redis.hset.bind(redis),
    hget: redis.hget.bind(redis),
    hdel: redis.hdel.bind(redis),
    hgetall: redis.hgetall.bind(redis),
    expireat: redis.expireat.bind(redis),
    keys: redis.keys.bind(redis),
  };
}