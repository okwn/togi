import { verifyInitData } from '../verify-init-data';
import { createHmac } from 'crypto';

describe('verifyInitData', () => {
  const botToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  const user = {
    id: 111,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
  };

  function buildValidInitData(authDateOffsetSeconds = 0): string {
    const auth_date = Math.floor(Date.now() / 1000) + authDateOffsetSeconds;
    const fields: Record<string, string> = {
      auth_date: auth_date.toString(),
      user: JSON.stringify(user),
    };
    const sorted = Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = createHmac('sha256', secret).update(sorted).digest('hex');
    return Object.entries({ ...fields, hash: hmac })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
  }

  it('should verify valid initData', () => {
    const initDataStr = buildValidInitData(0);
    const result = verifyInitData(initDataStr, botToken);
    expect(result).not.toBeNull();
    expect(result!.telegramUserId).toBe(111);
    expect(result!.username).toBe('testuser');
    expect(result!.firstName).toBe('Test');
  });

  it('should reject expired auth_date (>24h)', () => {
    const initDataStr = buildValidInitData(-25 * 3600);
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });

  it('should reject invalid hash', () => {
    const auth_date = Math.floor(Date.now() / 1000).toString();
    const initDataStr = `auth_date=${auth_date}&hash=0000000000000000000000000000000000000000000000000000000000000000&user=${encodeURIComponent(JSON.stringify(user))}`;
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });

  it('should reject missing user field', () => {
    const auth_date = Math.floor(Date.now() / 1000).toString();
    const initDataStr = `auth_date=${auth_date}&hash=dummy`;
    const result = verifyInitData(initDataStr, botToken);
    expect(result).toBeNull();
  });
});