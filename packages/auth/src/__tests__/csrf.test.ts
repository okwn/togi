import { generateCsrfToken, validateCsrfToken } from '../csrf';

describe('CSRF', () => {
  it('should generate unique tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });

  it('should validate matching tokens', () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('should reject non-matching tokens', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(validateCsrfToken(t1, t2)).toBe(false);
  });

  it('should reject empty tokens', () => {
    expect(validateCsrfToken('', 'abc')).toBe(false);
    expect(validateCsrfToken('abc', '')).toBe(false);
  });
});