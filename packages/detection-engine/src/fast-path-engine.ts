// Fast Path Detection Engine
// Orchestrates all detectors for sub-20ms threat detection
// Key design principles:
// - Zero external API calls
// - Redis for hot state
// - Deterministic rules only
// - No AI/ML calls

import {
  DetectionResult,
  DetectionContext,
  DetectionLabel,
  Severity,
} from './types.js';
import type { PolicyContext } from './types.js';

import { keys, redis } from '@togi/db';
import type { RedisClient } from '@togi/db';

import { checkRateLimit, rateLimitToDetection } from './detectors/rate-limit-detector.js';
import { checkDuplicate, duplicateToDetection } from './detectors/duplicate-detector.js';
import { analyzeLinks, linkToDetection } from './detectors/link-detector.js';
import { checkThreat, threatToDetection } from './detectors/threat-detector.js';
import { checkNewMember, newMemberToDetection } from './detectors/new-member-detector.js';
import { checkMentionSpam, mentionToDetection } from './detectors/mention-spam-detector.js';
import { checkMediaFlood, mediaFloodToDetection } from './detectors/media-flood-detector.js';
import { checkRaidJoin, raidToDetection } from './detectors/raid-detector.js';
import { calculateUserRiskModifier, type UserRiskContext } from './detectors/user-risk-detector.js';

import { calculateRiskScore, PolicyMode } from './risk-score.js';
import {
  mergeDetectionResults,
  shouldEnqueueForAnalysis,
  determineAction,
} from './decision-engine.js';

export interface FastPathConfig {
  enabled: boolean;
  runRateLimit: boolean;
  runDuplicate: boolean;
  runLink: boolean;
  runThreat: boolean;
  runNewMember: boolean;
  runMention: boolean;
  runMediaFlood: boolean;
  runRaid: boolean;
}

const DEFAULT_CONFIG: FastPathConfig = {
  enabled: true,
  runRateLimit: true,
  runDuplicate: true,
  runLink: true,
  runThreat: true,
  runNewMember: true,
  runMention: true,
  runMediaFlood: true,
  runRaid: true,
};

export interface FastPathResult {
  detection: DetectionResult;
  shouldEnqueue: boolean;
  processingTimeMs: number;
  detectors: string[];
}

