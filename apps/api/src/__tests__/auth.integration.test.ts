import { buildApp } from '../server';

describe('Auth API integration tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/telegram/callback', () => {
    it('should return 400 without initData', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/telegram/callback',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 401 with invalid hash', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/telegram/callback',
        payload: { initData: 'auth_date=1&hash=invalid&user={}' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('INVALID_HASH');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/groups', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/groups',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/groups/:id/policy', () => {
    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/groups/fake-id/policy',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});