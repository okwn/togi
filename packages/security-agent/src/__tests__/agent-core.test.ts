import { describe, it, expect, vi } from '@jest/globals';
import { runAgentCycle } from '../agent/core';

vi.mock('../db/agent-runs', () => ({
  createAgentRun: vi.fn().mockResolvedValue({ id: 'run-123' }),
  updateAgentRun: vi.fn().mockResolvedValue({}),
}));

vi.mock('../safety/audit-logger', () => ({
  logAgentAction: vi.fn().mockResolvedValue(undefined),
  logAgentRunStarted: vi.fn().mockResolvedValue(undefined),
  logAgentRunCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../agent/core', async () => {
  const actual = await vi.importActual('../agent/core');
  return {
    ...actual,
    observe: vi.fn().mockResolvedValue({
      groupId: 'test',
      timestamp: Date.now(),
      violations: { countLastHour: 0, countLast24h: 0, trend: 'stable', topTypes: [], topUsers: [] },
      security: { currentScore: 80, scoreDelta: 0, botPermissionsOk: true, policyMode: 'BALANCED', protectionEnabled: true },
      topRiskyUsers: [],
      threatIndicators: [],
      joinRate: 0,
      botPermissions: { canDelete: true, canRestrict: true, canInvite: true, canManageVideoChats: true },
    }),
  };
});

describe('Agent Core', () => {
  it('should run agent cycle and return results', async () => {
    const result = await runAgentCycle('group-123', 'SCHEDULED', 'RECOMMEND_ONLY');

    expect(result.runId).toBeDefined();
    expect(Array.isArray(result.executed)).toBe(true);
    expect(Array.isArray(result.recommended)).toBe(true);
  });
});