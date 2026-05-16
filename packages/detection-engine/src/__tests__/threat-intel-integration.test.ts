import { describe, it, expect } from '@jest/globals';
import { calculateUserRiskModifier } from '../detectors/user-risk-detector.js';
import { analyzeThreatIndicatorsWithMocks, hashString, ThreatIndicator } from '../detectors/threat-intel-detector.js';

describe('threat-intel integration', () => {
  it('full flow: new user with suspicious link gets elevated risk', () => {
    const userRisk = calculateUserRiskModifier({
      telegramUserId: 123456n,
      groupId: 'group-1',
      globalRiskScore: 0,
      groupTrustScore: 50,
      totalViolations: 0,
      severeViolations: 0,
      isNewUser: true,
      hasUsername: false,
      firstMessageHasLink: true,
      isGroupAdmin: false,
      isProbation: true,
    });
    expect(userRisk.modifier).toBeGreaterThanOrEqual(25);
  });

  it('trusted user with clean record gets reduced risk', () => {
    const userRisk = calculateUserRiskModifier({
      telegramUserId: 999999n,
      groupId: 'trusted-group',
      globalRiskScore: 10,
      groupTrustScore: 90,
      totalViolations: 0,
      severeViolations: 0,
      isNewUser: false,
      hasUsername: true,
      firstMessageHasLink: false,
      isGroupAdmin: false,
      isProbation: false,
    });
    expect(userRisk.modifier).toBeLessThan(0);
  });

  it('blocked domain gets high modifier', () => {
    const blockedDomain = 'blocked-ponzi.com';
    const indicator: ThreatIndicator = {
      type: 'DOMAIN',
      valueHash: hashString(blockedDomain),
      riskScore: 90,
      labels: ['phishing', 'scam'],
      status: 'BLOCK',
      seenCount: 10,
      affectedGroupCount: 5,
    };

    const threatIntel = analyzeThreatIndicatorsWithMocks(
      { links: ['https://blocked-ponzi.com/invest'] },
      { consumeGlobalWatchlist: true, minGroupsForGlobalWatch: 3, minRiskForGlobalBlock: 70 },
      [indicator]
    );
    expect(threatIntel.modifier).toBe(90);
  });
});