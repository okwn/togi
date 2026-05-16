import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none';"
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  });
}