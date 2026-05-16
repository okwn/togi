import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TelegramBot, TelegramActionExecutor } from '@togi/telegram-client';
import {
  normalizeUpdate,
  hashText,
  safeEventMetadata,
  createSecurityEvent,
  enqueueSecurityEvent,
  RawTelegramUpdate,
} from '@togi/shared';
import { getEnv } from '@togi/config';
import { db, redis, keys } from '@togi/db';
import {
  groups,
  groupPolicies,
  auditLogs,
  violations,
  groupAdmins,
} from '@togi/db';
import { eq, and, isNull } from 'drizzle-orm';
import { getDefaultPolicy } from '@togi/policy-engine';
import { ROLE_PERMISSIONS } from '@togi/auth';
import {
  runFastPath,
  DetectionContext,
  PolicyContext,
  DetectionResult,
} from '@togi/detection-engine';
import {
  checkGroupActionRateLimit,
  checkUserCommandRateLimit,
  ErrorCode,
  createError,
} from '../middleware/security';
import { rateLimitService } from '../services/rate-limit-service';
import { idempotencyService, UpdateState } from '../services/idempotency';

export interface WebhookContext {
  bot: TelegramBot;
  actionExecutor: TelegramActionExecutor;
  env: ReturnType<typeof getEnv>;
}

function extractTextHash(text?: string): string | undefined {
  if (!text) return undefined;
  return hashText(text);
}

