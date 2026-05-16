export interface ThreatIndicator {
  type: 'DOMAIN' | 'URL_HASH' | 'TEXT_HASH' | 'USER_PATTERN' | 'INVITE_LINK' | 'FILE_HASH';
  valueHash: string;
  normalizedValue?: string;
  riskScore: number;
  labels: string[];
  status: 'WATCH' | 'BLOCK' | 'ALLOW' | 'EXPIRED';
  seenCount: number;
  affectedGroupCount: number;
}

export interface ThreatIntelConfig {
  consumeGlobalWatchlist: boolean;
  minGroupsForGlobalWatch: number;
  minRiskForGlobalBlock: number;
}

export interface ThreatIntelContext {
  links: string[];
  textHash?: string;
  inviteLink?: string;
  telegramUserId?: bigint;
}

export interface ThreatIntelResult {
  indicatorFound: boolean;
  matchedIndicator?: ThreatIndicator;
  modifier: number;
  labels: string[];
  reasons: string[];
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function analyzeThreatIndicators(
  context: ThreatIntelContext,
  config: ThreatIntelConfig,
  getIndicator?: (type: string, hash: string) => ThreatIndicator | null
): ThreatIntelResult {
  const result: ThreatIntelResult = {
    indicatorFound: false,
    modifier: 0,
    labels: [],
    reasons: [],
  };

  if (!config.consumeGlobalWatchlist) return result;

  for (const link of context.links) {
    const domain = extractDomain(link);
    if (!domain) continue;

    if (getIndicator) {
      const indicator = getIndicator('DOMAIN', hashString(domain));
      if (indicator && indicator.status !== 'EXPIRED') {
        result.indicatorFound = true;
        result.matchedIndicator = indicator;
        result.labels.push('THREAT_INDICATOR');
        result.reasons.push(`Domain matches ${indicator.status} indicator`);
        result.modifier = indicator.status === 'BLOCK'
          ? Math.max(result.modifier, indicator.riskScore)
          : Math.max(result.modifier, Math.floor(indicator.riskScore * 0.6));
      }
    }
  }
  return result;
}

export function analyzeThreatIndicatorsWithMocks(
  context: ThreatIntelContext,
  config: ThreatIntelConfig,
  indicators: ThreatIndicator[]
): ThreatIntelResult {
  const indicatorMap = new Map<string, ThreatIndicator>();
  for (const indicator of indicators) {
    indicatorMap.set(`${indicator.type}:${indicator.valueHash}`, indicator);
  }

  return analyzeThreatIndicators(
    context,
    config,
    (type, hash) => indicatorMap.get(`${type}:${hash}`) ?? null
  );
}