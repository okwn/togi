describe('Production boot validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fail to start if ENABLE_DEV_AUTH=true in production', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ENABLE_DEV_AUTH: 'true',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
    };

    // Reset module cache to get fresh env
    jest.resetModules();

    const { buildApp } = await import('../server');
    await expect(buildApp()).rejects.toThrow('ENABLE_DEV_AUTH=true is not allowed in production');
  });

  it('should fail to start if TELEGRAM_BOT_TOKEN missing in production', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
    };

    jest.resetModules();

    const { buildApp } = await import('../server');
    await expect(buildApp()).rejects.toThrow('FATAL: TELEGRAM_BOT_TOKEN is required');
  });

  it('should fail to start if JWT_SECRET less than 32 chars in production', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      JWT_SECRET: 'short',
    };

    jest.resetModules();

    const { buildApp } = await import('../server');
    await expect(buildApp()).rejects.toThrow('FATAL: JWT_SECRET must be at least 32 characters');
  });
});