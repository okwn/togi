import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    cookies: Record<string, string>;
  }

  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: {
        domain?: string;
        path?: string;
        expires?: Date;
        maxAge?: number;
        httpOnly?: boolean;
        sameSite?: 'strict' | 'lax' | 'none';
        secure?: boolean;
        encoding?: string;
      }
    ): FastifyReply;

    clearCookie(
      name: string,
      options?: {
        domain?: string;
        path?: string;
      }
    ): FastifyReply;
  }
}

export type { FastifyRequest, FastifyReply };