export async function runFastPath(
  context: DetectionContext,
  policy: PolicyContext,
  config: FastPathConfig = DEFAULT_CONFIG,
  redisClient: RedisClient = redis
): Promise<FastPathResult> {
  const startTime = Date.now();
  const detectors: string[] = [];

  // Initialize result accumulator
  const detectionInputs: Partial<DetectionResult>[] = [];

  // 1. Rate Limit Detection
  if (config.runRateLimit && context.userId) {
    detectors.push('rateLimit');
    const rateLimitResult = await checkRateLimit(
      context.chatId,
      context.userId,
      {
        maxMessagesShort: policy.floodProtection.enabled ? Math.floor(policy.floodProtection.maxMessages / 5) : 4,
        windowShortSeconds: 5,
        maxMessagesMedium: policy.floodProtection.enabled ? Math.floor(policy.floodProtection.maxMessages / 3) : 7,
        windowMediumSeconds: 10,
        maxMessagesLong: policy.floodProtection.maxMessages,
        windowLongSeconds: policy.floodProtection.windowSeconds,
      },
      redisClient
    );
    detectionInputs.push(rateLimitToDetection(rateLimitResult));
  }

  // 2. Duplicate Detection
  if (config.runDuplicate && context.text) {
    detectors.push('duplicate');
    const duplicateResult = await checkDuplicate(
      context.chatId,
      context.userId || 'unknown',
      context.text,
      context.messageId,
      {
        windowSeconds: 120,
        maxRepeats: 3,
        hashScore: 35,
        repeatScore: 50,
      },
      redisClient
    );
    detectionInputs.push(duplicateToDetection(duplicateResult));
  }

  // 3. Link Detection
  if (config.runLink && context.links.length > 0) {
    detectors.push('link');
    const linkResult = analyzeLinks(
      context.links,
      context.userId,
      context.isNewUser,
      policy.linkProtection.allowedDomains,
      policy.linkProtection.blockedDomains,
      {
        enabled: policy.linkProtection.enabled,
        shortenerScore: 45,
        blockedDomainScore: 90,
        suspiciousTLDScore: 30,
        newUserLinkScore: policy.linkProtection.newMemberBlocks ? 50 : 0,
        telegramInviteScore: 20,
        discordInviteScore: 35,
        scamPatternScore: 70,
      }
    );
    detectionInputs.push(linkToDetection(linkResult));
  }

  // 4. Threat Detection
  if (config.runThreat && context.text) {
    detectors.push('threat');
    const threatResult = checkThreat(
      context.text,
      {
        enabled: policy.threatProtection.enabled,
        threatScore: 75,
        doxxingScore: 80,
        harassmentScore: 45,
      }
    );
    detectionInputs.push(threatToDetection(threatResult));
  }

  // 5. New Member Detection
  if (config.runNewMember && context.isNewUser) {
    detectors.push('newMember');
    const newMemberResult = checkNewMember(
      context.isNewUser,
      context.userMemberSince,
      policy.newMemberProtection.probationMinutes,
      context.mediaType !== undefined && context.mediaType !== 'unknown',
      context.links.length > 0,
      policy.newMemberProtection.restrictions
    );
    detectionInputs.push(newMemberToDetection(newMemberResult, !!context.mediaType, context.links.length > 0));
  }

  // 6. Mention Spam Detection
  if (config.runMention && context.mentions.length > 0) {
    detectors.push('mention');
    const mentionResult = checkMentionSpam(
      context.mentions,
      {
        enabled: true,
        softLimit: 5,
        softScore: 35,
        hardLimit: 10,
        hardScore: 60,
      }
    );
    detectionInputs.push(mentionToDetection(mentionResult));
  }

  // 7. Media Flood Detection
  if (config.runMediaFlood && context.mediaType) {
    detectors.push('mediaFlood');
    const mediaFloodResult = checkMediaFlood(
      context.mediaType,
      context.mediaType === 'sticker' ? 1 : 0,
      context.mediaType === 'animation' ? 1 : 0,
      context.isNewUser,
      context.isNewUser && context.userMemberSince !== undefined &&
        (Date.now() - context.userMemberSince) < policy.newMemberProtection.probationMinutes * 60 * 1000
    );
    detectionInputs.push(mediaFloodToDetection(mediaFloodResult, context.mediaType));
  }

  // 8. Raid Detection (only on join events, not messages)
  // Note: This would be called separately for join request events
  // Skipping here as it's not applicable to regular message processing

  // Merge all detection results
  const mergedDetection = mergeDetectionResults(detectionInputs);

  // Build UserRiskContext from DetectionContext
  const userRiskContext: UserRiskContext = {
    telegramUserId: context.userId ? BigInt(context.userId) : BigInt(0),
    groupId: context.chatId,
    globalRiskScore: 0, // Not available in fast-path context
    groupTrustScore: 0, // Not available in fast-path context
    totalViolations: 0, // Not available in fast-path context
    severeViolations: 0, // Not available in fast-path context
    isNewUser: context.isNewUser,
    hasUsername: context.username !== undefined,
    firstMessageHasLink: context.isNewUser && context.links.length > 0,
    isGroupAdmin: false, // Not available in fast-path context
    isProbation: context.isNewUser && context.userMemberSince !== undefined &&
      (Date.now() - context.userMemberSince) < policy.newMemberProtection.probationMinutes * 60 * 1000,
  };

  // Calculate user risk modifier
  const userRiskResult = calculateUserRiskModifier(userRiskContext);

  // Calculate final risk score
  const riskScoreResult = calculateRiskScore(
    {
      rateLimitScore: detectionInputs[0]?.riskScore || 0,
      duplicateScore: detectionInputs[1]?.riskScore || 0,
      linkScore: detectionInputs[2]?.riskScore || 0,
      threatScore: detectionInputs[3]?.riskScore || 0,
      newMemberScore: detectionInputs[4]?.riskScore || 0,
      mentionScore: detectionInputs[5]?.riskScore || 0,
      mediaFloodScore: detectionInputs[6]?.riskScore || 0,
      raidScore: 0,
    },
    policy
  );

  // Apply user risk modifier to final score
  const finalScore = Math.min(100, riskScoreResult.totalScore + userRiskResult.modifier);

  // Apply policy mode thresholds to final action
  const finalAction = determineAction(finalScore, policy.mode as PolicyMode);

  const finalDetection: DetectionResult = {
    ...mergedDetection,
    riskScore: finalScore,
    severity: riskScoreResult.severity,
    recommendedAction: finalAction,
    fastPath: true,
  };

  const processingTimeMs = Date.now() - startTime;

  return {
    detection: finalDetection,
    shouldEnqueue: shouldEnqueueForAnalysis(finalDetection),
    processingTimeMs,
    detectors,
  };
}

// Convenience function for simple synchronous detection (no Redis)
export function runSynchronousDetection(
  context: DetectionContext,
  policy: PolicyContext
): DetectionResult {
  const inputs: Partial<DetectionResult>[] = [];

  // Link detection (no Redis needed)
  if (context.links.length > 0) {
    const linkResult = analyzeLinks(
      context.links,
      context.userId,
      context.isNewUser,
      policy.linkProtection.allowedDomains,
      policy.linkProtection.blockedDomains
    );
    inputs.push(linkToDetection(linkResult));
  }

  // Threat detection (no Redis needed)
  if (context.text) {
    const threatResult = checkThreat(context.text, {
      enabled: policy.threatProtection.enabled,
      threatScore: 75,
      doxxingScore: 80,
      harassmentScore: 45,
    });
    inputs.push(threatToDetection(threatResult));
  }

  // Mention detection (no Redis needed)
  if (context.mentions.length > 0) {
    const mentionResult = checkMentionSpam(context.mentions);
    inputs.push(mentionToDetection(mentionResult));
  }

  const merged = mergeDetectionResults(inputs);
  const mode = policy.mode as PolicyMode;
  const action = determineAction(merged.riskScore, mode);

  return {
    ...merged,
    recommendedAction: action,
    fastPath: true,
  };
}
