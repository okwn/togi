export interface BotConfig {
  botToken: string;
  webhookSecret?: string;
}

export interface BotPermission {
  name: string;
  canDo: boolean;
  description: string;
}

export interface PermissionReport {
  chatId: string;
  chatTitle?: string;
  botUserId?: string;
  botUsername?: string;
  permissions: BotPermission[];
  isAdmin: boolean;
  status?: 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN';
  missingPermissions: string[];
  allRequiredPermissions: string[];
}