export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  context: WebhookContext
) {
  const { bot, actionExecutor, env } = context;

  // POST /webhooks/telegram - Main webhook endpoint
  fastify.post('/webhooks/telegram', {
  config: {
    bodyLimit: env.WEBHOOK_BODY_MAX_BYTES,
  }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = request.id;
    let updateId = '';

    try {
      // Verify webhook secret
      const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
      const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;

      if (env.NODE_ENV === 'production' && !expectedSecret) {
        request.log.error({ requestId }, 'TELEGRAM_WEBHOOK_SECRET not set in production');
        return reply.status(500).send({ error: 'Server misconfigured' });
      }

      if (expectedSecret && secretHeader !== expectedSecret) {
        request.log.warn({ requestId }, 'Invalid webhook secret');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const update = request.body as RawTelegramUpdate;
      if (!update.update_id) {
        return reply.status(400).send({ error: 'Invalid update' });
      }

      // Update idempotency — prevent duplicate processing
      const updateId = update.update_id.toString();
      const existingState = await idempotencyService.checkUpdate(updateId);

      if (existingState === UpdateState.PROCESSED) {
        request.log.info({ requestId, updateId }, 'Update already processed, returning 200');
        return reply.status(200).send({ ok: true, duplicate: true });
      }

      const claimed = await idempotencyService.tryClaimUpdate(updateId);
      if (!claimed) {
        // Another process is handling this update
        return reply.status(200).send({ ok: true });
      }

      // Normalize the update for consistent processing
      const event = normalizeUpdate(update);

      // Webhook per-chat rate limit
      if (event.chatId) {
        const chatIdRateKey = `webhook:${event.chatId}`;
        const rateResult = await rateLimitService.isAllowed(
          chatIdRateKey,
          env.RATE_LIMIT_WEBHOOK_WINDOW_MS,
          env.RATE_LIMIT_WEBHOOK_MAX
        );
        if (!rateResult.allowed) {
          request.log.warn({ requestId, chatId: event.chatId }, 'Chat rate limit exceeded, dropping update');
          // Still return 200 to avoid Telegram retries
          await idempotencyService.markFailedRetriable(updateId);
          return reply.status(200).send({ ok: true, rateLimited: true });
        }
      }

      // Add text hash if text is present (for safe logging)
      if (event.text && event.textLength) {
        event.textHash = extractTextHash(event.text);
      }

      const eventMeta = safeEventMetadata(event);

      request.log.info({ requestId, eventMeta }, 'Received Telegram update');

      // Handle based on event type
      switch (event.eventType) {
        case 'MESSAGE':
        case 'EDITED_MESSAGE':
          await handleMessageEvent(bot, actionExecutor, event, request, reply, requestId);
          break;

        case 'MY_CHAT_MEMBER':
        case 'CHAT_MEMBER':
          await handleChatMemberEvent(bot, event, request);
          break;

        case 'CHAT_JOIN_REQUEST':
          await handleJoinRequestEvent(bot, event, request);
          break;

        case 'CALLBACK_QUERY':
          await handleCallbackQueryEvent(bot, event, request);
          break;

        default:
          request.log.debug({ requestId, eventType: event.eventType }, 'Ignoring unknown event type');
      }

      // Enqueue for async processing (Phase 06)
      await enqueueSecurityEvent({
        event: createSecurityEvent(event.eventType, event.chatId || 'unknown', 'low', eventMeta),
      });

      const processingTime = Date.now() - startTime;
      request.log.info({ requestId, processingTime }, 'Webhook processed');

      await idempotencyService.markProcessed(updateId);
      return reply.status(200).send({ ok: true });
    } catch (error) {
      request.log.error({ requestId, error }, 'Webhook processing failed');
      // Return 200 to prevent Telegram retry storms
      await idempotencyService.markFailedRetriable(updateId);
      return reply.status(200).send({ ok: false });
    }
  });
}

async function handleMessageEvent(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest,
  reply: FastifyReply,
  requestId: string
) {
  if (!event.chatId || !event.text) {
    return;
  }

  const chatId = parseInt(event.chatId);

  // Only process group/supergroup chats
  if (event.chatType !== 'group' && event.chatType !== 'supergroup') {
    return;
  }

  // Handle bot commands (skip detection for commands)
  if (event.text.startsWith('/start')) {
    await bot.sendMessage(chatId, '👋 Welcome to TOGI Security Bot!\n\nUse /help to see available commands.');
    return;
  }

  if (event.text.startsWith('/help')) {
    await bot.sendMessage(chatId, `📋 <b>Available Commands</b>\n\n/start - Start the bot\n/help - Show this help\n/setup - Configure TOGI for this group\n/security_status - Check bot permissions\n/check_permissions - Check bot permissions`);
    return;
  }

  if (event.text.startsWith('/setup')) {
    await handleSetupCommand(bot, actionExecutor, chatId, event, request);
    return;
  }

  if (event.text.startsWith('/security_status') || event.text.startsWith('/check_permissions')) {
    await handleSecurityStatusCommand(bot, actionExecutor, chatId, request, requestId);
    return;
  }

  // Manual moderation commands
  if (event.text.startsWith('/warn')) {
    await handleWarnCommand(bot, actionExecutor, event, chatId, request, requestId);
    return;
  }

  if (event.text.startsWith('/mute')) {
    await handleMuteCommand(bot, actionExecutor, event, chatId, request, requestId);
    return;
  }

  if (event.text.startsWith('/ban')) {
    await handleBanCommand(bot, actionExecutor, event, chatId, request, requestId);
    return;
  }

  if (event.text.startsWith('/unban')) {
    await handleUnbanCommand(bot, actionExecutor, event, chatId, request, requestId);
    return;
  }

  if (event.text.startsWith('/lockdown')) {
    await handleLockdownCommand(bot, actionExecutor, chatId, event, request, requestId);
    return;
  }

  if (event.text.startsWith('/unlockdown')) {
    await handleUnlockdownCommand(bot, actionExecutor, chatId, event, request, requestId);
    return;
  }

  // Run fast path detection for non-command messages
  await runDetectionAndTakeAction(bot, actionExecutor, event, chatId, request, requestId);
}

async function runDetectionAndTakeAction(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  try {
    // Get group and policy
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.telegramChatId, chatId))
      .limit(1);

    if (!group) {
      return; // Group not configured
    }

    // Get effective policy
    const [policy] = await db
      .select()
      .from(groupPolicies)
      .where(eq(groupPolicies.groupId, group.id))
      .orderBy()
      .limit(1);

    const policyConfig: PolicyContext = policy?.config as PolicyContext || getDefaultPolicy('BALANCED');
    policyConfig.mode = (policy?.mode as PolicyContext['mode']) || 'BALANCED';

    // Build detection context
    const context: DetectionContext = {
      chatId: event.chatId || 'unknown',
      userId: event.userId,
      username: event.username,
      text: event.text,
      links: event.links || [],
      mediaType: event.mediaType,
      messageId: event.messageId,
      mentions: [],
      isNewUser: false,
      userMemberSince: undefined,
      timestamp: event.timestamp,
    };

    // Run fast path detection
    const result = await runFastPath(context, policyConfig);

    request.log.info(
      { requestId, riskScore: result.detection.riskScore, labels: result.detection.labels },
      'Detection result'
    );

    // Take action based on recommended action
    if (result.detection.recommendedAction !== 'ALLOW' && result.detection.recommendedAction !== 'LOG') {
      await takeAction(actionExecutor, event, result.detection, request);
    }

    // Store violation if action was taken
    if (['DELETE', 'DELETE_WARN', 'DELETE_MUTE', 'DELETE_BAN', 'REVIEW'].includes(result.detection.recommendedAction)) {
      await db.insert(violations).values({
        groupId: group.id,
        telegramUserId: event.userId ? parseInt(event.userId) : null,
        telegramMessageId: event.messageId || null,
        violationType: result.detection.labels.join(','),
        severity: result.detection.severity,
        riskScore: result.detection.riskScore,
        action: result.detection.recommendedAction,
        reason: result.detection.reasons.join('; '),
      });
    }

    // Enqueue for deeper analysis if needed
    if (result.shouldEnqueue) {
      request.log.info({ requestId }, 'Enqueuing for deeper analysis');
      // TODO: Enqueue async analysis job
    }
  } catch (error) {
    request.log.error({ requestId, error }, 'Detection failed');
  }
}

