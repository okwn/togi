// Domain Intelligence - URL normalization, threat detection, suspicious TLDs
import type { DomainAnalysis, DomainIntelJob } from '../types';

// Suspicious TLDs
const SUSPICIOUS_TLDS = [
  '.xyz', '.top', '.buzz', '.cyou', '.sbs', '.tk', '.ml', '.ga', '.cf', '.gq',
  '.cc', '.tv', '.ws', '.info', '.biz', '.name', '.pro', '.click', '.link',
  '.work', '.date', '.racing', '.win', '.review', '.stream', '.bid',
];

// Known URL shorteners
const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly',
  'adf.ly', 'j.mp', 'short.link', 'rb.gy', 'cutt.ly', 'tiny.cc',
  'shorturl.at', 'soo.gd', 'shorl.com', 'v.gd', 'xlinkz.com',
];

// Homograph suspicious characters (looks like latin but isn't)
const HOMOGRAPH_CHARS: [string, string][] = [
  ['а', 'a'],  // Cyrillic
  ['е', 'e'],
  ['о', 'o'],
  ['р', 'p'],
  ['с', 'c'],
  ['х', 'x'],
  ['і', 'i'],
  ['к', 'k'],
  ['м', 'm'],
  ['т', 't'],
];

// Punycode prefix
const PUNYCODE_PREFIX = 'xn--';

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    // Try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
    return match ? match[1].toLowerCase() : url.toLowerCase();
  }
}

// Check if domain is punycode (internationalized domain)
export function isPunycode(domain: string): boolean {
  return domain.startsWith(PUNYCODE_PREFIX) || /[^\x00-\x7F]/.test(domain);
}

// Check for homograph attack
export function isHomograph(domain: string): boolean {
  for (const [foreign, latin] of HOMOGRAPH_CHARS) {
    if (domain.includes(foreign) && !domain.includes(latin)) {
      return true;
    }
  }
  return false;
}

// Check for suspicious TLD
export function hasSuspiciousTLD(domain: string): boolean {
  return SUSPICIOUS_TLDS.some((tld) => domain.endsWith(tld));
}

// Check if domain is URL shortener
export function isShortener(domain: string): boolean {
  return URL_SHORTENERS.some((s) => domain.includes(s));
}

// Analyze a single domain
export function analyzeDomain(domain: string): DomainAnalysis {
  const flags: string[] = [];
  let threatLevel: DomainAnalysis['threatLevel'] = 'LOW';

  const punycode = isPunycode(domain);
  if (punycode) {
    flags.push('PUNYCODE');
  }

  const homograph = isHomograph(domain);
  if (homograph) {
    flags.push('HOMOGRAPH');
  }

  const suspiciousTLD = hasSuspiciousTLD(domain);
  if (suspiciousTLD) {
    flags.push('SUSPICIOUS_TLD');
  }

  const shortener = isShortener(domain);
  if (shortener) {
    flags.push('URL_SHORTENER');
  }

  // Calculate threat level
  if (punycode || homograph) {
    threatLevel = 'HIGH';
  } else if (suspiciousTLD && shortener) {
    threatLevel = 'HIGH';
  } else if (suspiciousTLD || shortener) {
    threatLevel = 'MEDIUM';
  }

  return {
    domain,
    isPunycode: punycode,
    isHomograph: homograph,
    hasSuspiciousTLD: suspiciousTLD,
    isShortener: shortener,
    threatLevel,
    flags,
  };
}

// Analyze multiple links
export function analyzeLinks(links: string[]): DomainAnalysis[] {
  return links.map((link) => {
    const domain = extractDomain(link);
    return analyzeDomain(domain);
  });
}

// Normalize URL for safe storage (remove tracking params)
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref', 'fbclid'];
    trackingParams.forEach((param) => urlObj.searchParams.delete(param));

    // Keep only essential parts
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

// Track domain spikes (for detecting coordinated attacks)
// Returns true if this domain has been seen multiple times recently
export async function checkDomainSpike(
  domain: string,
  groupId: string,
  redisClient: { get: (key: string) => Promise<string | null>; incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<void> }
): Promise<{ isSpike: boolean; count: number }> {
  const key = `domain_spike:${groupId}:${domain}`;
  const count = await redisClient.incr(key);

  if (count === 1) {
    // First occurrence, set expiry
    await redisClient.expire(key, 300); // 5 minute window
  }

  return {
    isSpike: count >= 3, // 3+ occurrences in 5 minutes = spike
    count,
  };
}

// Main domain intelligence processor
export async function processDomainIntel(
  job: DomainIntelJob,
  redisClient: { get: (key: string) => Promise<string | null>; incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<void> }
): Promise<{ analyses: DomainAnalysis[]; spikes: string[]; watchCandidates: string[] }> {
  const analyses = analyzeLinks(job.links);
  const spikes: string[] = [];
  const watchCandidates: string[] = [];

  for (const analysis of analyses) {
    // Check for spikes
    const { isSpike, count } = await checkDomainSpike(
      analysis.domain,
      job.groupId,
      redisClient
    );

    if (isSpike) {
      spikes.push(analysis.domain);
    }

    // Flag high threat domains as watch candidates
    if (analysis.threatLevel === 'HIGH' || analysis.threatLevel === 'CRITICAL') {
      watchCandidates.push(analysis.domain);
    }
  }

  return { analyses, spikes, watchCandidates };
}