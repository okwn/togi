import {
  PolicyConfig,
  PolicyMode,
  SecurityScore,
  BotPermissions,
} from './types.js';
import { getDefaultPolicy, policyDefaults } from './policy-defaults.js';

export { getDefaultPolicy, policyDefaults };

export function validatePolicyConfig(config: unknown): config is PolicyConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const obj = config as PolicyConfig;

  const sections = [
    'spamProtection',
    'floodProtection',
    'linkProtection',
    'newMemberProtection',
    'threatProtection',
    'raidProtection',
    'actionPolicy',
    'adminAlerts',
  ];

  for (const section of sections) {
    if (!obj[section as keyof PolicyConfig] || typeof obj[section as keyof PolicyConfig] !== 'object') {
      return false;
    }
  }

  const sp = obj.spamProtection;
  if (
    typeof sp.enabled !== 'boolean' ||
    typeof sp.deleteThreshold !== 'number' ||
    typeof sp.windowSeconds !== 'number' ||
    !['DELETE', 'WARN', 'MUTE', 'BAN', 'IGNORE'].includes(sp.action)
  ) {
    return false;
  }

  const fp = obj.floodProtection;
  if (
    typeof fp.enabled !== 'boolean' ||
    typeof fp.maxMessages !== 'number' ||
    typeof fp.windowSeconds !== 'number' ||
    !['DELETE', 'WARN', 'MUTE', 'BAN', 'IGNORE'].includes(fp.action)
  ) {
    return false;
  }

  const lp = obj.linkProtection;
  if (
    typeof lp.enabled !== 'boolean' ||
    !['DELETE', 'WARN', 'REVIEW', 'IGNORE'].includes(lp.shortenerAction) ||
    !Array.isArray(lp.blockedDomains) ||
    !Array.isArray(lp.allowedDomains) ||
    typeof lp.newMemberBlocks !== 'boolean'
  ) {
    return false;
  }

  const nmp = obj.newMemberProtection;
  if (
    typeof nmp.enabled !== 'boolean' ||
    typeof nmp.probationMinutes !== 'number' ||
    typeof nmp.blockLinksDuringProbation !== 'boolean' ||
    typeof nmp.blockMediaDuringProbation !== 'boolean' ||
    typeof nmp.blockMentionsDuringProbation !== 'boolean' ||
    typeof nmp.firstMessageStrictMode !== 'boolean' ||
    typeof nmp.verificationRequired !== 'boolean'
  ) {
    return false;
  }

  const tp = obj.threatProtection;
  if (
    typeof tp.enabled !== 'boolean' ||
    !['DELETE', 'WARN', 'MUTE', 'BAN', 'IGNORE'].includes(tp.scamPatternsAction) ||
    !['DELETE', 'WARN', 'MUTE', 'BAN', 'IGNORE'].includes(tp.threatPatternsAction)
  ) {
    return false;
  }

  const rp = obj.raidProtection;
  if (
    typeof rp.enabled !== 'boolean' ||
    typeof rp.joinSpikeThreshold !== 'number' ||
    typeof rp.windowSeconds !== 'number' ||
    typeof rp.autoLockdown !== 'boolean' ||
    typeof rp.lockdownMinutes !== 'number' ||
    typeof rp.restrictNewMembers !== 'boolean' ||
    typeof rp.alertAdmins !== 'boolean' ||
    typeof rp.paranoidDuringRaid !== 'boolean'
  ) {
    return false;
  }

  const ap = obj.actionPolicy;
  if (
    typeof ap.warnEnabled !== 'boolean' ||
    typeof ap.muteEnabled !== 'boolean' ||
    typeof ap.banEnabled !== 'boolean' ||
    typeof ap.maxWarnsBeforeMute !== 'number' ||
    typeof ap.maxMutesBeforeBan !== 'number'
  ) {
    return false;
  }

  const aa = obj.adminAlerts;
  if (
    typeof aa.enabled !== 'boolean' ||
    typeof aa.alertOnViolation !== 'boolean' ||
    !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(aa.minSeverity)
  ) {
    return false;
  }

  return true;
}

