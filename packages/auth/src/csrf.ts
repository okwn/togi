import { timingSafeEqual } from 'crypto';
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCsrfToken(stored: string, provided: string): boolean {
  if (!stored || !provided) return false;
  if (stored.length !== provided.length) return false;
  const storedBuf = Buffer.from(stored, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  return timingSafeEqual(storedBuf, providedBuf);
}