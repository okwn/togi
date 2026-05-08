// Suspicious TLDs that are commonly used in scams

export const SUSPICIOUS_TLDS = [
  // Crypto/fraud associated TLDs
  '.top',
  '.xyz',
  '.buzz',
  '.cyou',
  '.sbs',
  '.tokyo',
  '.cam',
  '.kred',
  '.mom',
  '.autos',
  '.clinics',
  '.wedding',
  '.horse',
  '.casa',
  '.makeup',
  '.hair',
  '.ltd',
  '.gmbh',
  '.орг', // Cyrillic
  '.рф',  // Cyrillic
  '.中国',
  '.한국',
  '.日本',
  '.বাংলা',
  '.مصر', // Arabic
  '.سعودية',
  '.கொழும்பு',
  '.tab',
  '.fit',
  '.beauty',
  '.law',
  '.download',
  '.stream',
  '.gdn',
  '.rest',
  '.bond',
  '.info',
  '.mobi',
  '.pro',
  '.work',
  '.click',
  '.link',
  '.win',
  '.online',
  '.site',
  '.space',
  '.website',
  '.pub',
  '.life',
  '.trade',
  '.zone',
  '.city',
  '.shop',
  '.store',
  '.tech',
  '.fun',
  '.club',
  '.game',
  '.poker',
  '.casino',
  '.bet',
  '.gambling',
];

export const SUSPICIOUS_TLD_PATTERNS = [
  /\.(top|xyz|buzz|cyou|sbs|cam|kred|autos|clinics|wedding)/i,
  /\.(ltd|gmbh|work|click|link|win|online|site|space|website)/i,
  /\.(trade|zone|city|shop|store|tech|fun|club|game|poker|casino)/i,
  /[\.рф\.орг\.中国\.한국\.日本\.مصر\.سعودية]/i,
];

export function hasSuspiciousTLD(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.hostname;

    for (const tld of SUSPICIOUS_TLDS) {
      if (pathname.endsWith(tld)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}
