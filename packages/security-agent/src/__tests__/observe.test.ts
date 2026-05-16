import { describe, it, expect, vi } from '@jest/globals';
import { observe } from '../agent/core';

vi.mock('../tools/get-group-policy', () => ({
  getGroupPolicy: vi.fn().mockResolvedValue(null),
}));

vi.mock('../tools/get-recent-violations', () => ({
  getRecentViolations: vi.fn().mockResolvedValue({
    countLastHour: 5,
    countLast24h: 30,
    trend: 'stable' as const,
    topTypes: [{ type: 'SPAM', count: 20 }],
    topUsers: [],
  }),
}));

vi.mock('../tools/get-user-risk-profiles', () => ({
  getUserRiskProfiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('../tools/get-threat-indicators', () => ({
  getThreatIndicators: vi.fn().mockResolvedValue([]),
}));

vi.mock('../tools/get-bot-permissions', () => ({
  getBotPermissions: vi.fn().mockResolvedValue({
    canDelete: true,
    canRestrict: true,
    canInvite: true,
    canManageVideoChats: true,
  }),
}));

describe('Observe Step', () => {
  it('should collect observations for a group', async () => {
    const result = await observe('test-group-id', 'SCHEDULED');

    expect(result.groupId).toBe('test-group-id');
    expect(result.timestamp).toBeDefined();
    expect(result.violations.countLast24h).toBe(30);
    expect(result.botPermissions.canDelete).toBe(true);
  });
});