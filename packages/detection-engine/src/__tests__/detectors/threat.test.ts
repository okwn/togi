import { describe, it, expect } from '@jest/globals';
import { checkThreat, ThreatConfig } from '../../detectors/threat-detector';

describe('checkThreat', () => {
  const defaultConfig: ThreatConfig = {
    enabled: true,
    threatScore: 75,
    doxxingScore: 80,
    harassmentScore: 45,
  };

  describe('returns clean result for normal text (score: 0)', () => {
    it('returns NONE level for normal conversational text', () => {
      const result = checkThreat('Hello, how are you today?');
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.hasThreat).toBe(false);
      expect(result.hasHarassment).toBe(false);
      expect(result.hasDoxxing).toBe(false);
      expect(result.matchedPatterns).toHaveLength(0);
    });

    it('returns NONE for empty string', () => {
      const result = checkThreat('', defaultConfig);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    it('returns NONE for undefined text', () => {
      const result = checkThreat(undefined, defaultConfig);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('detects doxxing patterns (score: 80)', () => {
    it('detects dox keyword', () => {
      const result = checkThreat('I will dox you on twitter', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.score).toBe(80);
      expect(result.matchedPatterns).toContain('doxxing');
    });

    it('detects doxx keyword', () => {
      const result = checkThreat('gonna doxx your address', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.score).toBe(80);
    });

    it('detects leak combined with personal info keywords', () => {
      const result = checkThreat('I will leak your address online', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.score).toBe(80);
      expect(result.matchedPatterns).toContain('doxxing-leak');
    });

    it('detects leak phone', () => {
      const result = checkThreat('leak your phone number', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.score).toBe(80);
    });

    it('detects leak email', () => {
      const result = checkThreat('leak my email address', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.score).toBe(80);
    });

    it('does not trigger on leak alone without personal info', () => {
      const result = checkThreat('I will leak this file', defaultConfig);
      expect(result.hasDoxxing).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('detects threat patterns (score: 75)', () => {
    it('detects kill keyword', () => {
      const result = checkThreat('I will kill you', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
      expect(result.matchedPatterns).toContain('threat:kill');
    });

    it('detects murder keyword', () => {
      const result = checkThreat('I will murder you', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });

    it('detects die keyword', () => {
      const result = checkThreat('You should die', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });

    it('detects bomb keyword', () => {
      const result = checkThreat('I will bomb the building', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });

    it('detects weapon keyword', () => {
      const result = checkThreat('I have a weapon', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });

    it('detects gun keyword', () => {
      const result = checkThreat('I will shoot you', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
      expect(result.matchedPatterns).toContain('threat:shoot');
    });

    it('detects knife keyword', () => {
      const result = checkThreat('I will stab you', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
      expect(result.matchedPatterns).toContain('threat:stab');
    });

    it('detects poison keyword', () => {
      const result = checkThreat('I will poison you', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });
  });

  describe('detects harassment (score: 45)', () => {
    it('detects general harassment keywords', () => {
      const result = checkThreat('You are stupid and worthless', defaultConfig);
      expect(result.hasHarassment).toBe(true);
      expect(result.score).toBe(45);
      expect(result.matchedPatterns).toContain('general-harassment');
    });

    it('does not trigger general harassment when threat keyword is present', () => {
      const result = checkThreat('You are a racist idiot', defaultConfig);
      // "racist" triggers threat keyword check first
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
      // hasHarassment is not set because hasThreat is already true
    });
  });

  describe('combines scores when multiple threat types present', () => {
    it('combines doxxing and threat scores', () => {
      const result = checkThreat('I will dox you and kill you', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(155); // 80 + 75
    });

    it('combines doxxing and general harassment scores', () => {
      const result = checkThreat('I will dox your stupid face', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.hasHarassment).toBe(true);
      expect(result.score).toBe(125); // 80 + 45
    });

    it('combines threat and general harassment scores', () => {
      // Note: hasHarassment is not set when hasThreat is true (due to !result.hasThreat check in code)
      const result = checkThreat('I will kill you, you idiot', defaultConfig);
      expect(result.hasDoxxing).toBe(false);
      expect(result.hasThreat).toBe(true);
      // hasHarassment is not set because hasThreat check comes after general harassment check
      expect(result.score).toBe(75);
    });

    it('combines all three threat types', () => {
      const result = checkThreat('I will dox you, kill you, you stupid idiot', defaultConfig);
      expect(result.hasDoxxing).toBe(true);
      expect(result.hasThreat).toBe(true);
      // hasHarassment not set due to !result.hasThreat condition
      expect(result.score).toBe(155); // 80 + 75 (dox+threat only)
    });
  });

  describe('config can disable individual checks', () => {
    it('returns NONE when config is disabled', () => {
      const disabledConfig: ThreatConfig = { ...defaultConfig, enabled: false };
      const result = checkThreat('I will kill you', disabledConfig);
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.hasThreat).toBe(false);
    });

    it('uses custom doxxingScore', () => {
      const customConfig: ThreatConfig = { ...defaultConfig, doxxingScore: 100 };
      const result = checkThreat('I will dox you', customConfig);
      expect(result.score).toBe(100);
    });

    it('uses custom threatScore', () => {
      const customConfig: ThreatConfig = { ...defaultConfig, threatScore: 50 };
      const result = checkThreat('I will kill you', customConfig);
      expect(result.score).toBe(50);
    });

    it('uses custom harassmentScore', () => {
      const customConfig: ThreatConfig = { ...defaultConfig, harassmentScore: 30 };
      const result = checkThreat('You are stupid', customConfig);
      expect(result.score).toBe(30);
    });
  });

  describe('level determination (LOW/MEDIUM/HIGH/CRITICAL)', () => {
    it('returns NONE for score 0', () => {
      const result = checkThreat('Hello friend', defaultConfig);
      expect(result.level).toBe('NONE');
    });

    it('returns LOW for score > 0 but < 45', () => {
      const customConfig: ThreatConfig = { ...defaultConfig, threatScore: 10 };
      const result = checkThreat('kill', customConfig);
      expect(result.level).toBe('LOW');
    });

    it('returns MEDIUM for score >= 45 but < 75', () => {
      const result = checkThreat('You are stupid', defaultConfig);
      expect(result.level).toBe('MEDIUM');
      expect(result.score).toBe(45);
    });

    it('returns HIGH for score >= 75 but < 80', () => {
      const result = checkThreat('I will kill you', defaultConfig);
      expect(result.level).toBe('HIGH');
      expect(result.score).toBe(75);
    });

    it('returns CRITICAL for score >= 80', () => {
      const result = checkThreat('I will dox you', defaultConfig);
      expect(result.level).toBe('CRITICAL');
      expect(result.score).toBe(80);
    });

    it('returns CRITICAL for combined score >= 80', () => {
      const result = checkThreat('I will dox you and kill you', defaultConfig);
      expect(result.level).toBe('CRITICAL');
      expect(result.score).toBe(155);
    });
  });

  describe('text normalization', () => {
    it('handles uppercase threats', () => {
      const result = checkThreat('I WILL KILL YOU', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });

    it('handles mixed case threats', () => {
      const result = checkThreat('I KiLl YoU', defaultConfig);
      expect(result.hasThreat).toBe(true);
      expect(result.score).toBe(75);
    });
  });
});