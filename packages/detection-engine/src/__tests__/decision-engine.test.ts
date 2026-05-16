import { describe, it, expect } from '@jest/globals';
import {
  determineAction,
  getThresholdsForMode,
  mergeDetectionResults,
  shouldEnqueueForAnalysis,
} from '../decision-engine';
import { THRESHOLD_MODIFIERS, PolicyMode } from '../risk-score';
import type { DetectionResult, RecommendedAction, Severity } from '../types';

function createMockResult(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    riskScore: 0,
    labels: [],
    severity: 'LOW' as Severity,
    recommendedAction: 'ALLOW' as RecommendedAction,
    reasons: [],
    fastPath: true,
    ...overrides,
  };
}

describe('getThresholdsForMode', () => {
  it('returns RELAXED thresholds', () => {
    const thresholds = getThresholdsForMode('RELAXED');
    expect(thresholds.allowMax).toBe(THRESHOLD_MODIFIERS.RELAXED.allowMax);
    expect(thresholds.warnMax).toBe(THRESHOLD_MODIFIERS.RELAXED.warnMax);
    expect(thresholds.deleteMax).toBe(THRESHOLD_MODIFIERS.RELAXED.deleteMax);
    expect(thresholds.muteMax).toBe(THRESHOLD_MODIFIERS.RELAXED.muteMax);
    expect(thresholds.banMax).toBe(THRESHOLD_MODIFIERS.RELAXED.banMax);
  });

  it('returns BALANCED thresholds', () => {
    const thresholds = getThresholdsForMode('BALANCED');
    expect(thresholds.allowMax).toBe(THRESHOLD_MODIFIERS.BALANCED.allowMax);
  });

  it('returns STRICT thresholds', () => {
    const thresholds = getThresholdsForMode('STRICT');
    expect(thresholds.allowMax).toBe(THRESHOLD_MODIFIERS.STRICT.allowMax);
  });

  it('returns PARANOID thresholds (most aggressive)', () => {
    const thresholds = getThresholdsForMode('PARANOID');
    expect(thresholds.allowMax).toBe(THRESHOLD_MODIFIERS.PARANOID.allowMax);
    // PARANOID should have the lowest allowMax (most aggressive)
    expect(thresholds.allowMax).toBeLessThan(getThresholdsForMode('RELAXED').allowMax);
    expect(thresholds.allowMax).toBeLessThan(getThresholdsForMode('BALANCED').allowMax);
    expect(thresholds.allowMax).toBeLessThan(getThresholdsForMode('STRICT').allowMax);
  });

  it('returns different thresholds for each mode', () => {
    const modes: PolicyMode[] = ['RELAXED', 'BALANCED', 'STRICT', 'PARANOID'];
    const allowMaxValues = modes.map((mode) => getThresholdsForMode(mode).allowMax);
    // All values should be unique
    const uniqueValues = new Set(allowMaxValues);
    expect(uniqueValues.size).toBe(modes.length);
  });
});

