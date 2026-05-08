// Types for TOGI Web Dashboard

export interface Group {
  id: string;
  telegramChatId: number;
  name: string;
  type: 'group' | 'supergroup';
  status: 'ACTIVE' | 'LEFT' | 'UNKNOWN';
  botAdminStatus: 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN' | 'MISSING_PERMISSIONS';
  createdAt: string;
  updatedAt: string;
}

export interface PolicyConfig {
  mode: PolicyMode;
  spamProtection: SpamProtection;
  floodProtection: FloodProtection;
  linkProtection: LinkProtection;
  newMemberProtection: NewMemberProtection;
  threatProtection: ThreatProtection;
  raidProtection: RaidProtection;
  actionPolicy: ActionPolicy;
  adminAlerts: AdminAlerts;
}

export type PolicyMode = 'RELAXED' | 'BALANCED' | 'STRICT' | 'PARANOID' | 'CUSTOM';

export interface SpamProtection {
  enabled: boolean;
  deleteThreshold: number;
  warnCount: number;
  windowSeconds: number;
}

export interface FloodProtection {
  enabled: boolean;
  maxMessages: number;
  windowSeconds: number;
  mediaMultiplier: number;
}

export interface LinkProtection {
  enabled: boolean;
  allowShorteners: boolean;
  blockNewUserLinks: boolean;
  blockTelegramInvites: boolean;
  blockDiscordInvites: boolean;
}

export interface NewMemberProtection {
  enabled: boolean;
  probationMinutes: number;
  restrictNewUsers: boolean;
  allowMedia: boolean;
}

export interface ThreatProtection {
  enabled: boolean;
  scanMessages: boolean;
  blockKeywords: boolean;
}

export interface RaidProtection {
  enabled: boolean;
  joinWindowSeconds: number;
  maxJoins: number;
  autoLockdown: boolean;
}

export interface ActionPolicy {
  warnThreshold: number;
  muteThreshold: number;
  banThreshold: number;
  muteDurationMinutes: number;
  maxWarnings: number;
}

export interface AdminAlerts {
  enabled: boolean;
  severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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

export interface Violation {
  id: string;
  groupId: string;
  telegramUserId: number | null;
  telegramMessageId: string | null;
  violationType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  action: string;
  reason: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  groupId: string;
  actorTelegramUserId: number;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DomainRule {
  id: string;
  groupId: string;
  domain: string;
  ruleType: 'ALLOW' | 'BLOCK' | 'WATCH';
  createdAt: string;
}

export interface Member {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  punishmentType: 'WARN' | 'MUTE' | 'BAN' | null;
  punishmentExpiresAt: string | null;
  warningCount: number;
}