type PolicySection = 'spamProtection' | 'floodProtection' | 'linkProtection' | 'newMemberProtection' | 'threatProtection' | 'raidProtection' | 'actionPolicy' | 'adminAlerts';

export function mergePolicy(base: PolicyConfig, custom: Partial<PolicyConfig>): PolicyConfig {
  const merged: PolicyConfig = {
    spamProtection: { ...base.spamProtection, ...custom.spamProtection },
    floodProtection: { ...base.floodProtection, ...custom.floodProtection },
    linkProtection: { ...base.linkProtection, ...custom.linkProtection },
    newMemberProtection: { ...base.newMemberProtection, ...custom.newMemberProtection },
    threatProtection: { ...base.threatProtection, ...custom.threatProtection },
    raidProtection: { ...base.raidProtection, ...custom.raidProtection },
    actionPolicy: { ...base.actionPolicy, ...custom.actionPolicy },
    adminAlerts: { ...base.adminAlerts, ...custom.adminAlerts },
  };

  return merged;
}

export async function getEffectivePolicy(
  _groupId: string,
  _db: unknown
): Promise<{ mode: PolicyMode; config: PolicyConfig }> {
  return {
    mode: 'BALANCED',
    config: getDefaultPolicy('BALANCED'),
  };
}

export function calculateSecurityScore(
  permissions: BotPermissions,
  policy: PolicyConfig,
  hasBlocklist: boolean,
  hasAllowlist: boolean,
  auditLoggingEnabled: boolean
): SecurityScore {
  let total = 0;
  let botAdminStatus = 0;
  let permissionsScore = 0;
  let protections = 0;
  let lists = 0;
  let audit = 0;

  if (permissions.status === 'ADMIN') {
    botAdminStatus = 20;
  } else if (permissions.status === 'NOT_ADMIN') {
    botAdminStatus = 0;
  } else {
    botAdminStatus = 5;
  }
  total += botAdminStatus;

  if (permissions.canDeleteMessages) permissionsScore += 8;
  if (permissions.canRestrictMembers) permissionsScore += 8;
  if (permissions.canInviteUsers) permissionsScore += 4;
  if (permissions.canManageVideoChats) permissionsScore += 2;
  if (permissions.canChangeInfo) permissionsScore += 3;
  total += Math.min(permissionsScore, 25);

  const protectionChecks = [
    policy.spamProtection.enabled,
    policy.floodProtection.enabled,
    policy.linkProtection.enabled,
    policy.newMemberProtection.enabled,
    policy.threatProtection.enabled,
    policy.raidProtection.enabled,
  ];
  const enabledProtections = protectionChecks.filter(Boolean).length;
  protections = Math.round((enabledProtections / protectionChecks.length) * 30);
  total += protections;

  if (hasBlocklist) lists += 5;
  if (hasAllowlist) lists += 5;
  total += lists;

  if (auditLoggingEnabled) audit = 15;
  total += audit;

  return {
    total: Math.min(total, 100),
    botAdminStatus,
    permissions: permissionsScore,
    protections,
    lists,
    audit,
    breakdown: {
      hasDeletePermission: permissions.canDeleteMessages,
      hasRestrictPermission: permissions.canRestrictMembers,
      hasJoinRequestPermission: permissions.canInviteUsers,
      floodProtectionEnabled: policy.floodProtection.enabled,
      linkProtectionEnabled: policy.linkProtection.enabled,
      newMemberProtectionEnabled: policy.newMemberProtection.enabled,
      raidProtectionEnabled: policy.raidProtection.enabled,
      hasBlocklist,
      hasAllowlist,
      auditLoggingEnabled,
    },
  };
}

export function isValidMode(mode: string): mode is PolicyMode {
  return ['RELAXED', 'BALANCED', 'STRICT', 'PARANOID', 'CUSTOM'].includes(mode);
}