describe('determineAction', () => {
  describe('returns ALLOW for score 0 in all modes', () => {
    const modes: PolicyMode[] = ['RELAXED', 'BALANCED', 'STRICT', 'PARANOID'];
    modes.forEach((mode) => {
      it(`score 0 in ${mode} mode`, () => {
        expect(determineAction(0, mode)).toBe('ALLOW');
      });
    });
  });

  describe('scales action with score', () => {
    it('escalates actions as score increases in BALANCED mode', () => {
      expect(determineAction(0, 'BALANCED')).toBe('ALLOW');
      expect(determineAction(30, 'BALANCED')).toBe('WARN');
      expect(determineAction(50, 'BALANCED')).toBe('DELETE');
      expect(determineAction(70, 'BALANCED')).toBe('DELETE_WARN');
      expect(determineAction(90, 'BALANCED')).toBe('DELETE_MUTE');
    });

    it('escalates actions as score increases in PARANOID mode', () => {
      // PARANOID is more aggressive - lower thresholds
      expect(determineAction(0, 'PARANOID')).toBe('ALLOW');
      expect(determineAction(10, 'PARANOID')).toBe('WARN');
      expect(determineAction(30, 'PARANOID')).toBe('DELETE');
      expect(determineAction(50, 'PARANOID')).toBe('DELETE_WARN');
      expect(determineAction(70, 'PARANOID')).toBe('DELETE_MUTE');
    });

    it('escalates actions as score increases in RELAXED mode', () => {
      // RELAXED is less aggressive - higher thresholds
      expect(determineAction(0, 'RELAXED')).toBe('ALLOW');
      expect(determineAction(40, 'RELAXED')).toBe('WARN');
      expect(determineAction(60, 'RELAXED')).toBe('DELETE');
      expect(determineAction(80, 'RELAXED')).toBe('DELETE_WARN');
      expect(determineAction(95, 'RELAXED')).toBe('DELETE_MUTE');
    });
  });

  describe('PARANOID is more aggressive than RELAXED for same score', () => {
    const actionOrder: RecommendedAction[] = [
      'ALLOW', 'LOG', 'WARN', 'DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'
    ];

    const scores = [15, 25, 35, 45, 55, 65, 75];
    scores.forEach((score) => {
      it(`score ${score}`, () => {
        const paranoidAction = determineAction(score, 'PARANOID');
        const relaxedAction = determineAction(score, 'RELAXED');
        const paranoidIndex = actionOrder.indexOf(paranoidAction);
        const relaxedIndex = actionOrder.indexOf(relaxedAction);
        // PARANOID should return a more severe action (higher index)
        expect(paranoidIndex).toBeGreaterThanOrEqual(relaxedIndex);
      });
    });
  });

  describe('all 4 modes produce correct actions', () => {
    const testCases: { mode: PolicyMode; score: number; expected: RecommendedAction }[] = [
      // RELAXED mode
      { mode: 'RELAXED', score: 0, expected: 'ALLOW' },
      { mode: 'RELAXED', score: 39, expected: 'ALLOW' },
      { mode: 'RELAXED', score: 40, expected: 'WARN' },
      { mode: 'RELAXED', score: 59, expected: 'WARN' },
      { mode: 'RELAXED', score: 60, expected: 'DELETE' },
      { mode: 'RELAXED', score: 79, expected: 'DELETE' },
      { mode: 'RELAXED', score: 80, expected: 'DELETE_WARN' },
      { mode: 'RELAXED', score: 89, expected: 'DELETE_WARN' },
      { mode: 'RELAXED', score: 90, expected: 'DELETE_MUTE' },

      // BALANCED mode
      { mode: 'BALANCED', score: 0, expected: 'ALLOW' },
      { mode: 'BALANCED', score: 29, expected: 'ALLOW' },
      { mode: 'BALANCED', score: 30, expected: 'WARN' },
      { mode: 'BALANCED', score: 49, expected: 'WARN' },
      { mode: 'BALANCED', score: 50, expected: 'DELETE' },
      { mode: 'BALANCED', score: 69, expected: 'DELETE' },
      { mode: 'BALANCED', score: 70, expected: 'DELETE_WARN' },
      { mode: 'BALANCED', score: 89, expected: 'DELETE_WARN' },
      { mode: 'BALANCED', score: 90, expected: 'DELETE_MUTE' },

      // STRICT mode
      { mode: 'STRICT', score: 0, expected: 'ALLOW' },
      { mode: 'STRICT', score: 19, expected: 'ALLOW' },
      { mode: 'STRICT', score: 20, expected: 'WARN' },
      { mode: 'STRICT', score: 39, expected: 'WARN' },
      { mode: 'STRICT', score: 40, expected: 'DELETE' },
      { mode: 'STRICT', score: 59, expected: 'DELETE' },
      { mode: 'STRICT', score: 60, expected: 'DELETE_WARN' },
      { mode: 'STRICT', score: 79, expected: 'DELETE_WARN' },
      { mode: 'STRICT', score: 80, expected: 'DELETE_MUTE' },

      // PARANOID mode
      { mode: 'PARANOID', score: 0, expected: 'ALLOW' },
      { mode: 'PARANOID', score: 9, expected: 'ALLOW' },
      { mode: 'PARANOID', score: 10, expected: 'WARN' },
      { mode: 'PARANOID', score: 29, expected: 'WARN' },
      { mode: 'PARANOID', score: 30, expected: 'DELETE' },
      { mode: 'PARANOID', score: 49, expected: 'DELETE' },
      { mode: 'PARANOID', score: 50, expected: 'DELETE_WARN' },
      { mode: 'PARANOID', score: 69, expected: 'DELETE_WARN' },
      { mode: 'PARANOID', score: 70, expected: 'DELETE_MUTE' },
    ];

    testCases.forEach(({ mode, score, expected }) => {
      it(`${mode} mode at score ${score} returns ${expected}`, () => {
        expect(determineAction(score, mode)).toBe(expected);
      });
    });
  });
});

