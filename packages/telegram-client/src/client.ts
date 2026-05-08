import { Bot, Context } from 'grammy';
import { BotConfig, PermissionReport, BotPermission } from './types';

const REQUIRED_PERMISSIONS = [
  {
    name: 'can_delete_messages',
    description: 'Delete spam and inappropriate messages',
  },
  {
    name: 'can_restrict_members',
    description: 'Restrict or ban users who violate rules',
  },
  {
    name: 'can_invite_users',
    description: 'Manage join requests',
  },
  {
    name: 'can_manage_chat',
    description: 'Manage group settings',
  },
  {
    name: 'can_pin_messages',
    description: 'Pin important announcements',
  },
  {
    name: 'can_manage_topics',
    description: 'Manage forum topics',
  },
];

export class TelegramBot {
  private bot: Bot;
  private config: BotConfig;
  private botUserId: number | null = null;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Bot(config.botToken);
  }

  get Bot(): Bot {
    return this.bot;
  }

  async getMe(): Promise<{ id: number; is_bot: boolean; first_name: string; username: string }> {
    const result = await this.bot.api.getMe();
    return result;
  }

  async getBotUserId(): Promise<number> {
    if (this.botUserId === null) {
      this.botUserId = (await this.getMe()).id;
    }
    return this.botUserId;
  }

  async checkPermissions(chatId: number | string): Promise<PermissionReport> {
    try {
      const botId = await this.getBotUserId();
      const chatMember = await this.bot.api.getChatMember(chatId, botId);

      const status = 'status' in chatMember ? chatMember.status : 'unknown';
      const isAdmin = ['creator', 'administrator'].includes(status);

      let permissionStatus: 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN' = 'UNKNOWN';
      if (isAdmin) {
        permissionStatus = 'ADMIN';
      } else if (status === 'member' || status === 'left' || status === 'kicked') {
        permissionStatus = 'NOT_ADMIN';
      }

      const permissions: BotPermission[] = REQUIRED_PERMISSIONS.map((perm) => {
        const canDo = perm.name in chatMember
          ? Boolean((chatMember as unknown as Record<string, unknown>)[perm.name])
          : false;

        return {
          name: perm.name,
          canDo,
          description: perm.description,
        };
      });

      const missingPermissions = permissions
        .filter((p) => !p.canDo)
        .map((p) => p.description);

      return {
        chatId: chatId.toString(),
        botUserId: botId.toString(),
        botUsername: (await this.getMe()).username,
        permissions,
        isAdmin,
        status: permissionStatus,
        missingPermissions,
        allRequiredPermissions: REQUIRED_PERMISSIONS.map((p) => p.description),
      };
    } catch (error) {
      throw new Error(`Failed to check permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  formatPermissionReport(report: PermissionReport): string {
    const lines: string[] = [
      '🔒 <b>TOGI Security Check</b>',
      '',
    ];

    if (report.isAdmin) {
      lines.push('✅ Bot is present in this group as admin');
    } else {
      lines.push('❌ Bot is NOT an admin in this group');
      lines.push('');
      lines.push('⚠️ <b>Bot needs to be an admin to protect this group</b>');
      return lines.join('\n');
    }

    for (const perm of report.permissions) {
      const icon = perm.canDo ? '✅' : '❌';
      lines.push(`${icon} ${perm.description}`);
    }

    if (report.missingPermissions.length > 0) {
      lines.push('');
      lines.push('⚠️ <b>Missing permissions:</b>');
      for (const missing of report.missingPermissions) {
        lines.push(`  • ${missing}`);
      }
    }

    lines.push('');
    lines.push('📋 <b>Required for full protection:</b>');
    lines.push('  • Delete messages');
    lines.push('  • Restrict members');
    lines.push('  • Ban users');
    lines.push('  • Manage join requests');

    return lines.join('\n');
  }

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<void> {
    try {
      await this.bot.api.deleteMessage(chatId, messageId);
    } catch (error) {
      // Ignore if message already deleted
      if (error instanceof Error && !error.message.includes('message to delete not found')) {
        throw error;
      }
    }
  }

  async restrictChatMember(
    chatId: number | string,
    userId: number,
    permissions: {
      can_send_messages?: boolean;
      can_send_media_messages?: boolean;
      can_send_other_messages?: boolean;
      until_date?: number;
    }
  ): Promise<void> {
    await this.bot.api.restrictChatMember(chatId, userId, permissions);
  }

  async kickChatMember(chatId: number | string, userId: number): Promise<void> {
    await this.bot.api.banChatMember(chatId, userId);
  }

  async unbanChatMember(chatId: number | string, userId: number): Promise<void> {
    await this.bot.api.unbanChatMember(chatId, userId, { only_if_banned: true });
  }
}

export function createTelegramBot(config: BotConfig): TelegramBot {
  return new TelegramBot(config);
}
