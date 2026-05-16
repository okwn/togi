import { randomBytes, createHash } from 'crypto';

describe('session utilities', () => {
  it('should hash fields consistently', () => {
    const hash = (v: string) => createHash('sha256').update(v).digest('hex');
    const result1 = hash('test-value');
    const result2 = hash('test-value');
    expect(result1).toBe(result2);
    expect(result1.length).toBe(64);  // SHA-256 hex = 64 chars
  });

  it('should generate unique CSRF tokens', () => {
    const t1 = randomBytes(32).toString('hex');
    const t2 = randomBytes(32).toString('hex');
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });
});