describe('mergeDetectionResults', () => {
  describe('deduplicates labels across multiple results', () => {
    it('merges multiple results with overlapping labels', () => {
      const result = mergeDetectionResults([
        createMockResult({ labels: ['SPAM', 'FLOOD'] }),
        createMockResult({ labels: ['SPAM', 'LINK'] }),
        createMockResult({ labels: ['FLOOD', 'THREAT'] }),
      ]);

      expect(result.labels).toContain('SPAM');
      expect(result.labels).toContain('FLOOD');
      expect(result.labels).toContain('LINK');
      expect(result.labels).toContain('THREAT');
      // SPAM and FLOOD should appear only once (deduplicated)
      const spamCount = result.labels.filter((l) => l === 'SPAM').length;
      const floodCount = result.labels.filter((l) => l === 'FLOOD').length;
      expect(spamCount).toBe(1);
      expect(floodCount).toBe(1);
    });

    it('handles single result with labels', () => {
      const result = mergeDetectionResults([
        createMockResult({ labels: ['SPAM', 'FLOOD'] }),
      ]);

      expect(result.labels).toHaveLength(2);
      expect(result.labels).toContain('SPAM');
      expect(result.labels).toContain('FLOOD');
    });

    it('handles empty array', () => {
      const result = mergeDetectionResults([]);
      expect(result.labels).toHaveLength(0);
    });

    it('filters out null/undefined inputs', () => {
      const result = mergeDetectionResults([
        createMockResult({ labels: ['SPAM'] }),
        null as unknown as Partial<DetectionResult>,
        undefined as unknown as Partial<DetectionResult>,
        createMockResult({ labels: ['FLOOD'] }),
      ]);

      expect(result.labels).toHaveLength(2);
      expect(result.labels).toContain('SPAM');
      expect(result.labels).toContain('FLOOD');
    });
  });

  describe('caps risk score at 100', () => {
    it('caps total score at 100', () => {
      const result = mergeDetectionResults([
        createMockResult({ riskScore: 60 }),
        createMockResult({ riskScore: 50 }),
      ]);

      expect(result.riskScore).toBe(100); // 60 + 50 = 110, capped at 100
    });

    it('does not cap if total is under 100', () => {
      const result = mergeDetectionResults([
        createMockResult({ riskScore: 30 }),
        createMockResult({ riskScore: 40 }),
      ]);

      expect(result.riskScore).toBe(70);
    });

    it('handles single result', () => {
      const result = mergeDetectionResults([
        createMockResult({ riskScore: 100 }),
      ]);

      expect(result.riskScore).toBe(100);
    });
  });

  describe('takes most severe action', () => {
    const actionOrder: RecommendedAction[] = [
      'ALLOW', 'LOG', 'WARN', 'DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'
    ];

    it('prefers DELETE_BAN over DELETE_MUTE', () => {
      const result = mergeDetectionResults([
        createMockResult({ recommendedAction: 'DELETE_MUTE' }),
        createMockResult({ recommendedAction: 'DELETE_BAN' }),
      ]);

      expect(result.recommendedAction).toBe('DELETE_BAN');
    });

    it('prefers DELETE over WARN', () => {
      const result = mergeDetectionResults([
        createMockResult({ recommendedAction: 'WARN' }),
        createMockResult({ recommendedAction: 'DELETE' }),
      ]);

      expect(result.recommendedAction).toBe('DELETE');
    });

    it('prefers DELETE over ALLOW', () => {
      const result = mergeDetectionResults([
        createMockResult({ recommendedAction: 'ALLOW' }),
        createMockResult({ recommendedAction: 'DELETE' }),
      ]);

      expect(result.recommendedAction).toBe('DELETE');
    });

    it('uses action precedence: ALLOW < LOG < WARN < DELETE < DELETE_WARN < DELETE_MUTE < DELETE_BAN < REVIEW', () => {
      const testCases: [RecommendedAction, RecommendedAction, RecommendedAction][] = [
        ['ALLOW', 'LOG', 'LOG'],
        ['LOG', 'WARN', 'WARN'],
        ['WARN', 'DELETE', 'DELETE'],
        ['DELETE', 'DELETE_WARN', 'DELETE_WARN'],
        ['DELETE_WARN', 'DELETE_MUTE', 'DELETE_MUTE'],
        ['DELETE_MUTE', 'DELETE_BAN', 'DELETE_BAN'],
        ['DELETE_BAN', 'REVIEW', 'REVIEW'],
      ];

      testCases.forEach(([action1, action2, expected]) => {
        const result = mergeDetectionResults([
          createMockResult({ recommendedAction: action1 }),
          createMockResult({ recommendedAction: action2 }),
        ]);
        const expectedIndex = actionOrder.indexOf(expected);
        const actualIndex = actionOrder.indexOf(result.recommendedAction);
        expect(actualIndex).toBe(expectedIndex);
      });
    });

    it('defaults to determineAction when no explicit action is set', () => {
      const result = mergeDetectionResults([
        createMockResult({ riskScore: 80 }),
        // No recommendedAction set (defaults to ALLOW)
      ]);

      // Since no explicit action is set (ALLOW doesn't count as explicit),
      // it should calculate action from score using determineAction
      // score 80 in BALANCED mode → DELETE_WARN (80 > 69 deleteMax)
      expect(result.recommendedAction).toBe('DELETE_WARN');
    });

    it('uses explicit action when at least one is set', () => {
      const result = mergeDetectionResults([
        createMockResult({ recommendedAction: 'ALLOW' }),
        createMockResult({ recommendedAction: 'WARN', riskScore: 80 }),
      ]);

      expect(result.recommendedAction).toBe('WARN');
    });
  });

  describe('combines reasons deduplicating', () => {
    it('merges and deduplicates reasons', () => {
      const result = mergeDetectionResults([
        createMockResult({ reasons: ['reason1', 'reason2'] }),
        createMockResult({ reasons: ['reason2', 'reason3'] }),
      ]);

      expect(result.reasons).toContain('reason1');
      expect(result.reasons).toContain('reason2');
      expect(result.reasons).toContain('reason3');
      expect(result.reasons.filter((r) => r === 'reason2')).toHaveLength(1);
    });
  });

  describe('takes highest severity', () => {
    it('returns CRITICAL when present', () => {
      const result = mergeDetectionResults([
        createMockResult({ severity: 'LOW' }),
        createMockResult({ severity: 'CRITICAL' }),
      ]);

      expect(result.severity).toBe('CRITICAL');
    });

    it('returns HIGH over MEDIUM', () => {
      const result = mergeDetectionResults([
        createMockResult({ severity: 'MEDIUM' }),
        createMockResult({ severity: 'HIGH' }),
      ]);

      expect(result.severity).toBe('HIGH');
    });

    it('returns MEDIUM over LOW', () => {
      const result = mergeDetectionResults([
        createMockResult({ severity: 'LOW' }),
        createMockResult({ severity: 'MEDIUM' }),
      ]);

      expect(result.severity).toBe('MEDIUM');
    });

    it('returns LOW when all are LOW', () => {
      const result = mergeDetectionResults([
        createMockResult({ severity: 'LOW' }),
        createMockResult({ severity: 'LOW' }),
      ]);

      expect(result.severity).toBe('LOW');
    });
  });
});

