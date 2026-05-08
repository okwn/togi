// Link detector - detects suspicious links
// Rules:
// - Allowlisted domain: risk reduction
// - Blocklisted domain: +90
// - URL shortener: +45
// - New user sends link during probation: +50
// - Telegram invite link: configurable risk
// - Discord invite link: configurable risk
// - Wallet/claim/airdrop patterns: +50 to +90

import { DetectionResult, DetectionLabel, Severity } from '../types.js';
import { isSuspiciousShortener } from '../static-lists/suspicious-shorteners.js';
import { hasSuspiciousTLD } from '../static-lists/suspicious-tlds.js';
import { containsScamPattern } from '../static-lists/scam-patterns.js';

export interface LinkConfig {
  enabled: boolean;
  shortenerScore: number;
  blockedDomainScore: number;
  suspiciousTLDScore: number;
  newUserLinkScore: number;
  telegramInviteScore: number;
  discordInviteScore: number;
  scamPatternScore: number;
}

const DEFAULT_CONFIG: LinkConfig = {
  enabled: true,
  shortenerScore: 45,
  blockedDomainScore: 90,
  suspiciousTLDScore: 30,
  newUserLinkScore: 50,
  telegramInviteScore: 20,
  discordInviteScore: 35,
  scamPatternScore: 70,
};

export interface LinkResult {
  score: number;
  level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  links: LinkAnalysis[];
  isNewUserLink: boolean;
  hasScamPattern: boolean;
}

export interface LinkAnalysis {
  url: string;
  domain: string;
  isShortener: boolean;
  isBlocked: boolean;
  isSuspiciousTLD: boolean;
  isTelegramInvite: boolean;
  isDiscordInvite: boolean;
  hasScamPattern: boolean;
  score: number;
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

export function analyzeLinks(
  links: string[],
  userId: string | undefined,
  isNewUser: boolean,
  allowedDomains: string[] = [],
  blockedDomains: string[] = [],
  config: LinkConfig = DEFAULT_CONFIG
): LinkResult {
  const result: LinkResult = {
    score: 0,
    level: 'NONE',
    links: [],
    isNewUserLink: false,
    hasScamPattern: false,
  };

  if (!config.enabled || links.length === 0) {
    return result;
  }

  for (const link of links) {
    const analysis = analyzeSingleLink(link, allowedDomains, blockedDomains, config);
    result.links.push(analysis);
    result.score += analysis.score;

    if (analysis.isShortener) {
      result.hasScamPattern = true;
    }

    if (analysis.hasScamPattern) {
      result.hasScamPattern = true;
    }
  }

  // New user with link during probation
  if (isNewUser && links.length > 0) {
    result.score += config.newUserLinkScore;
    result.isNewUserLink = true;
  }

  // Determine level
  if (result.score >= 90) {
    result.level = 'CRITICAL';
  } else if (result.score >= 70) {
    result.level = 'HIGH';
  } else if (result.score >= 45) {
    result.level = 'MEDIUM';
  } else if (result.score > 0) {
    result.level = 'LOW';
  }

  return result;
}

function analyzeSingleLink(
  url: string,
  allowedDomains: string[],
  blockedDomains: string[],
  config: LinkConfig
): LinkAnalysis {
  const domain = extractDomain(url);
  const analysis: LinkAnalysis = {
    url,
    domain: domain || '',
    isShortener: false,
    isBlocked: false,
    isSuspiciousTLD: false,
    isTelegramInvite: false,
    isDiscordInvite: false,
    hasScamPattern: false,
    score: 0,
  };

  if (!analysis.domain) {
    return analysis;
  }

  const domainLower = analysis.domain.toLowerCase();

  // Check allowlist first (reduces score)
  if (allowedDomains.some((d) => domainLower.includes(d.toLowerCase()))) {
    return analysis; // No score added
  }

  // Check blocklist
  if (blockedDomains.some((d) => domainLower.includes(d.toLowerCase()))) {
    analysis.isBlocked = true;
    analysis.score += config.blockedDomainScore;
    return analysis;
  }

  // Check for suspicious shortener
  if (isSuspiciousShortener(url)) {
    analysis.isShortener = true;
    analysis.score += config.shortenerScore;
  }

  // Check for suspicious TLD
  if (hasSuspiciousTLD(url)) {
    analysis.isSuspiciousTLD = true;
    analysis.score += config.suspiciousTLDScore;
  }

  // Check for Telegram invite links
  if (domainLower.includes('t.me') || domainLower.includes('telegram.me')) {
    analysis.isTelegramInvite = true;
    analysis.score += config.telegramInviteScore;
  }

  // Check for Discord invite links
  if (domainLower.includes('discord.gg') || domainLower.includes('discord.com')) {
    analysis.isDiscordInvite = true;
    analysis.score += config.discordInviteScore;
  }

  // Check for scam patterns in URL
  if (containsScamPattern(url)) {
    analysis.hasScamPattern = true;
    analysis.score += config.scamPatternScore;
  }

  return analysis;
}

export function linkToDetection(linkResult: LinkResult): Partial<DetectionResult> {
  if (linkResult.level === 'NONE') {
    return {
      riskScore: 0,
      labels: [],
      severity: 'LOW',
      recommendedAction: 'ALLOW',
      reasons: [],
      fastPath: true,
    };
  }

  const labels: DetectionLabel[] = ['LINK'];

  if (linkResult.links.some((l) => l.isShortener)) {
    labels.push('SHORTENER');
  }

  if (linkResult.links.some((l) => l.isBlocked)) {
    labels.push('BLOCKED_DOMAIN');
  }

  if (linkResult.isNewUserLink) {
    labels.push('NEW_USER_LINK');
  }

  if (linkResult.hasScamPattern) {
    labels.push('SCAM_PATTERN');
  }

  const reasons: string[] = [];

  if (linkResult.links.some((l) => l.isShortener)) {
    reasons.push('URL shortener detected');
  }

  if (linkResult.links.some((l) => l.isTelegramInvite)) {
    reasons.push('Telegram invite link');
  }

  if (linkResult.links.some((l) => l.isDiscordInvite)) {
    reasons.push('Discord invite link');
  }

  if (linkResult.isNewUserLink) {
    reasons.push('New user posting links');
  }

  if (linkResult.links.some((l) => l.isBlocked)) {
    reasons.push('Blocked domain');
  }

  return {
    riskScore: linkResult.score,
    labels,
    severity: linkResult.level === 'CRITICAL' ? 'CRITICAL' :
              linkResult.level === 'HIGH' ? 'HIGH' : 'MEDIUM',
    recommendedAction: linkResult.level === 'CRITICAL' ? 'DELETE_BAN' :
                      linkResult.level === 'HIGH' ? 'DELETE_MUTE' :
                      linkResult.level === 'MEDIUM' ? 'DELETE_WARN' : 'DELETE',
    reasons,
    fastPath: true,
  };
}
