import * as crypto from 'crypto';

const TEXT_HASH_ALGORITHM = 'sha256';

export function hashText(text: string): string {
  return crypto.createHash(TEXT_HASH_ALGORITHM).update(text).digest('hex');
}

export function createTextHash(text: string): {
  hash: string;
  length: number;
} {
  return {
    hash: hashText(text),
    length: text.length,
  };
}
