import { describe, it, expect, vi } from '@jest/globals';
import { reflect } from '../agent/core';

vi.mock('../tools/get-recent-violations', () => ({
  getRecentViolations: vi.fn().mockResolvedValue({
    countLastHour: 2,
    countLast24h: 20,
    trend: 'decreasing' as const,
    topTypes: [],
    topUsers: [],
  }),
}));

describe('Reflect Step', () => {
  it('should return reflection data', async () => {
    const executed = [];
    const recommended = [];

    const result = await reflect(executed, recommended, 'test-group-id');

    expect(result.violationsAfter).toBe(2);
    expect(result.shouldRollback).toBe(false);
  });
});