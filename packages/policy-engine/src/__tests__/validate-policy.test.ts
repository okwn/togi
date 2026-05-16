import { describe, it, expect } from '@jest/globals';
import { validatePolicyConfig } from '../engine';
import { getDefaultPolicy } from '../policy-defaults';

describe('validatePolicyConfig', () => {
  it('returns true for a valid config from getDefaultPolicy(BALANCED)', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('returns true for a valid config from getDefaultPolicy(STRICT)', () => {
    const config = getDefaultPolicy('STRICT');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('returns true for a valid config from getDefaultPolicy(RELAXED)', () => {
    const config = getDefaultPolicy('RELAXED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('returns false for invalid field types (floodProtection.enabled: "yes")', () => {
    const config = getDefaultPolicy('BALANCED');
    const invalidConfig = {
      ...config,
      floodProtection: {
        ...config.floodProtection,
        enabled: 'yes' as unknown as boolean,
      },
    };
    expect(validatePolicyConfig(invalidConfig)).toBe(false);
  });

  it('returns false for non-number threshold', () => {
    const config = getDefaultPolicy('BALANCED');
    const invalidConfig = {
      ...config,
      spamProtection: {
        ...config.spamProtection,
        deleteThreshold: 'yes' as unknown as number,
      },
    };
    expect(validatePolicyConfig(invalidConfig)).toBe(false);
  });

  it('returns false for missing required fields', () => {
    const invalidConfig = {
      spamProtection: {
        enabled: true,
        deleteThreshold: 15,
        windowSeconds: 10,
        action: 'DELETE',
        warnAfter: 3,
      },
      // Missing floodProtection
    } as unknown;
    expect(validatePolicyConfig(invalidConfig)).toBe(false);
  });

  it('returns false for invalid action type', () => {
    const config = getDefaultPolicy('BALANCED');
    const invalidConfig = {
      ...config,
      spamProtection: {
        ...config.spamProtection,
        action: 'INVALID_ACTION' as 'DELETE',
      },
    };
    expect(validatePolicyConfig(invalidConfig)).toBe(false);
  });

  it('returns false when config is null', () => {
    expect(validatePolicyConfig(null)).toBe(false);
  });

  it('returns false when config is undefined', () => {
    expect(validatePolicyConfig(undefined)).toBe(false);
  });

  it('returns false when config is a primitive', () => {
    expect(validatePolicyConfig('string' as unknown)).toBe(false);
    expect(validatePolicyConfig(123 as unknown)).toBe(false);
  });

  it('validates all 8 sections: spamProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: floodProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: linkProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: newMemberProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: threatProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: raidProtection', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: actionPolicy', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });

  it('validates all 8 sections: adminAlerts', () => {
    const config = getDefaultPolicy('BALANCED');
    expect(validatePolicyConfig(config)).toBe(true);
  });
});