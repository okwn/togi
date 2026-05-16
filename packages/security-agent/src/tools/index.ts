export interface Tool {
  name: string;
  description: string;
  riskLevel: 'READ' | 'LOW' | 'MEDIUM' | 'HIGH';
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolContext {
  groupId: string;
  db: unknown;
  redis: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Re-export all tools
export * from './get-group-policy.js';
export * from './get-recent-violations.js';
export * from './get-user-risk-profiles.js';
export * from './get-threat-indicators.js';
export * from './get-bot-permissions.js';