async function takeAction(
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  detection: DetectionResult,
  request: FastifyRequest
) {
  const chatId = parseInt(event.chatId || '0');
  const messageId = event.messageId;
  const userId = event.userId ? parseInt(event.userId) : undefined;

  const input = {
    chatId,
    userId,
    messageId,
    reason: detection.reasons.join('; '),
    riskScore: detection.riskScore,
    severity: detection.severity,
    labels: detection.labels,
    recommendedAction: detection.recommendedAction,
  };

  const result = await actionExecutor.executeDecision(input);

  if (!result.ok) {
    request.log.warn({ requestId: request.id, result }, 'Action execution failed');
  }
}

async function handleSetupCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  chatId: number,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest
) {
  const requestId = request.id;
  const callerUserId = event.userId ? parseInt(event.userId) : undefined;

  if (!callerUserId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify your user. Please start a chat with the bot first.');
    return;
  }

  try {
    // Verify caller is admin (must be 'creator' or 'administrator')
    let callerIsAdmin = false;
    let callerIsCreator = false;
    try {
      const callerMember = await bot.Bot.api.getChatMember(chatId, callerUserId);
      const callerStatus = 'status' in callerMember ? callerMember.status : 'unknown';
      callerIsAdmin = ['creator', 'administrator'].includes(callerStatus);
      callerIsCreator = callerStatus === 'creator';
    } catch (err) {
      request.log.warn({ requestId, err, chatId, callerUserId }, 'Failed to get caller chat member');
    }

    if (!callerIsAdmin) {
      await bot.sendMessage(chatId, '⚠️ Only group admins can configure TOGI.\n\nAsk a group admin to run /setup.');
      return;
    }

    // Get bot user ID and check bot permissions
    const botUserId = await bot.getBotUserId();
    let botIsAdmin = false;
    let botHasRequiredPermissions = true;
    try {
      const botMember = await bot.Bot.api.getChatMember(chatId, botUserId);
      const botStatus = 'status' in botMember ? botMember.status : 'unknown';
      botIsAdmin = ['creator', 'administrator'].includes(botStatus);
      // Check if bot has required permissions (can delete messages and restrict members)
      botHasRequiredPermissions = botIsAdmin; // Basic check - in production would check specific perms
    } catch (err) {
      request.log.warn({ requestId, err, chatId, botUserId }, 'Failed to get bot chat member');
      botIsAdmin = false;
    }

    // Find or create the group
    const [existingGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.telegramChatId, chatId))
      .limit(1);

    let groupId: string;
    let isNewGroup = false;

    if (existingGroup) {
      groupId = existingGroup.id;
    } else {
      const [newGroup] = await db.insert(groups).values({
        telegramChatId: chatId,
        type: 'supergroup',
        status: botIsAdmin ? 'ACTIVE' : 'SETUP_PENDING',
        botAdminStatus: botIsAdmin ? 'ADMIN' : 'UNKNOWN',
      }).returning();
      groupId = newGroup.id;
      isNewGroup = true;
    }

    // Update group status if bot permissions changed
    if (existingGroup && !botIsAdmin && existingGroup.botAdminStatus === 'ADMIN') {
      // Bot was demoted or lost perms
    }

    // Check if policy already exists
    const [existingPolicy] = await db
      .select()
      .from(groupPolicies)
      .where(eq(groupPolicies.groupId, groupId))
      .limit(1);

    if (existingPolicy) {
      await bot.sendMessage(
        chatId,
        '⚙️ TOGI is already configured for this group.\n\nUse /security_status to check the current security status.'
      );
      return;
    }

    // Create default BALANCED policy
    const defaultConfig = getDefaultPolicy('BALANCED');
    await db.insert(groupPolicies).values({
      groupId,
      mode: 'BALANCED',
      config: defaultConfig,
      version: 1,
    });

    // Promote caller to OWNER if:
    // - This is a new group (no OWNER exists yet)
    // - Caller's status is 'creator' (not just 'administrator')
    if (isNewGroup && callerIsCreator) {
      // Check if no OWNER exists yet
      const [existingOwner] = await db
        .select()
        .from(groupAdmins)
        .where(and(
          eq(groupAdmins.groupId, groupId),
          eq(groupAdmins.role, 'OWNER'),
          isNull(groupAdmins.revokedAt)
        ))
        .limit(1);

      if (!existingOwner) {
        // Promote caller to OWNER
        await db.insert(groupAdmins).values({
          groupId,
          telegramUserId: callerUserId,
          role: 'OWNER',
          permissions: ROLE_PERMISSIONS['OWNER'],
          verifiedAt: new Date(),
        });

        await db.insert(auditLogs).values({
          groupId,
          actorTelegramUserId: callerUserId,
          action: 'ADMIN_PROMOTED',
          targetType: 'USER',
          targetId: callerUserId.toString(),
          metadata: { role: 'OWNER', method: 'setup_command_creator' },
        });
      }
    }

    // Log the setup
    await db.insert(auditLogs).values({
      groupId,
      actorTelegramUserId: botUserId,
      action: 'GROUP_SETUP',
      targetType: 'GROUP',
      targetId: groupId,
      metadata: { mode: 'BALANCED', botAdminStatus: botIsAdmin ? 'ADMIN' : 'UNKNOWN' },
    });

    if (!botIsAdmin) {
      await bot.sendMessage(
        chatId,
        '⚠️ TOGI configured, but bot is not an admin yet.\n\n' +
        '📋 Default policy: BALANCED\n\n' +
        '⚠️ Make the bot an admin to enable full protection.\n\n' +
        'Use /security_status to check your security score.'
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      '✅ TOGI configured successfully!\n\n' +
      '📋 Default policy: BALANCED\n\n' +
      'Available modes: RELAXED, BALANCED, STRICT, PARANOID\n' +
      'Use /security_status to check your security score.\n\n' +
      'Check the dashboard to customize policies.'
    );
  } catch (error) {
    request.log.error({ requestId: request.id, error, chatId }, 'Failed to setup group');
    await bot.sendMessage(chatId, '❌ Failed to configure TOGI. Please try again.');
  }
}

