declare module 'ioredis-mock' {
  namespace Redis {
    interface Redis {
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
  }

  class Redis {
    constructor(options?: any);
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

  export default Redis;
}