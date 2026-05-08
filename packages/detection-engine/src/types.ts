export type DetectionLabel =
  | 'SPAM'
  | 'FLOOD'
  | 'DUPLICATE'
  | 'LINK'
  | 'SHORTENER'
  | 'BLOCKED_DOMAIN'
  | 'NEW_USER_LINK'
  | 'SCAM_PATTERN'
  | 'PHISHING_PATTERN'
  | 'THREAT'
  | 'HARASSMENT'
  | 'MENTION_SPAM'
  | 'MEDIA_FLOOD'
  | 'RAID_SIGNAL'
  | 'SUSPICIOUS_PROFILE';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecommendedAction =
  | 'ALLOW'
  | 'LOG'
  | 'WARN'
  | 'DELETE'
  | 'DELETE_WARN'
  | 'DELETE_MUTE'
  | 'DELETE_BAN'
  | 'REVIEW';

export interface DetectionResult {
  riskScore: number;
  labels: DetectionLabel[];
  severity: Severity;
  recommendedAction: RecommendedAction;
  reasons: string[];
  fastPath: boolean;
}

export interface DetectionContext {
  chatId: string;
  userId: string | undefined;
  username: string | undefined;
  text: string | undefined;
  links: string[];
  mediaType: string | undefined;
  messageId: number | undefined;
  mentions: string[];
  isNewUser: boolean;
  userMemberSince: number | undefined;
  timestamp: number;
}

export interface PolicyContext {
  mode: 'RELAXED' | 'BALANCED' | 'STRICT' | 'PARANOID' | 'CUSTOM';
  floodProtection: {
    enabled: boolean;
    maxMessages: number;
    windowSeconds: number;
    action: string;
    mediaMultiplier: number;
  };
  linkProtection: {
    enabled: boolean;
    shortenerAction: string;
    blockedDomains: string[];
    allowedDomains: string[];
    newMemberBlocks: boolean;
    newMemberBlockMinutes: number;
  };
  newMemberProtection: {
    enabled: boolean;
    probationMinutes: number;
    restrictions: string[];
    canInvite: boolean;
  };
  threatProtection: {
    enabled: boolean;
    scamPatternsAction: string;
    threatPatternsAction: string;
    deleteOnMatch: boolean;
  };
  spamProtection: {
    enabled: boolean;
    deleteThreshold: number;
    windowSeconds: number;
    action: string;
    warnAfter: number;
  };
  raidProtection: {
    enabled: boolean;
    joinWindowSeconds: number;
    maxJoinsPerWindow: number;
    action: string;
    alertAdmins: boolean;
    autoProtect: boolean;
  };
  actionPolicy: {
    warnEnabled: boolean;
    muteEnabled: boolean;
    banEnabled: boolean;
    deleteEnabled: boolean;
    kickEnabled: boolean;
    maxWarnsBeforeMute: number;
    maxMutesBeforeBan: number;
    muteDurationMinutes: number;
  };
  adminAlerts: {
    enabled: boolean;
    alertOnViolation: boolean;
    alertOnRaid: boolean;
    minSeverity: string;
  };
}

export interface DetectorConfig {
  enabled: boolean;
}

export interface RateLimitEntry {
  count: number;
  firstMessageTime: number;
  lastMessageTime: number;
}

export interface DuplicateEntry {
  textHash: string;
  userId: string;
  messageId: number;
  timestamp: number;
}

export interface RaidState {
  joinCount: number;
  windowStart: number;
  isRaid: boolean;
}