async function handleSecurityStatusCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  try {
    // Check bot permissions first
    const permissions = await bot.checkPermissions(chatId);
    const permissionText = bot.formatPermissionReport(permissions);

    // Find the group
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.telegramChatId, chatId))
      .limit(1);

    if (!group) {
      await bot.sendMessage(chatId, '⚠️ This group is not configured yet.\n\nUse /setup to configure TOGI.');
      return;
    }

    // Get security score
    let scoreText = '';
    if (group.botAdminStatus !== 'ADMIN') {
      scoreText = '\n\n⚠️ Bot is not an admin. Security features will not work.';
    }

    // Simple score based on bot admin status
    const score = group.botAdminStatus === 'ADMIN' ? 85 : 30;
    const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';

    await bot.sendMessage(
      chatId,
      `📊 Security Status\n\n${scoreEmoji} Score: ${score}/100\n\n${permissionText}${scoreText}`
    );
  } catch (error) {
    request.log.error({ requestId, error, chatId }, 'Failed to check security status');
    await bot.sendMessage(chatId, '❌ Failed to check security status.');
  }
}

async function handleChatMemberEvent(
  bot: TelegramBot,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest
) {
  if (!event.chatId || !event.userId) {
    return;
  }

  const chatId = parseInt(event.chatId);
  const userId = parseInt(event.userId);

  request.log.info({ requestId: request.id, chatId, userId, eventType: event.eventType }, 'Chat member update');

  // Handle MY_CHAT_MEMBER - when bot is added/removed/updated
  const botUserId = await bot.getBotUserId();
  if (event.eventType === 'MY_CHAT_MEMBER' && event.userId === botUserId.toString()) {
    await handleBotChatMemberUpdate(bot, event, request);
  }
}

