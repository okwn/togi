import { createHmac, timingSafeEqual } from 'crypto';

const MAX_AGE_SECONDS = 24 * 3600;

export interface VerifiedUser {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
}

export function verifyInitData(initDataStr: string, botToken: string): VerifiedUser | null {
  const params = new URLSearchParams(initDataStr);
  const authDateStr = params.get('auth_date');
  const hash = params.get('hash');

  if (!authDateStr || !hash) return null;

  const authDate = parseInt(authDateStr, 10);
  if (isNaN(authDate)) return null;

  // Check auth_date freshness
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AGE_SECONDS) return null;

  // Build data check string (all fields except hash, sorted alphabetically)
  const fields: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== 'hash') fields.push([key, value]);
  });
  fields.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join('\n');

  // Compute HMAC-SHA256
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time comparison
  const hashBuf = Buffer.from(hash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  if (hashBuf.length !== computedBuf.length) return null;
  if (!timingSafeEqual(hashBuf, computedBuf)) return null;

  // Parse user
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return {
      telegramUserId: user.id,
      username: user.username || null,
      firstName: user.first_name,
      lastName: user.last_name || null,
      languageCode: user.language_code || null,
    };
  } catch {
    return null;
  }
}