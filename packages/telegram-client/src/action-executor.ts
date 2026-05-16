// Telegram Action Executor
// Executes moderation actions with idempotency, error handling, and admin protection

import { Bot } from 'grammy';
import { keys, redis } from '@togi/db';
import type { RedisClient } from '@togi/db';
import type {
  ActionResult,
  ActionInput,
  DeleteMessageInput,
  WarnUserInput,
  RestrictUserInput,
  BanUserInput,
  KickUserInput,
  LockdownInput,
  AdminAlertInput,
  ExecuteDecisionInput,
  MutePreset,
} from './action-types';
import { getMutePresetDuration } from './action-types';

const ACTION_LOCK_TTL = 300; // 5 minutes

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'error_code' in error) {
    return String((error as { error_code: unknown }).error_code);
  }
  return 'UNKNOWN';
}

function isRetriableError(error: unknown): boolean {
  const code = getErrorCode(error);
  const retriableCodes = ['429', '500', '502', '503', '504'];
  return retriableCodes.includes(code);
}

export class TelegramActionExecutor {
  private bot: Bot;
  private redisClient: RedisClient;

  constructor(bot: Bot, redisClient: RedisClient = redis) {
    this.bot = bot;
    this.redisClient = redisClient;
  }

  /**
   * Acquire action lock for idempotency
   */
  private async acquireActionLock(
    chatId: number,
    messageId: number | undefined,
    action: string
  ): Promise<boolean> {
    const key = keys.actionLock(chatId, messageId || 'no-msg', action);
    const result = await this.redisClient.set(key, '1', 'EX', ACTION_LOCK_TTL, 'NX');
    return result === 'OK';
  }

  /**
   * Release action lock
   */
  private async releaseActionLock(
    chatId: number,
    messageId: number | undefined,
    action: string
  ): Promise<void> {
    const key = keys.actionLock(chatId, messageId || 'no-msg', action);
    await this.redisClient.del(key);
  }

  /**
   * Check if target user is admin
   */
  async isUserAdmin(chatId: number, userId: number): Promise<boolean> {
    try {
      const chatMember = await this.bot.api.getChatMember(chatId, userId);
      const status = 'status' in chatMember ? chatMember.status : 'unknown';
      return ['creator', 'administrator'].includes(status);
    } catch {
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(input: DeleteMessageInput): Promise<ActionResult> {
    const { chatId, messageId, reason } = input;

    // Acquire lock for idempotency
    if (!(await this.acquireActionLock(chatId, messageId, 'DELETE'))) {
      return {
        ok: true,
        action: 'DELETE',
        telegramMethod: 'deleteMessage',
        errorMessage: 'Already attempted',
        retriable: false,
      };
    }

    try {
      await this.bot.api.deleteMessage(chatId, messageId);
      return {
        ok: true,
        action: 'DELETE',
        telegramMethod: 'deleteMessage',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      // Missing permission
      if (errorCode === '400' && message.includes('not have rights')) {
        return {
          ok: false,
          action: 'DELETE',
          telegramMethod: 'deleteMessage',
          errorCode,
          errorMessage: 'Missing delete permission',
          retriable: false,
        };
      }

      // Message already deleted
      if (errorCode === '400' && message.includes('message to delete not found')) {
        return {
          ok: true,
          action: 'DELETE',
          telegramMethod: 'deleteMessage',
          errorMessage: 'Message already deleted',
          retriable: false,
        };
      }

      return {
        ok: false,
        action: 'DELETE',
        telegramMethod: 'deleteMessage',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, messageId, 'DELETE');
    }
  }

  /**
   * Warn a user (stores warning in punishments table - caller should handle DB)
   */
  async warnUser(input: WarnUserInput): Promise<ActionResult> {
    const { chatId, userId, reason } = input;

    if (!userId) {
      return {
        ok: false,
        action: 'WARN',
        errorMessage: 'userId is required',
        retriable: false,
      };
    }

    // Check admin protection
    if (await this.isUserAdmin(chatId, userId)) {
      return {
        ok: false,
        action: 'WARN',
        errorMessage: 'Cannot warn group admin',
        retriable: false,
      };
    }

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'WARN'))) {
      return {
        ok: true,
        action: 'WARN',
        errorMessage: 'Already warned recently',
        retriable: false,
      };
    }

    try {
      // Send warning message to user
      await this.bot.api.sendMessage(
        chatId,
        `⚠️ <b>Warning</b>\n\nUser mentioned: @${reason || 'unknown'}\n\nThis is a warning for violating group rules.`,
        { parse_mode: 'HTML' }
      );

      return {
        ok: true,
        action: 'WARN',
        telegramMethod: 'sendMessage',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'WARN',
        telegramMethod: 'sendMessage',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'WARN');
    }
  }