async function handleBotChatMemberUpdate(
  bot: TelegramBot,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest
) {
  if (!event.chatId) {
    return;
  }

  const chatId = parseInt(event.chatId);
  const newStatus = event.newChatMember?.status;
  const previousStatus = event.oldChatMember?.status;

  request.log.info(
    { requestId: request.id, chatId, newStatus, previousStatus },
    'Bot chat member update'
  );

  try {
    // Check current permissions
    const permissions = await bot.checkPermissions(chatId);
    let botAdminStatus: 'ADMIN' | 'NOT_ADMIN' | 'UNKNOWN' | 'MISSING_PERMISSIONS' = 'UNKNOWN';

    if (permissions.isAdmin) {
      botAdminStatus = 'ADMIN';
    } else if (newStatus === 'left' || newStatus === 'kicked') {
      botAdminStatus = 'NOT_ADMIN';
    } else {
      botAdminStatus = permissions.status === 'ADMIN' ? 'ADMIN' : 'NOT_ADMIN';
    }

    // Upsert the group
    const [existingGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.telegramChatId, chatId))
      .limit(1);

    if (existingGroup) {
      await db
        .update(groups)
        .set({
          status: newStatus === 'left' || newStatus === 'kicked' ? 'LEFT' : 'ACTIVE',
          botAdminStatus,
          updatedAt: new Date(),
        })
        .where(eq(groups.id, existingGroup.id));
    } else {
      await db.insert(groups).values({
        telegramChatId: chatId,
        type: event.chatType || 'supergroup',
        status: 'ACTIVE',
        botAdminStatus,
      });
    }
  } catch (error) {
    request.log.error({ requestId: request.id, error, chatId }, 'Failed to upsert group');
  }
}

async function handleJoinRequestEvent(
  bot: TelegramBot,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest
) {
  if (!event.chatId) {
    return;
  }

  const chatId = parseInt(event.chatId);

  request.log.info({ requestId: request.id, chatId, eventType: event.eventType }, 'Join request');
}

async function handleCallbackQueryEvent(
  bot: TelegramBot,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest
) {
  request.log.info({ requestId: request.id, eventType: event.eventType }, 'Callback query');
}

// Manual moderation command handlers

// Check if user is admin in the group
async function isUserAdmin(bot: TelegramBot, chatId: number, userId: number): Promise<boolean> {
  try {
    const chatMember = await bot.Bot.api.getChatMember(chatId, userId);
    const status = 'status' in chatMember ? chatMember.status : 'unknown';
    return ['creator', 'administrator'].includes(status);
  } catch {
    return false;
  }
}

// Admin verification wrapper
async function verifyAdminAndRateLimit(
  bot: TelegramBot,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string,
  command: string
): Promise<{ allowed: boolean; error?: string }> {
  const userId = event.userId ? parseInt(event.userId) : undefined;

  if (!userId) {
    return { allowed: false, error: 'Could not identify user' };
  }

  // Check if user is admin
  const isAdmin = await isUserAdmin(bot, chatId, userId);
  if (!isAdmin) {
    return { allowed: false, error: 'Only group admins can use this command' };
  }

  // Check user command rate limit
  const userAllowed = await checkUserCommandRateLimit(userId, command);
  if (!userAllowed) {
    return { allowed: false, error: 'Rate limited. Try again later.' };
  }

  return { allowed: true };
}

