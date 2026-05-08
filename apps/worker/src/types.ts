// Worker Job Types

export interface AsyncAnalysisJob {
  eventId: string;
  groupId: string;
  chatId: string;
  userId?: string;
  username?: string;
  messageId?: string;
  text?: string;
  textHash?: string;
  links: string[];
  initialRisk: number;
  labels: string[];
  createdAt: string;
}

export interface ActionRetryJob {
  action: string;
  chatId: number;
  messageId?: number;
  userId?: number;
  attempt: number;
  reason: string;
}

export interface AuditEventJob {
  groupId: string;
  actorTelegramUserId: number;
  action: string;
  targetType: 'USER' | 'MESSAGE' | 'GROUP';
  targetId: string;
  metadata: Record<string, unknown>;
}

export interface DomainIntelJob {
  eventId: string;
  groupId: string;
  chatId: string;
  userId?: string;
  links: string[];
  textHash: string;
  createdAt: string;
}

export interface RaidCorrelationJob {
  eventId: string;
  groupId: string;
  chatId: string;
  joinEvents: {
    userId: string;
    timestamp: number;
  }[];
  detectedAt: string;
}

// AI Classification Types

export type AILabel =
  | 'NORMAL'
  | 'SPAM'
  | 'SCAM'
  | 'PHISHING'
  | 'THREAT'
  | 'HARASSMENT'
  | 'HATE'
  | 'DOXXING'
  | 'NSFW'
  | 'IMPERSONATION';

export type AISeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AIRecommendedAction =
  | 'NO_ACTION'
  | 'REVIEW'
  | 'DELETE'
  | 'DELETE_MUTE'
  | 'DELETE_BAN';

export interface AIClassificationResult {
  label: AILabel;
  confidence: number;
  severity: AISeverity;
  recommendedAction: AIRecommendedAction;
  explanation: string;
}

// Metrics Types

export interface WorkerMetrics {
  processedJobs: number;
  failedJobs: number;
  queueLatency: number;
  p95ProcessingDuration: number;
  aiTimeoutCount: number;
  actionRetryCount: number;
  raidSignalCount: number;
  queues: QueueMetrics[];
}

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// Domain Intelligence Types

export interface DomainAnalysis {
  domain: string;
  isPunycode: boolean;
  isHomograph: boolean;
  hasSuspiciousTLD: boolean;
  isShortener: boolean;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
}

// Raid Detection Types

export interface RaidSignal {
  groupId: string;
  chatId: string;
  joinCount: number;
  joinWindowSeconds: number;
  duplicateMessageCount: number;
  repeatedDomainCount: number;
  newUserViolationCount: number;
  severity: AISeverity;
  recommendedAction: 'LOCKDOWN' | 'ALERT' | 'REVIEW';
  detectedAt: string;
}