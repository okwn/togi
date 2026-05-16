import { describe, it, expect } from '@jest/globals';
import { mergePolicy } from '../engine';
import { getDefaultPolicy } from '../policy-defaults';

describe('mergePolicy', () => {
  const basePolicy = getDefaultPolicy('BALANCED');

  it('deep merges nested objects (floodProtection.maxMessages)', () => {
    const custom = {
      floodProtection: {
        maxMessages: 50,
      },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.floodProtection.maxMessages).toBe(50);
    expect(result.floodProtection.windowSeconds).toBe(basePolicy.floodProtection.windowSeconds);
    expect(result.floodProtection.action).toBe(basePolicy.floodProtection.action);
    expect(result.floodProtection.enabled).toBe(basePolicy.floodProtection.enabled);
  });

  it('custom values override base values', () => {
    const custom = {
      spamProtection: {
        enabled: false,
        deleteThreshold: 100,
        windowSeconds: 300,
        action: 'BAN',
        warnAfter: 10,
      },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.spamProtection.enabled).toBe(false);
    expect(result.spamProtection.deleteThreshold).toBe(100);
    expect(result.spamProtection.windowSeconds).toBe(300);
    expect(result.spamProtection.action).toBe('BAN');
    expect(result.spamProtection.warnAfter).toBe(10);
  });

  it('missing custom values keep base values', () => {
    const custom = {
      linkProtection: {
        enabled: false,
      },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.linkProtection.enabled).toBe(false);
    expect(result.linkProtection.shortenerAction).toBe(basePolicy.linkProtection.shortenerAction);
    expect(result.linkProtection.blockedDomains).toEqual(basePolicy.linkProtection.blockedDomains);
    expect(result.linkProtection.allowedDomains).toEqual(basePolicy.linkProtection.allowedDomains);
    expect(result.linkProtection.newMemberBlocks).toBe(basePolicy.linkProtection.newMemberBlocks);
    expect(result.linkProtection.newMemberBlockMinutes).toBe(basePolicy.linkProtection.newMemberBlockMinutes);
  });

  it('works across all policy sections', () => {
    const custom = {
      spamProtection: { enabled: false },
      floodProtection: { enabled: true },
      linkProtection: { enabled: false },
      newMemberProtection: { enabled: true },
      threatProtection: { enabled: true },
      raidProtection: { enabled: false },
      actionPolicy: { warnEnabled: false },
      adminAlerts: { enabled: true },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.spamProtection.enabled).toBe(false);
    expect(result.floodProtection.enabled).toBe(true);
    expect(result.linkProtection.enabled).toBe(false);
    expect(result.newMemberProtection.enabled).toBe(true);
    expect(result.threatProtection.enabled).toBe(true);
    expect(result.raidProtection.enabled).toBe(false);
    expect(result.actionPolicy.warnEnabled).toBe(false);
    expect(result.adminAlerts.enabled).toBe(true);
  });

  it('preserves base values when custom is empty', () => {
    const result = mergePolicy(basePolicy, {});
    expect(result).toEqual(basePolicy);
  });

  it('merges newMemberProtection fields correctly', () => {
    const custom = {
      newMemberProtection: {
        probationMinutes: 60,
        blockLinksDuringProbation: true,
      },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.newMemberProtection.probationMinutes).toBe(60);
    expect(result.newMemberProtection.blockLinksDuringProbation).toBe(true);
    expect(result.newMemberProtection.blockMediaDuringProbation).toBe(basePolicy.newMemberProtection.blockMediaDuringProbation);
    expect(result.newMemberProtection.blockMentionsDuringProbation).toBe(basePolicy.newMemberProtection.blockMentionsDuringProbation);
    expect(result.newMemberProtection.firstMessageStrictMode).toBe(basePolicy.newMemberProtection.firstMessageStrictMode);
    expect(result.newMemberProtection.verificationRequired).toBe(basePolicy.newMemberProtection.verificationRequired);
  });

  it('merges raidProtection fields correctly', () => {
    const custom = {
      raidProtection: {
        joinSpikeThreshold: 50,
        autoLockdown: true,
      },
    } as Parameters<typeof mergePolicy>[1];
    const result = mergePolicy(basePolicy, custom);

    expect(result.raidProtection.joinSpikeThreshold).toBe(50);
    expect(result.raidProtection.autoLockdown).toBe(true);
    expect(result.raidProtection.windowSeconds).toBe(basePolicy.raidProtection.windowSeconds);
    expect(result.raidProtection.lockdownMinutes).toBe(basePolicy.raidProtection.lockdownMinutes);
    expect(result.raidProtection.restrictNewMembers).toBe(basePolicy.raidProtection.restrictNewMembers);
  });
});