// Prevent action loops - check if same action was taken recently
async function checkActionLoop(
  chatId: number,
  userId: number,
  action: string,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `action_loop:${chatId}:${userId}:${action}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

async function recordAction(chatId: number, userId: number, action: string, windowSeconds: number = 60): Promise<void> {
  const key = `action_loop:${chatId}:${userId}:${action}`;
  await redis.setex(key, windowSeconds, '1');
}

async function handleWarnCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  // Verify admin and rate limit
  const userId = event.userId ? parseInt(event.userId) : undefined;
  if (!userId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const verification = await verifyAdminAndRateLimit(bot, event, chatId, request, requestId, 'warn');
  if (!verification.allowed) {
    await bot.sendMessage(chatId, `⚠️ ${verification.error}`);
    return;
  }

  // Check action loop
  const targetUserId = event.userId; // Placeholder - would need API lookup
  if (targetUserId && await checkActionLoop(chatId, parseInt(targetUserId), 'warn')) {
    await bot.sendMessage(chatId, '⚠️ Warning already issued recently for this user.');
    return;
  }

  // Parse mention from text like "/warn @username reason" or "/warn 123456 reason"
  const mentionMatch = event.text?.match(/^\/warn(?:\s+@?(\S+))?/i);
  const targetUsername = mentionMatch?.[1];
  const reason = event.text?.replace(/^\/warn(?:\s+@?\S+)?\s*/i, '').trim() || 'Manual warning';

  if (!targetUsername) {
    await bot.sendMessage(chatId, '⚠️ Usage: /warn @username [reason]\nOr reply to a user\'s message with /warn [reason]');
    return;
  }

  // TODO: Look up user by username - for now use userId from event if same user
  // In production, would need to resolve username to userId via Telegram API
  const targetId = targetUserId; // Placeholder

  if (!targetId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const result = await actionExecutor.warnUser({
    chatId,
    userId: parseInt(targetId),
    reason,
  });

  if (result.ok) {
    await recordAction(chatId, parseInt(targetId), 'warn');
    await bot.sendMessage(chatId, `✅ User has been warned.\nReason: ${reason}`);
  } else {
    await bot.sendMessage(chatId, `❌ Warning failed: ${result.errorMessage}`);
  }
}

async function handleMuteCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  // Verify admin and rate limit
  const userId = event.userId ? parseInt(event.userId) : undefined;
  if (!userId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const verification = await verifyAdminAndRateLimit(bot, event, chatId, request, requestId, 'mute');
  if (!verification.allowed) {
    await bot.sendMessage(chatId, `⚠️ ${verification.error}`);
    return;
  }

  // Parse mention and duration from text
  const mentionMatch = event.text?.match(/^\/mute(?:\s+@?(\S+))?(?:\s+(\d+)\s*([mhd]))?/i);
  const targetUsername = mentionMatch?.[1];
  const durationValue = mentionMatch?.[2];
  const durationUnit = mentionMatch?.[3];

  if (!targetUsername) {
    await bot.sendMessage(chatId, '⚠️ Usage: /mute @username [duration] [reason]\nExample: /mute @user 30m spam');
    return;
  }

  let untilDate: Date | undefined;
  if (durationValue && durationUnit) {
    const value = parseInt(durationValue);
    const ms = durationUnit.toLowerCase() === 'm' ? 60000 : durationUnit.toLowerCase() === 'h' ? 3600000 : 86400000;
    untilDate = new Date(Date.now() + value * ms);
  } else {
    untilDate = new Date(Date.now() + 30 * 60000);
  }

  const reason = event.text?.replace(/^\/mute(?:\s+@?\S+)?(?:\s+\d+\s*\S+)?\s*/i, '').trim() || 'Manual mute';
  const targetId = event.userId; // Placeholder

  if (!targetId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const result = await actionExecutor.restrictUser({
    chatId,
    userId: parseInt(targetId),
    untilDate,
    reason,
  });

  if (result.ok) {
    await recordAction(chatId, parseInt(targetId), 'mute');
    await bot.sendMessage(chatId, `🔇 User has been muted.`);
  } else {
    await bot.sendMessage(chatId, `❌ Mute failed: ${result.errorMessage}`);
  }
}

async function handleBanCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  // Verify admin and rate limit
  const userId = event.userId ? parseInt(event.userId) : undefined;
  if (!userId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const verification = await verifyAdminAndRateLimit(bot, event, chatId, request, requestId, 'ban');
  if (!verification.allowed) {
    await bot.sendMessage(chatId, `⚠️ ${verification.error}`);
    return;
  }

  const mentionMatch = event.text?.match(/^\/ban(?:\s+@?(\S+))?/i);
  const targetUsername = mentionMatch?.[1];
  const reason = event.text?.replace(/^\/ban(?:\s+@?\S+)?\s*/i, '').trim() || 'Manual ban';

  if (!targetUsername) {
    await bot.sendMessage(chatId, '⚠️ Usage: /ban @username [reason]');
    return;
  }

  const targetId = event.userId; // Placeholder

  if (!targetId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const result = await actionExecutor.banUser({
    chatId,
    userId: parseInt(targetId),
    reason,
  });

  if (result.ok) {
    await recordAction(chatId, parseInt(targetId), 'ban');
    await bot.sendMessage(chatId, `🔨 User has been banned.`);
  } else {
    await bot.sendMessage(chatId, `❌ Ban failed: ${result.errorMessage}`);
  }
}

async function handleUnbanCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  event: ReturnType<typeof normalizeUpdate>,
  chatId: number,
  request: FastifyRequest,
  requestId: string
) {
  const mentionMatch = event.text?.match(/^\/unban(?:\s+@?(\S+))?/i);
  const targetUsername = mentionMatch?.[1];

  if (!targetUsername) {
    await bot.sendMessage(chatId, '⚠️ Usage: /unban @username');
    return;
  }

  const targetUserId = event.userId; // Placeholder

  if (!targetUserId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  try {
    await bot.Bot.api.unbanChatMember(chatId, parseInt(targetUserId), { only_if_banned: true });
    await bot.sendMessage(chatId, `✅ User has been unbanned.`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Unban failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleLockdownCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  chatId: number,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest,
  requestId: string
) {
  // Verify admin and rate limit
  const userId = event.userId ? parseInt(event.userId) : undefined;
  if (!userId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const verification = await verifyAdminAndRateLimit(bot, event, chatId, request, requestId, 'lockdown');
  if (!verification.allowed) {
    await bot.sendMessage(chatId, `⚠️ ${verification.error}`);
    return;
  }

  const result = await actionExecutor.setLockdown({ chatId });

  if (result.ok) {
    // Log lockdown action
    await db.insert(auditLogs).values({
      groupId: chatId.toString(),
      actorTelegramUserId: userId,
      action: 'LOCKDOWN',
      targetType: 'GROUP',
      targetId: chatId.toString(),
      metadata: { source: 'manual' },
    });
    await bot.sendMessage(chatId, '🔒 Group is now in lockdown mode. Only admins can send messages.');
  } else {
    await bot.sendMessage(chatId, `❌ Lockdown failed: ${result.errorMessage}`);
  }
}

async function handleUnlockdownCommand(
  bot: TelegramBot,
  actionExecutor: TelegramActionExecutor,
  chatId: number,
  event: ReturnType<typeof normalizeUpdate>,
  request: FastifyRequest,
  requestId: string
) {
  // Verify admin and rate limit
  const userId = event.userId ? parseInt(event.userId) : undefined;
  if (!userId) {
    await bot.sendMessage(chatId, '⚠️ Could not identify target user.');
    return;
  }

  const verification = await verifyAdminAndRateLimit(bot, event, chatId, request, requestId, 'unlockdown');
  if (!verification.allowed) {
    await bot.sendMessage(chatId, `⚠️ ${verification.error}`);
    return;
  }

  const result = await actionExecutor.unsetLockdown({ chatId });

  if (result.ok) {
    // Log unlockdown action
    await db.insert(auditLogs).values({
      groupId: chatId.toString(),
      actorTelegramUserId: userId,
      action: 'UNLOCKDOWN',
      targetType: 'GROUP',
      targetId: chatId.toString(),
      metadata: { source: 'manual' },
    });
    await bot.sendMessage(chatId, '🔓 Group lockdown has been lifted.');
  } else {
    await bot.sendMessage(chatId, `❌ Unlock failed: ${result.errorMessage}`);
  }
}
