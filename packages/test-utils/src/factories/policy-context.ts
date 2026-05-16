import type { PolicyContext } from '@togi/detection-engine';
import type { PolicyMode } from '@togi/policy-engine';
import { getDefaultPolicy } from '@togi/policy-engine';
import type { PolicyConfig } from '@togi/policy-engine';

export function createPolicyContext(
  mode: PolicyMode = 'BALANCED',
  overrides: Partial<PolicyContext> = {}
): PolicyContext {
  const config = getDefaultPolicy(mode) as PolicyConfig;

  // Map policy-engine config to detection-engine PolicyContext format
  const context: PolicyContext = {
    mode,
    floodProtection: config.floodProtection,
    linkProtection: config.linkProtection,
    newMemberProtection: {
      enabled: config.newMemberProtection.enabled,
      probationMinutes: config.newMemberProtection.probationMinutes,
      restrictions: [], // Not present in policy-engine config; defaults to empty
      canInvite: true,  // Not present in policy-engine config
    },
    threatProtection: config.threatProtection,
    spamProtection: config.spamProtection,
    raidProtection: {
      enabled: config.raidProtection.enabled,
      joinWindowSeconds: config.raidProtection.windowSeconds,
      maxJoinsPerWindow: config.raidProtection.joinSpikeThreshold,
      action: 'IGNORE', // Not present in policy-engine config; defaults to IGNORE
      alertAdmins: config.raidProtection.alertAdmins,
      autoProtect: config.raidProtection.autoLockdown,
    },
    actionPolicy: config.actionPolicy,
    adminAlerts: {
      enabled: config.adminAlerts.enabled,
      alertOnViolation: config.adminAlerts.alertOnViolation,
      alertOnRaid: config.adminAlerts.alertOnRaid,
      minSeverity: config.adminAlerts.minSeverity,
    },
    ...overrides,
  };

  return context;
}