describe('shouldEnqueueForAnalysis', () => {
  describe('returns false for LOW severity with ALLOW/WARN/LOG', () => {
    it('returns false for LOW severity with ALLOW action', () => {
      const result = createMockResult({
        riskScore: 20,
        severity: 'LOW',
        recommendedAction: 'ALLOW',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });

    it('returns false for LOW severity with WARN action', () => {
      const result = createMockResult({
        riskScore: 25,
        severity: 'LOW',
        recommendedAction: 'WARN',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });

    it('returns false for LOW severity with LOG action', () => {
      const result = createMockResult({
        riskScore: 25,
        severity: 'LOW',
        recommendedAction: 'LOG',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });

    it('returns false for LOW severity with DELETE action (only HIGH/CRITICAL triggers auto-enqueue)', () => {
      const result = createMockResult({
        riskScore: 60,
        severity: 'LOW',
        recommendedAction: 'DELETE',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });
  });

  describe('returns true for HIGH/CRITICAL severity', () => {
    it('returns true for HIGH severity', () => {
      const result = createMockResult({
        riskScore: 70,
        severity: 'HIGH',
        recommendedAction: 'ALLOW',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });

    it('returns true for CRITICAL severity', () => {
      const result = createMockResult({
        riskScore: 90,
        severity: 'CRITICAL',
        recommendedAction: 'ALLOW',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });
  });

  describe('returns true if labels include SCAM_PATTERN or PHISHING_PATTERN', () => {
    it('returns true for SCAM_PATTERN label (riskScore >= 30 to bypass early return)', () => {
      const result = createMockResult({
        riskScore: 30, // >= 30 to pass the first check
        severity: 'LOW',
        recommendedAction: 'ALLOW',
        labels: ['SCAM_PATTERN'],
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });

    it('returns true for PHISHING_PATTERN label (riskScore >= 30 to bypass early return)', () => {
      const result = createMockResult({
        riskScore: 30, // >= 30 to pass the first check
        severity: 'LOW',
        recommendedAction: 'ALLOW',
        labels: ['PHISHING_PATTERN'],
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });

    it('returns true when label is combined with LOW severity and ALLOW (riskScore >= 30)', () => {
      const result = createMockResult({
        riskScore: 30, // >= 30 to pass the first check
        severity: 'LOW',
        recommendedAction: 'ALLOW',
        labels: ['SCAM_PATTERN', 'FLOOD'],
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });

    it('returns false for other labels (SPAM, FLOOD) when riskScore < 30 and action is ALLOW', () => {
      const result = createMockResult({
        riskScore: 25,
        severity: 'LOW',
        recommendedAction: 'ALLOW',
        labels: ['SPAM', 'FLOOD'],
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for MEDIUM severity with DELETE action (MEDIUM is not HIGH/CRITICAL)', () => {
      const result = createMockResult({
        riskScore: 55,
        severity: 'MEDIUM',
        recommendedAction: 'DELETE',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });

    it('handles empty labels array', () => {
      const result = createMockResult({
        riskScore: 25,
        severity: 'LOW',
        recommendedAction: 'ALLOW',
        labels: [],
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(false);
    });

    it('returns true for score >= 30 with DELETE_BAN action', () => {
      const result = createMockResult({
        riskScore: 95,
        severity: 'CRITICAL',
        recommendedAction: 'DELETE_BAN',
      });

      expect(shouldEnqueueForAnalysis(result)).toBe(true);
    });
  });
});