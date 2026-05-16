import { describe, it, expect } from '@jest/globals';
import { calculateUserRiskModifier, UserRiskContext } from '../detectors/user-risk-detector';

describe('calculateUserRiskModifier', () => {
  const baseContext: UserRiskContext = {
    telegramUserId: BigInt(123456789),
    groupId: 'group_001',
    globalRiskScore: 0,
    groupTrustScore: 0,
    totalViolations: 0,
    severeViolations: 0,
    isNewUser: false,
    hasUsername: true,
    firstMessageHasLink: false,
    isGroupAdmin: false,
    isProbation: false,
  };

  describe('new user penalties', () => {
    it('adds 10 for new user', () => {
      const context: UserRiskContext = { ...baseContext, isNewUser: true };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(10);
      expect(result.labels).toContain('new_user');
    });

    it('combines new user and first message link', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isNewUser: true,
        firstMessageHasLink: true,
      };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(15); // 10 + 5
      expect(result.riskFactors).toContain('new_user');
      expect(result.riskFactors).toContain('first_message_link');
    });
  });

  describe('username penalties', () => {
    it('adds 10 for user without username', () => {
      const context: UserRiskContext = { ...baseContext, hasUsername: false };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(10);
      expect(result.labels).toContain('no_username');
    });
  });

  describe('first message link penalty', () => {
    it('adds 5 for first message containing link', () => {
      const context: UserRiskContext = { ...baseContext, firstMessageHasLink: true };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(5);
      expect(result.labels).toContain('first_message_link');
    });
  });

  describe('probation penalty', () => {
    it('adds 5 for user on probation', () => {
      const context: UserRiskContext = { ...baseContext, isProbation: true };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(5);
      expect(result.labels).toContain('on_probation');
    });
  });

  describe('admin trust factor', () => {
    it('reduces risk by 10 for group admin', () => {
      const context: UserRiskContext = { ...baseContext, isGroupAdmin: true };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-10);
      expect(result.trustFactors).toContain('group_admin');
    });
  });

  describe('violation penalties', () => {
    it('adds 5 per violation (capped at 30)', () => {
      const context: UserRiskContext = { ...baseContext, totalViolations: 3 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(15); // 3 * 5 = 15
      expect(result.riskFactors).toContain('3_violations');
    });

    it('caps violation penalty at 30', () => {
      const context: UserRiskContext = { ...baseContext, totalViolations: 10 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(30); // capped
    });

    it('adds 15 per severe violation (5 * 3 multiplier)', () => {
      const context: UserRiskContext = { ...baseContext, severeViolations: 2 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(30); // 2 * 5 * 3 = 30
      expect(result.riskFactors).toContain('2_severe');
    });

    it('combines regular and severe violations', () => {
      const context: UserRiskContext = {
        ...baseContext,
        totalViolations: 2,
        severeViolations: 1,
      };
      const result = calculateUserRiskModifier(context);
      // 2 * 5 = 10 (regular) + 1 * 5 * 3 = 15 (severe) = 25
      expect(result.modifier).toBe(25);
    });
  });

  describe('global risk score penalties', () => {
    it('adds 15 for high global risk (>= 70)', () => {
      const context: UserRiskContext = { ...baseContext, globalRiskScore: 75 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(15);
      expect(result.riskFactors).toContain('high_global_risk');
    });

    it('adds 7 for elevated global risk (>= 50, < 70)', () => {
      const context: UserRiskContext = { ...baseContext, globalRiskScore: 55 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(7);
      expect(result.riskFactors).toContain('elevated_global_risk');
    });

    it('does not add global risk modifier below 50', () => {
      const context: UserRiskContext = { ...baseContext, globalRiskScore: 49 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(0);
    });
  });

  describe('trust score benefits', () => {
    it('reduces 15 for high trust score (>= 80) with no risk factors', () => {
      const context: UserRiskContext = { ...baseContext, groupTrustScore: 85 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-15);
      expect(result.trustFactors).toContain('high_trust_score');
    });

    it('reduces 10 for medium trust score (>= 50) with no risk factors', () => {
      const context: UserRiskContext = { ...baseContext, groupTrustScore: 60 };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-10);
      expect(result.trustFactors).toContain('medium_trust_score');
    });

    it('does not apply trust score reduction when risk factors exist', () => {
      const context: UserRiskContext = {
        ...baseContext,
        groupTrustScore: 85,
        isNewUser: true, // Has a risk factor
      };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(10); // Just the new user penalty, no trust reduction
      expect(result.trustFactors).not.toContain('high_trust_score');
    });
  });

  describe('clean record benefit', () => {
    it('reduces 5 for clean record (no violations and not new user)', () => {
      const context: UserRiskContext = { ...baseContext };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-5);
      expect(result.trustFactors).toContain('clean_record');
    });

    it('does not apply clean record for new users', () => {
      const context: UserRiskContext = { ...baseContext, isNewUser: true };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(10); // new user penalty only
      expect(result.trustFactors).not.toContain('clean_record');
    });
  });

  describe('modifier clamping', () => {
    it('clamps negative modifier to -30', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isGroupAdmin: true,
        groupTrustScore: 85, // -10 (admin) -15 (high trust) = -25 (clean_record doesn't stack)
      };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-25);
    });

    it('clamps positive modifier to +50', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isNewUser: true,
        hasUsername: false,
        firstMessageHasLink: true,
        isProbation: true,
        totalViolations: 10,
        severeViolations: 5,
        globalRiskScore: 80,
      };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(50);
    });
  });

  describe('combined scenarios', () => {
    it('new user with no username and link gets combined penalties', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isNewUser: true,
        hasUsername: false,
        firstMessageHasLink: true,
      };
      const result = calculateUserRiskModifier(context);
      // 10 (new user) + 10 (no username) + 5 (link) = 25
      expect(result.modifier).toBe(25);
    });

    it('trusted member with violations does not get trust reduction', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isGroupAdmin: true,
        totalViolations: 1,
      };
      const result = calculateUserRiskModifier(context);
      expect(result.modifier).toBe(-5); // 5 (violation) - 10 (admin) = -5
    });

    it('trusted member with clean record gets multiple trust benefits', () => {
      const context: UserRiskContext = {
        ...baseContext,
        isGroupAdmin: true,
        groupTrustScore: 85,
      };
      const result = calculateUserRiskModifier(context);
      // -10 (admin) -15 (high trust) = -25 (clean_record doesn't stack since trust factors exist)
      expect(result.modifier).toBe(-25);
    });
  });

  describe('return shape', () => {
    it('returns correct result shape', () => {
      const context: UserRiskContext = { ...baseContext, isNewUser: true };
      const result = calculateUserRiskModifier(context);

      expect(result).toHaveProperty('modifier');
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('riskFactors');
      expect(result).toHaveProperty('trustFactors');
      expect(typeof result.modifier).toBe('number');
      expect(Array.isArray(result.labels)).toBe(true);
      expect(Array.isArray(result.riskFactors)).toBe(true);
      expect(Array.isArray(result.trustFactors)).toBe(true);
    });

    it('labels contains risk factors as strings', () => {
      const context: UserRiskContext = { ...baseContext, isNewUser: true };
      const result = calculateUserRiskModifier(context);
      expect(result.labels).toContain('new_user');
    });
  });
});