// Policy Types

export type PolicyMode = 'RELAXED' | 'BALANCED' | 'STRICT' | 'PARANOID' | 'CUSTOM';

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ActionType = 'DELETE' | 'WARN' | 'MUTE' | 'BAN' | 'KICK' | 'RESTRICT' | 'REVIEW' | 'IGNORE';

export interface SpamProtectionConfig {
  enabled: boolean;
  deleteThreshold: number;        // messages per window
  windowSeconds: number;
  action: ActionType;
  warnAfter: number;
}

export interface FloodProtectionConfig {
  enabled: boolean;
  maxMessages: number;
  windowSeconds: number;
  action: ActionType;
  mediaMultiplier: number;        // media messages count more
}

export interface LinkProtectionConfig {
  enabled: boolean;
  shortenerAction: ActionType;
  blockedDomains: string[];
  allowedDomains: string[];
  newMemberBlocks: boolean;
  newMemberBlockMinutes: number;
}

export interface NewMemberProtectionConfig {
  enabled: boolean;
  probationMinutes: number;
  blockLinksDuringProbation: boolean;
  blockMediaDuringProbation: boolean;
  blockMentionsDuringProbation: boolean;
  firstMessageStrictMode: boolean;
  verificationRequired: boolean;
}

export interface ThreatProtectionConfig {
  enabled: boolean;
  scamPatternsAction: ActionType;
  threatPatternsAction: ActionType;
  deleteOnMatch: boolean;
}

export interface RaidProtectionConfig {
  enabled: boolean;
  joinSpikeThreshold: number;
  windowSeconds: number;
  autoLockdown: boolean;
  lockdownMinutes: number;
  restrictNewMembers: boolean;
  alertAdmins: boolean;
  paranoidDuringRaid: boolean;
}

export interface ActionPolicyConfig {
  warnEnabled: boolean;
  muteEnabled: boolean;
  banEnabled: boolean;
  deleteEnabled: boolean;
  kickEnabled: boolean;
  maxWarnsBeforeMute: number;
  maxMutesBeforeBan: number;
  muteDurationMinutes: number;
}

export interface AdminAlertsConfig {
  enabled: boolean;
  alertOnViolation: boolean;
  alertOnRaid: boolean;
  alertChannel: string | null;
  minSeverity: ViolationSeverity;
}

export interface PolicyConfig {
  spamProtection: SpamProtectionConfig;
  floodProtection: FloodProtectionConfig;
  linkProtection: LinkProtectionConfig;
  newMemberProtection: NewMemberProtectionConfig;
  threatProtection: ThreatProtectionConfig;
  raidProtection: RaidProtectionConfig;
  actionPolicy: ActionPolicyConfig;
  adminAlerts: AdminAlertsConfig;
}

export interface GroupPolicy {
  id: string;
  groupId: string;
  mode: PolicyMode;
  config: PolicyConfig;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityScore {
  total: number;
  botAdminStatus: number;
  permissions: number;
  protections: number;
  lists: number;
  audit: number;
  breakdown: {
    hasDeletePermission: boolean;
    hasRestrictPermission: boolean;
    hasJoinRequestPermission: boolean;
    floodProtectionEnabled: boolean;
    linkProtectionEnabled: boolean;
    newMemberProtectionEnabled: boolean;
    raidProtectionEnabled: boolean;
    hasBlocklist: boolean;
    hasAllowlist: boolean;
    auditLoggingEnabled: boolean;
  };
}

export interface BotPermissions {
  canDeleteMessages: boolean;
  canRestrictMembers: boolean;
  canChangeInfo: boolean;
  canInviteUsers: boolean;
  canPinMessages: boolean;
  canPromoteMembers: boolean;
  canManageVideoChats: boolean;
  isAdmin: boolean;
  status: 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN';
}
