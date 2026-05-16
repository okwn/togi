export type TriggerType = 'SCHEDULED' | 'RAID' | 'SPIKE' | 'ADMIN_REQUEST' | 'POLICY_REVIEW';

export type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type SafetyLevel = 'OBSERVE_ONLY' | 'RECOMMEND_ONLY' | 'AUTO_LOW_RISK' | 'AUTO_HIGH_RISK_WITH_POLICY';

export type RecommendationType = 'POLICY_CHANGE' | 'DOMAIN_BLOCK' | 'LOCKDOWN' | 'ALLOWLIST' | 'USER_MUTE';

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'EXPIRED';

export type ActionRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Observation {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ViolationSummary {
  countLastHour: number;
  countLast24h: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  topTypes: Array<{ type: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface SecuritySummary {
  currentScore: number;
  scoreDelta: number;
  botPermissionsOk: boolean;
  policyMode: string;
  protectionEnabled: boolean;
}

export interface ObservationResult {
  groupId: string;
  timestamp: number;
  violations: ViolationSummary;
  security: SecuritySummary;
  topRiskyUsers: Array<{ userId: string; riskScore: number }>;
  threatIndicators: Array<{ type: string; valueHash: string; riskScore: number }>;
  joinRate: number;
  botPermissions: {
    canDelete: boolean;
    canRestrict: boolean;
    canInvite: boolean;
    canManageVideoChats: boolean;
  };
}

export interface PlannedAction {
  id: string;
  type: string;
  risk: ActionRisk;
  target: string;
  params: Record<string, unknown>;
  reason: string;
}

export interface Plan {
  actions: PlannedAction[];
  summary: string;
}

export interface ExecutedAction {
  action: PlannedAction;
  status: 'EXECUTED' | 'RECOMMENDED' | 'BLOCKED' | 'PENDING_APPROVAL';
  executedAt?: number;
  approvedBy?: string;
}

export interface Reflection {
  violationsAfter: number;
  violationsBefore: number;
  falsePositivesDetected: boolean;
  adminOverrides: number;
  recommendationAccuracy: number;
  shouldRollback: boolean;
  rollbackReason: string | null;
}

export interface AgentConfig {
  groupId: string;
  trigger: TriggerType;
  safetyLevel: SafetyLevel;
  autonomousPolicy: {
    enabled: boolean;
    mode: SafetyLevel;
    allowAutoPolicyTuning: boolean;
    allowAutoDomainBlocking: boolean;
    allowAutoLockdown: boolean;
    allowAutoReports: boolean;
    maxActionsPerHour: number;
    requireHumanApprovalForHighImpact: boolean;
  };
}