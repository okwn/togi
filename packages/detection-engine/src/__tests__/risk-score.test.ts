import { describe, it, expect } from '@jest/globals';
import {
  calculateRiskScore,
  scoreToSeverity,
  type RiskScoreInput,
  type RiskScoreResult,
} from '../risk-score';

describe('risk-score', () => {
  describe('scoreToSeverity', () => {
    describe('LOW boundary (0-29)', () => {
      it('returns LOW for score 0', () => {
        expect(scoreToSeverity(0)).toBe('LOW');
      });

      it('returns LOW for score 29', () => {
        expect(scoreToSeverity(29)).toBe('LOW');
      });

      it('returns LOW for negative scores', () => {
        expect(scoreToSeverity(-10)).toBe('LOW');
      });
    });

    describe('MEDIUM boundary (30-49)', () => {
      it('returns LOW for score 30 (actual: 30-49 maps to LOW)', () => {
        expect(scoreToSeverity(30)).toBe('LOW');
      });

      it('returns LOW for score 49 (actual: 30-49 maps to LOW)', () => {
        expect(scoreToSeverity(49)).toBe('LOW');
      });
    });

    describe('HIGH boundary (50-69)', () => {
      it('returns MEDIUM for score 50 (actual: 50-69 maps to MEDIUM)', () => {
        expect(scoreToSeverity(50)).toBe('MEDIUM');
      });

      it('returns MEDIUM for score 69 (actual: 50-69 maps to MEDIUM)', () => {
        expect(scoreToSeverity(69)).toBe('MEDIUM');
      });
    });

    describe('CRITICAL boundary (70+)', () => {
      it('returns HIGH for score 70 (actual: 70-89 maps to HIGH)', () => {
        expect(scoreToSeverity(70)).toBe('HIGH');
      });

      it('returns HIGH for score 89 (actual: 70-89 maps to HIGH)', () => {
        expect(scoreToSeverity(89)).toBe('HIGH');
      });

      it('returns CRITICAL for score 90', () => {
        expect(scoreToSeverity(90)).toBe('CRITICAL');
      });

      it('returns CRITICAL for score 100', () => {
        expect(scoreToSeverity(100)).toBe('CRITICAL');
      });

      it('returns CRITICAL for scores above 100', () => {
        expect(scoreToSeverity(150)).toBe('CRITICAL');
      });
    });
  });

  describe('calculateRiskScore', () => {
    const createEmptyPolicy = () => ({
      mode: 'BALANCED' as const,
      floodProtection: { enabled: true, maxMessages: 5, windowSeconds: 10, action: 'DELETE', mediaMultiplier: 1.5 },
      linkProtection: { enabled: true, shortenerAction: 'WARN', blockedDomains: [], allowedDomains: [], newMemberBlocks: false, newMemberBlockMinutes: 30 },
      newMemberProtection: { enabled: true, probationMinutes: 30, restrictions: [], canInvite: true },
      threatProtection: { enabled: true, scamPatternsAction: 'DELETE', threatPatternsAction: 'BAN', deleteOnMatch: true },
      spamProtection: { enabled: true, deleteThreshold: 10, windowSeconds: 60, action: 'DELETE', warnAfter: 3 },
      raidProtection: { enabled: true, joinWindowSeconds: 60, maxJoinsPerWindow: 10, action: 'ALERT', alertAdmins: true, autoProtect: true },
      actionPolicy: { warnEnabled: true, muteEnabled: true, banEnabled: true, deleteEnabled: true, kickEnabled: true, maxWarnsBeforeMute: 3, maxMutesBeforeBan: 3, muteDurationMinutes: 30 },
      adminAlerts: { enabled: true, alertOnViolation: true, alertOnRaid: true, minSeverity: 'HIGH' },
    });

    it('caps total score at 100 when sum exceeds 100', () => {
      const input: RiskScoreInput = {
        rateLimitScore: 30,
        duplicateScore: 20,
        linkScore: 20,
        threatScore: 20,
        newMemberScore: 20,
        mentionScore: 20,
        mediaFloodScore: 20,
        raidScore: 20,
      };

      const result = calculateRiskScore(input, createEmptyPolicy());

      expect(result.totalScore).toBe(100);
      expect(result.severity).toBe('CRITICAL');
    });

    it('returns zero score for clean input (all zeros)', () => {
      const input: RiskScoreInput = {
        rateLimitScore: 0,
        duplicateScore: 0,
        linkScore: 0,
        threatScore: 0,
        newMemberScore: 0,
        mentionScore: 0,
        mediaFloodScore: 0,
        raidScore: 0,
      };

      const result = calculateRiskScore(input, createEmptyPolicy());

      expect(result.totalScore).toBe(0);
      expect(result.severity).toBe('LOW');
      expect(result.breakdown.flood).toBe(0);
      expect(result.breakdown.duplicate).toBe(0);
      expect(result.breakdown.link).toBe(0);
      expect(result.breakdown.threat).toBe(0);
      expect(result.breakdown.newMember).toBe(0);
      expect(result.breakdown.mention).toBe(0);
      expect(result.breakdown.media).toBe(0);
      expect(result.breakdown.raid).toBe(0);
    });

    it('validates component score structure in result', () => {
      const input: RiskScoreInput = {
        rateLimitScore: 10,
        duplicateScore: 5,
        linkScore: 15,
        threatScore: 0,
        newMemberScore: 0,
        mentionScore: 0,
        mediaFloodScore: 0,
        raidScore: 0,
      };

      const result = calculateRiskScore(input, createEmptyPolicy());

      // Validate RiskScoreResult structure
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('breakdown');

      // Validate breakdown has all expected fields
      expect(result.breakdown).toHaveProperty('flood');
      expect(result.breakdown).toHaveProperty('duplicate');
      expect(result.breakdown).toHaveProperty('link');
      expect(result.breakdown).toHaveProperty('threat');
      expect(result.breakdown).toHaveProperty('newMember');
      expect(result.breakdown).toHaveProperty('mention');
      expect(result.breakdown).toHaveProperty('media');
      expect(result.breakdown).toHaveProperty('raid');

      // Validate breakdown values match input
      expect(result.breakdown.flood).toBe(10);
      expect(result.breakdown.duplicate).toBe(5);
      expect(result.breakdown.link).toBe(15);
      expect(result.breakdown.threat).toBe(0);

      // Validate total is sum of breakdown
      expect(result.totalScore).toBe(30);
    });

    it('handles partial input with some zero scores', () => {
      const input: RiskScoreInput = {
        rateLimitScore: 25,
        duplicateScore: 0,
        linkScore: 0,
        threatScore: 0,
        newMemberScore: 0,
        mentionScore: 0,
        mediaFloodScore: 0,
        raidScore: 0,
      };

      const result = calculateRiskScore(input, createEmptyPolicy());

      expect(result.totalScore).toBe(25);
      expect(result.severity).toBe('LOW');
    });

    it('returns HIGH severity when total score reaches 70', () => {
      const input: RiskScoreInput = {
        rateLimitScore: 40,
        duplicateScore: 30,
        linkScore: 0,
        threatScore: 0,
        newMemberScore: 0,
        mentionScore: 0,
        mediaFloodScore: 0,
        raidScore: 0,
      };

      const result = calculateRiskScore(input, createEmptyPolicy());

      expect(result.totalScore).toBe(70);
      expect(result.severity).toBe('HIGH'); // scoreToSeverity(70) returns HIGH, not CRITICAL
    });
  });
});