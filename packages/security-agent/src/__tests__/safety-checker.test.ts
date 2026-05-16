import { describe, it, expect } from '@jest/globals';
import { canAutoExecute, isHighImpact, requiresApproval } from '../safety/safety-levels';

describe('Safety Levels', () => {
  describe('canAutoExecute', () => {
    it('OBSERVE_ONLY never auto-executes', () => {
      expect(canAutoExecute('OBSERVE_ONLY', 'LOW')).toBe(false);
      expect(canAutoExecute('OBSERVE_ONLY', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('OBSERVE_ONLY', 'HIGH')).toBe(false);
    });

    it('RECOMMEND_ONLY never auto-executes', () => {
      expect(canAutoExecute('RECOMMEND_ONLY', 'LOW')).toBe(false);
      expect(canAutoExecute('RECOMMEND_ONLY', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('RECOMMEND_ONLY', 'HIGH')).toBe(false);
    });

    it('AUTO_LOW_RISK only executes LOW risk', () => {
      expect(canAutoExecute('AUTO_LOW_RISK', 'LOW')).toBe(true);
      expect(canAutoExecute('AUTO_LOW_RISK', 'MEDIUM')).toBe(false);
      expect(canAutoExecute('AUTO_LOW_RISK', 'HIGH')).toBe(false);
    });

    it('AUTO_HIGH_RISK_WITH_POLICY executes LOW and MEDIUM', () => {
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'LOW')).toBe(true);
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'MEDIUM')).toBe(true);
      expect(canAutoExecute('AUTO_HIGH_RISK_WITH_POLICY', 'HIGH')).toBe(false);
    });
  });

  describe('isHighImpact', () => {
    it('HIGH is high impact', () => {
      expect(isHighImpact('HIGH')).toBe(true);
    });

    it('LOW and MEDIUM are not high impact', () => {
      expect(isHighImpact('LOW')).toBe(false);
      expect(isHighImpact('MEDIUM')).toBe(false);
    });
  });

  describe('requiresApproval', () => {
    it('HIGH always requires approval regardless of safety level', () => {
      expect(requiresApproval('AUTO_HIGH_RISK_WITH_POLICY', 'HIGH')).toBe(true);
      expect(requiresApproval('AUTO_LOW_RISK', 'HIGH')).toBe(true);
      expect(requiresApproval('RECOMMEND_ONLY', 'HIGH')).toBe(true);
    });

    it('LOW does not require approval in AUTO_LOW_RISK', () => {
      expect(requiresApproval('AUTO_LOW_RISK', 'LOW')).toBe(false);
    });

    it('MEDIUM requires approval in AUTO_LOW_RISK', () => {
      expect(requiresApproval('AUTO_LOW_RISK', 'MEDIUM')).toBe(true);
    });
  });
});