  /**
   * Restrict/mute a user
   */
  async restrictUser(input: RestrictUserInput): Promise<ActionResult> {
    const { chatId, userId, untilDate, permissions, reason } = input;

    if (!userId) {
      return {
        ok: false,
        action: 'RESTRICT',
        errorMessage: 'userId is required',
        retriable: false,
      };
    }

    // Check admin protection
    if (await this.isUserAdmin(chatId, userId)) {
      return {
        ok: false,
        action: 'RESTRICT',
        errorMessage: 'Cannot restrict group admin',
        retriable: false,
      };
    }

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'RESTRICT'))) {
      return {
        ok: true,
        action: 'RESTRICT',
        errorMessage: 'Already restricted recently',
        retriable: false,
      };
    }

    try {
      const restrictPermissions = {
        can_send_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        ...permissions,
      } as any;

      await (this.bot.api.restrictChatMember as any)(chatId, userId, {
        until_date: untilDate ? Math.floor(untilDate.getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600,
        permissions: restrictPermissions,
      });

      return {
        ok: true,
        action: 'RESTRICT',
        telegramMethod: 'restrictChatMember',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'RESTRICT',
        telegramMethod: 'restrictChatMember',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'RESTRICT');
    }
  }

  /**
   * Ban a user
   */
  async banUser(input: BanUserInput): Promise<ActionResult> {
    const { chatId, userId, reason } = input;

    if (!userId) {
      return {
        ok: false,
        action: 'BAN',
        errorMessage: 'userId is required',
        retriable: false,
      };
    }

    // Check admin protection
    if (await this.isUserAdmin(chatId, userId)) {
      return {
        ok: false,
        action: 'BAN',
        errorMessage: 'Cannot ban group admin',
        retriable: false,
      };
    }

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'BAN'))) {
      return {
        ok: true,
        action: 'BAN',
        errorMessage: 'Already banned',
        retriable: false,
      };
    }

    try {
      await this.bot.api.banChatMember(chatId, userId);

      return {
        ok: true,
        action: 'BAN',
        telegramMethod: 'banChatMember',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'BAN',
        telegramMethod: 'banChatMember',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'BAN');
    }
  }

  /**
   * Kick a user (ban and immediately unban)
   */
  async kickUser(input: KickUserInput): Promise<ActionResult> {
    const { chatId, userId, reason } = input;

    if (!userId) {
      return {
        ok: false,
        action: 'KICK',
        errorMessage: 'userId is required',
        retriable: false,
      };
    }

    // Check admin protection
    if (await this.isUserAdmin(chatId, userId)) {
      return {
        ok: false,
        action: 'KICK',
        errorMessage: 'Cannot kick group admin',
        retriable: false,
      };
    }

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'KICK'))) {
      return {
        ok: true,
        action: 'KICK',
        errorMessage: 'Already kicked recently',
        retriable: false,
      };
    }

    try {
      // Kick = ban then unban
      await this.bot.api.banChatMember(chatId, userId);
      await this.bot.api.unbanChatMember(chatId, userId, { only_if_banned: true });

      return {
        ok: true,
        action: 'KICK',
        telegramMethod: 'banChatMember+unbanChatMember',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'KICK',
        telegramMethod: 'banChatMember',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'KICK');
    }
  }

  /**
   * Set lockdown (restrict all permissions except reading)
   */
  async setLockdown(input: LockdownInput): Promise<ActionResult> {
    const { chatId } = input;

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'LOCKDOWN'))) {
      return {
        ok: true,
        action: 'LOCKDOWN',
        errorMessage: 'Already in lockdown',
        retriable: false,
      };
    }

    try {
      await this.bot.api.setChatPermissions(chatId, {
        can_send_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_change_info: false,
      } as any);

      return {
        ok: true,
        action: 'LOCKDOWN',
        telegramMethod: 'setChatPermissions',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'LOCKDOWN',
        telegramMethod: 'setChatPermissions',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'LOCKDOWN');
    }
  }

  /**
   * Unset lockdown (restore previous permissions)
   */
  async unsetLockdown(input: LockdownInput): Promise<ActionResult> {
    const { chatId, previousPermissions } = input;

    // Acquire lock
    if (!(await this.acquireActionLock(chatId, undefined, 'UNLOCK'))) {
      return {
        ok: true,
        action: 'UNLOCK',
        errorMessage: 'Not in lockdown or already unlocked',
        retriable: false,
      };
    }

    try {
      // Restore previous permissions or allow all
      const permissions = previousPermissions || {
        can_send_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_change_info: true,
      };

      await this.bot.api.setChatPermissions(chatId, permissions as any);

      return {
        ok: true,
        action: 'UNLOCK',
        telegramMethod: 'setChatPermissions',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'UNLOCK',
        telegramMethod: 'setChatPermissions',
        errorCode,
        errorMessage: message,
        retriable: isRetriableError(error),
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'UNLOCK');
    }
  }

  /**
   * Send admin alert
   */
  async sendAdminAlert(input: AdminAlertInput): Promise<ActionResult> {
    const { chatId, alertType, riskScore, labels, reason, severity } = input;

    // Acquire lock to prevent spam
    if (!(await this.acquireActionLock(chatId, undefined, 'ALERT'))) {
      return {
        ok: true,
        action: 'ALERT',
        errorMessage: 'Alert already sent recently',
        retriable: false,
      };
    }

    try {
      const alertLines = [
        '🚨 <b>TOGI Alert</b>',
        '',
        `Action: ${alertType}`,
        riskScore ? `Risk: ${riskScore}/100` : '',
        severity ? `Severity: ${severity}` : '',
        labels?.length ? `Labels: ${labels.join(', ')}` : '',
        reason ? `Reason: ${reason}` : '',
      ].filter(Boolean);

      await this.bot.api.sendMessage(chatId, alertLines.join('\n'), { parse_mode: 'HTML' });

      return {
        ok: true,
        action: 'ALERT',
        telegramMethod: 'sendMessage',
        retriable: false,
      };
    } catch (error) {
      const errorCode = getErrorCode(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        ok: false,
        action: 'ALERT',
        telegramMethod: 'sendMessage',
        errorCode,
        errorMessage: message,
        retriable: false,
      };
    } finally {
      await this.releaseActionLock(chatId, undefined, 'ALERT');
    }
  }

  /**
   * Execute a decision based on recommended action
   */
  async executeDecision(input: ExecuteDecisionInput): Promise<ActionResult> {
    const { chatId, userId, messageId, recommendedAction, riskScore, reason, severity, labels } = input;

    const actionInput: ActionInput = {
      chatId,
      userId,
      messageId,
      reason,
      severity,
      labels,
    };

    switch (recommendedAction) {
      case 'DELETE':
        if (messageId) {
          return this.deleteMessage({ ...actionInput, messageId });
        }
        return { ok: false, action: 'DELETE', errorMessage: 'messageId required', retriable: false };

      case 'DELETE_WARN':
        if (messageId) {
          await this.deleteMessage({ ...actionInput, messageId });
        }
        if (userId) {
          await this.warnUser({ ...actionInput, userId });
        }
        return { ok: true, action: 'DELETE_WARN', retriable: false };

      case 'DELETE_MUTE':
        if (messageId) {
          await this.deleteMessage({ ...actionInput, messageId });
        }
        if (userId) {
          await this.restrictUser({
            ...actionInput,
            userId,
            untilDate: new Date(Date.now() + getMutePresetDuration('1_HOUR')),
          });
        }
        return { ok: true, action: 'DELETE_MUTE', retriable: false };

      case 'DELETE_BAN':
        if (messageId) {
          await this.deleteMessage({ ...actionInput, messageId });
        }
        if (userId) {
          await this.banUser({ ...actionInput, userId });
        }
        return { ok: true, action: 'DELETE_BAN', retriable: false };

      case 'WARN':
        if (userId) {
          return this.warnUser({ ...actionInput, userId });
        }
        return { ok: false, action: 'WARN', errorMessage: 'userId required', retriable: false };

      case 'MUTE':
        if (userId) {
          return this.restrictUser({
            ...actionInput,
            userId,
            untilDate: new Date(Date.now() + getMutePresetDuration('30_MINUTES')),
          });
        }
        return { ok: false, action: 'MUTE', errorMessage: 'userId required', retriable: false };

      case 'BAN':
        if (userId) {
          return this.banUser({ ...actionInput, userId });
        }
        return { ok: false, action: 'BAN', errorMessage: 'userId required', retriable: false };

      case 'KICK':
        if (userId) {
          return this.kickUser({ ...actionInput, userId });
        }
        return { ok: false, action: 'KICK', errorMessage: 'userId required', retriable: false };

      case 'ALLOW':
      case 'LOG':
        return { ok: true, action: recommendedAction, retriable: false };

      case 'REVIEW':
        // Send for admin review
        return this.sendAdminAlert({
          ...actionInput,
          alertType: 'REVIEW',
          riskScore,
        });

      default:
        // Fallback to REVIEW for unknown actions
        return {
          ok: true,
          action: 'REVIEW',
          retriable: false,
        };
    }
  }
}
