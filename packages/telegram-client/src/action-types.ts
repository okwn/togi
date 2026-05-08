// Action Executor Types

export interface ActionResult {
  ok: boolean;
  action: string;
  telegramMethod?: string;
  errorCode?: string;
  errorMessage?: string;
  retriable: boolean;
}

export interface ActionInput {
  chatId: number;
  userId?: number;
  messageId?: number;
  reason?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface DeleteMessageInput extends ActionInput {
  messageId: number;
}

export interface WarnUserInput extends ActionInput {
  userId: number;
}

export interface RestrictUserInput extends ActionInput {
  userId: number;
  untilDate?: Date;
  permissions?: {
    can_send_messages?: boolean;
    can_send_other_messages?: boolean;
    can_add_web_page_previews?: boolean;
  };
}

export interface BanUserInput extends ActionInput {
  userId: number;
}

export interface KickUserInput extends ActionInput {
  userId: number;
}

export interface LockdownInput extends ActionInput {
  previousPermissions?: {
    can_send_messages?: boolean;
    can_send_other_messages?: boolean;
    can_add_web_page_previews?: boolean;
    can_invite_users?: boolean;
    can_pin_messages?: boolean;
    can_change_info?: boolean;
  };
}

export interface AdminAlertInput extends ActionInput {
  alertType: string;
  riskScore?: number;
}

export interface ExecuteDecisionInput extends ActionInput {
  recommendedAction: string;
  riskScore: number;
}

// Mute presets in milliseconds
export const MUTE_PRESETS = {
  '5_MINUTES': 5 * 60 * 1000,
  '30_MINUTES': 30 * 60 * 1000,
  '1_HOUR': 60 * 60 * 1000,
  '24_HOURS': 24 * 60 * 60 * 1000,
} as const;

export type MutePreset = keyof typeof MUTE_PRESETS;

export function getMutePresetDuration(preset: MutePreset): number {
  return MUTE_PRESETS[preset] || MUTE_PRESETS['30_MINUTES'];
}
