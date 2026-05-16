import { describe, it, expect } from '@jest/globals';
import { jest } from '@jest/globals';
import {
  ThreatIndicator,
  ThreatIntelConfig,
  ThreatIntelContext,
  ThreatIntelResult,
  analyzeThreatIndicators,
  hashString,
  analyzeThreatIndicatorsWithMocks,
} from '../detectors/threat-intel-detector.js';

describe('ThreatIntelDetector', () => {
  describe('hashString', () => {
    it('should produce consistent hashes for same input', () => {
      expect(hashString('malware.com')).toBe(hashString('malware.com'));
    });

    it('should produce different hashes for different inputs', () => {
      expect(hashString('malware.com')).not.toBe(hashString('safe.com'));
    });

    it('should handle empty string', () => {
      expect(hashString('')).toBe('0');
    });
  });

  describe('analyzeThreatIndicators', () => {
    const defaultConfig: ThreatIntelConfig = {
      consumeGlobalWatchlist: true,
      minGroupsForGlobalWatch: 2,
      minRiskForGlobalBlock: 80,
    };

    it('should return default result when consumeGlobalWatchlist is false', () => {
      const context: ThreatIntelContext = { links: ['http://malware.com'] };
      const config: ThreatIntelConfig = { ...defaultConfig, consumeGlobalWatchlist: false };

      const result = analyzeThreatIndicators(context, config);

      expect(result.indicatorFound).toBe(false);
      expect(result.modifier).toBe(0);
    });

    it('should return default result when no links provided', () => {
      const context: ThreatIntelContext = { links: [] };
      const result = analyzeThreatIndicators(context, defaultConfig);

      expect(result.indicatorFound).toBe(false);
      expect(result.modifier).toBe(0);
    });

    it('should return default result when getIndicator is not provided', () => {
      const context: ThreatIntelContext = { links: ['http://malware.com'] };
      const result = analyzeThreatIndicators(context, defaultConfig);

      expect(result.indicatorFound).toBe(false);
      expect(result.modifier).toBe(0);
    });

    it('should detect BLOCK status indicator and apply full risk score', () => {
      const indicator: ThreatIndicator = {
        type: 'DOMAIN',
        valueHash: hashString('malware.com'),
        riskScore: 85,
        labels: ['malware', 'phishing'],
        status: 'BLOCK',
        seenCount: 100,
        affectedGroupCount: 50,
      };

      const getIndicator = jest.fn((type: string, hash: string) => {
        if (type === 'DOMAIN' && hash === indicator.valueHash) return indicator;
        return null;
      });

      const context: ThreatIntelContext = { links: ['http://malware.com'] };
      const result = analyzeThreatIndicators(context, defaultConfig, getIndicator);

      expect(result.indicatorFound).toBe(true);
      expect(result.matchedIndicator).toEqual(indicator);
      expect(result.labels).toContain('THREAT_INDICATOR');
      expect(result.modifier).toBe(85);
      expect(result.reasons[0]).toContain('BLOCK indicator');
    });

    it('should detect WATCH status indicator and apply 60% risk score', () => {
      const indicator: ThreatIndicator = {
        type: 'DOMAIN',
        valueHash: hashString('suspicious.com'),
        riskScore: 50,
        labels: ['suspicious'],
        status: 'WATCH',
        seenCount: 10,
        affectedGroupCount: 3,
      };

      const getIndicator = jest.fn((type: string, hash: string) => {
        if (type === 'DOMAIN' && hash === indicator.valueHash) return indicator;
        return null;
      });

      const context: ThreatIntelContext = { links: ['http://suspicious.com'] };
      const result = analyzeThreatIndicators(context, defaultConfig, getIndicator);

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBe(30); // 50 * 0.6 = 30
    });

    it('should ignore EXPIRED status indicators', () => {
      const indicator: ThreatIndicator = {
        type: 'DOMAIN',
        valueHash: hashString('expired.com'),
        riskScore: 90,
        labels: ['malware'],
        status: 'EXPIRED',
        seenCount: 5,
        affectedGroupCount: 2,
      };

      const getIndicator = jest.fn((type: string, hash: string) => {
        if (type === 'DOMAIN' && hash === indicator.valueHash) return indicator;
        return null;
      });

      const context: ThreatIntelContext = { links: ['http://expired.com'] };
      const result = analyzeThreatIndicators(context, defaultConfig, getIndicator);

      expect(result.indicatorFound).toBe(false);
      expect(result.modifier).toBe(0);
    });

    it('should use highest modifier when multiple indicators match', () => {
      const indicators: ThreatIndicator[] = [
        {
          type: 'DOMAIN',
          valueHash: hashString('domain-a.com'),
          riskScore: 40,
          labels: ['low-risk'],
          status: 'WATCH',
          seenCount: 5,
          affectedGroupCount: 2,
        },
        {
          type: 'DOMAIN',
          valueHash: hashString('domain-b.com'),
          riskScore: 80,
          labels: ['high-risk'],
          status: 'BLOCK',
          seenCount: 50,
          affectedGroupCount: 20,
        },
      ];

      const getIndicator = jest.fn((type: string, hash: string) => {
        return indicators.find(ind => ind.valueHash === hash) || null;
      });

      const context: ThreatIntelContext = {
        links: ['http://domain-a.com', 'http://domain-b.com'],
      };
      const result = analyzeThreatIndicators(context, defaultConfig, getIndicator);

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBe(80); // BLOCK status takes precedence with full risk score
    });

    it('should handle multiple links and find first matching indicator', () => {
      const indicator: ThreatIndicator = {
        type: 'DOMAIN',
        valueHash: hashString('found.com'),
        riskScore: 70,
        labels: ['phishing'],
        status: 'BLOCK',
        seenCount: 25,
        affectedGroupCount: 10,
      };

      const getIndicator = jest.fn((type: string, hash: string) => {
        if (type === 'DOMAIN' && hash === indicator.valueHash) return indicator;
        return null;
      });

      const context: ThreatIntelContext = {
        links: ['http://skip.com', 'http://found.com', 'http://also-skip.com'],
      };
      const result = analyzeThreatIndicators(context, defaultConfig, getIndicator);

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBe(70);
    });
  });

  describe('analyzeThreatIndicatorsWithMocks', () => {
    it('should return result for given mock indicators', () => {
      const indicators: ThreatIndicator[] = [
        {
          type: 'DOMAIN',
          valueHash: hashString('mock-malware.com'),
          riskScore: 95,
          labels: ['malware'],
          status: 'BLOCK',
          seenCount: 200,
          affectedGroupCount: 100,
        },
      ];

      const config: ThreatIntelConfig = {
        consumeGlobalWatchlist: true,
        minGroupsForGlobalWatch: 2,
        minRiskForGlobalBlock: 80,
      };

      const context: ThreatIntelContext = {
        links: ['http://mock-malware.com'],
      };

      const result = analyzeThreatIndicatorsWithMocks(context, config, indicators);

      expect(result.indicatorFound).toBe(true);
      expect(result.modifier).toBe(95);
    });

    it('should return negative result when no indicators match', () => {
      const indicators: ThreatIndicator[] = [
        {
          type: 'DOMAIN',
          valueHash: hashString('safe.com'),
          riskScore: 10,
          labels: [],
          status: 'WATCH',
          seenCount: 1,
          affectedGroupCount: 1,
        },
      ];

      const config: ThreatIntelConfig = {
        consumeGlobalWatchlist: true,
        minGroupsForGlobalWatch: 2,
        minRiskForGlobalBlock: 80,
      };

      const context: ThreatIntelContext = {
        links: ['http://dangerous.com'],
      };

      const result = analyzeThreatIndicatorsWithMocks(context, config, indicators);

      expect(result.indicatorFound).toBe(false);
    });
  });
});