import { buildApp } from '../server';

describe('CORS security', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CORS allowlist', () => {
    it('should not allow arbitrary origins', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/',
        headers: { origin: 'https://evil.com' },
      });
      // Should not expose Access-Control-Allow-Origin for untrusted origins
      const corsHeader = res.headers['access-control-allow-origin'];
      if (corsHeader) {
        expect(corsHeader).not.toBe('*');
        expect(['http://localhost:4320', 'https://dashboard.example.com']).toContain(corsHeader);
      }
    });
  });

  describe('Security headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include Referrer-Policy header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });
});