import { describe, it, expect } from '@jest/globals';
import { calculateSecurityScore } from '../engine';
import { getDefaultPolicy } from '../policy-defaults';
import type { BotPermissions, PolicyConfig } from '../types';

describe('calculateSecurityScore', () => {
  const createAdminPermissions = (): BotPermissions => ({
    canDeleteMessages: true,
    canRestrictMembers: true,
    canChangeInfo: true,
    canInviteUsers: true,
    canPinMessages: true,
    canPromoteMembers: true,
    canManageVideoChats: true,
    isAdmin: true,
    status: 'ADMIN',
  });

  const createNotAdminPermissions = (): BotPermissions => ({
    canDeleteMessages: true,
    canRestrictMembers: false,
    canChangeInfo: false,
    canInviteUsers: true,
    canPinMessages: false,
    canPromoteMembers: false,
    canManageVideoChats: false,
    isAdmin: false,
    status: 'NOT_ADMIN',
  });

  it('returns 100 when fully configured with ADMIN permissions', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('STRICT');
    const score = calculateSecurityScore(permissions, policy, true, true, true);

    expect(score.total).toBe(100);
    expect(score.botAdminStatus).toBe(20);
    expect(score.breakdown.hasDeletePermission).toBe(true);
    expect(score.breakdown.hasRestrictPermission).toBe(true);
  });

  it('returns low score when bot is NOT_ADMIN', () => {
    const permissions = createNotAdminPermissions();
    const policy = getDefaultPolicy('STRICT');
    const score = calculateSecurityScore(permissions, policy, false, false, false);

    expect(score.total).toBeLessThan(50);
    expect(score.botAdminStatus).toBe(0);
  });

  it('scores differ based on mode (STRICT vs RELAXED)', () => {
    const adminPermissions = createAdminPermissions();

    const strictPolicy = getDefaultPolicy('STRICT');
    const relaxedPolicy = getDefaultPolicy('RELAXED');

    const strictScore = calculateSecurityScore(adminPermissions, strictPolicy, false, false, false);
    const relaxedScore = calculateSecurityScore(adminPermissions, relaxedPolicy, false, false, false);

    // STRICT mode should have more protections enabled
    expect(strictScore.protections).toBeGreaterThanOrEqual(relaxedScore.protections);
  });

  it('has blocklist affects score', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('BALANCED');

    const withoutBlocklist = calculateSecurityScore(permissions, policy, false, false, false);
    const withBlocklist = calculateSecurityScore(permissions, policy, true, false, false);

    expect(withBlocklist.lists).toBe(5);
    expect(withoutBlocklist.lists).toBe(0);
    expect(withBlocklist.total).toBeGreaterThan(withoutBlocklist.total);
  });

  it('has allowlist affects score', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('BALANCED');

    const withoutAllowlist = calculateSecurityScore(permissions, policy, false, false, false);
    const withAllowlist = calculateSecurityScore(permissions, policy, false, true, false);

    expect(withAllowlist.lists).toBe(5);
    expect(withoutAllowlist.lists).toBe(0);
    expect(withAllowlist.total).toBeGreaterThan(withoutAllowlist.total);
  });

  it('audit logging enabled affects score', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('BALANCED');

    const withoutAudit = calculateSecurityScore(permissions, policy, false, false, false);
    const withAudit = calculateSecurityScore(permissions, policy, false, false, true);

    expect(withAudit.audit).toBe(15);
    expect(withoutAudit.audit).toBe(0);
    expect(withAudit.total).toBeGreaterThan(withoutAudit.total);
  });

  it('caps total at 100', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('STRICT');
    const score = calculateSecurityScore(permissions, policy, true, true, true);

    expect(score.total).toBeLessThanOrEqual(100);
  });

  it('returns UNKNOWN status gives partial admin score', () => {
    const unknownPermissions: BotPermissions = {
      canDeleteMessages: true,
      canRestrictMembers: true,
      canChangeInfo: true,
      canInviteUsers: true,
      canPinMessages: true,
      canPromoteMembers: true,
      canManageVideoChats: true,
      isAdmin: false,
      status: 'UNKNOWN',
    };
    const policy = getDefaultPolicy('BALANCED');
    const score = calculateSecurityScore(unknownPermissions, policy, false, false, false);

    expect(score.botAdminStatus).toBe(5);
  });

  it('includes correct breakdown fields', () => {
    const permissions = createAdminPermissions();
    const policy = getDefaultPolicy('BALANCED');
    const score = calculateSecurityScore(permissions, policy, true, true, true);

    expect(score.breakdown.hasDeletePermission).toBe(true);
    expect(score.breakdown.hasRestrictPermission).toBe(true);
    expect(score.breakdown.floodProtectionEnabled).toBe(true);
    expect(score.breakdown.linkProtectionEnabled).toBe(true);
    expect(score.breakdown.newMemberProtectionEnabled).toBe(true);
    expect(score.breakdown.raidProtectionEnabled).toBe(true);
    expect(score.breakdown.hasBlocklist).toBe(true);
    expect(score.breakdown.hasAllowlist).toBe(true);
    expect(score.breakdown.auditLoggingEnabled).toBe(true);
  });

  it('calculates permissions score capped at 25', () => {
    const permissions: BotPermissions = {
      canDeleteMessages: true,
      canRestrictMembers: true,
      canChangeInfo: true,
      canInviteUsers: true,
      canPinMessages: true,
      canPromoteMembers: true,
      canManageVideoChats: true,
      isAdmin: true,
      status: 'ADMIN',
    };
    const policy = getDefaultPolicy('BALANCED');
    const score = calculateSecurityScore(permissions, policy, false, false, false);

    // 8 + 8 + 4 + 2 + 3 = 25, capped at 25
    expect(score.permissions).toBe(25);
  });

  it('calculates protections score based on enabled protections ratio', () => {
    const adminPermissions = createAdminPermissions();
    const policy = getDefaultPolicy('BALANCED');
    const score = calculateSecurityScore(adminPermissions, policy, false, false, false);

    // BALANCED has all protections enabled (spam, flood, link, newMember, threat, raid = 6/6)
    // 6/6 * 30 = 30
    expect(score.protections).toBe(30);
  });
});