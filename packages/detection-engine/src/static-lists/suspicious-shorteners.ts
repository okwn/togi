// Suspicious URL shorteners that may hide malicious domains
export const SUSPICIOUS_SHORTENERS = [
  // General shorteners
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'j.mp',
  'mcaf.ee',
  'tiny.cc',
  'tr.im',
  'su.pr',
  'fb.me',
  '幻',

  // Crypto-focused shorteners
  'bit.do',
  't2mio.com',
  'clkmy.com',
  'shorturl.at',
  'gg Ip',
  'cutt.ly',
  'cutt.us',

  // Suspicious patterns (domain-only part after removing known TLDs)
  'short.link',
  'fast.link',
  'click.link',
  'mega.link',
  'free.link',
  'airdrop.link',
  'claim.link',
  'wallet.connect',
];

export function isSuspiciousShortener(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    for (const shortener of SUSPICIOUS_SHORTENERS) {
      if (hostname === shortener || hostname.endsWith('.' + shortener)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function normalizeShortener(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}
