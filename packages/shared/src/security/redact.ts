import { NormalizedTelegramEvent } from '../telegram/types';

const TELEGRAM_TOKEN_MASK = '[TELEGRAM_TOKEN]';
const BOT_TOKEN_REGEX = /\d{8,10}:[A-Za-z0-9_-]{35}/g;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export interface RedactionOptions {
  removeLinks?: boolean;
  removeUsernames?: boolean;
  hashText?: boolean;
}

export function redactBotToken(text: string): string {
  return text.replace(BOT_TOKEN_REGEX, TELEGRAM_TOKEN_MASK);
}

export function redactUrls(text: string): string {
  return text.replace(URL_REGEX, '[URL]');
}

export function redactEvent(
  event: NormalizedTelegramEvent,
  options: RedactionOptions = {}
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {
    updateId: event.updateId,
    eventType: event.eventType,
    chatId: event.chatId,
    chatType: event.chatType,
    chatTitle: event.chatTitle,
    userId: event.userId,
    username: event.username ? `[USER:${event.username}]` : undefined,
    firstName: event.firstName,
    messageId: event.messageId,
    textHash: event.textHash,
    textLength: event.textLength,
    links: options.removeLinks ? '[REDACTED]' : event.links.map(l => '[URL]'),
    mediaType: event.mediaType,
    timestamp: event.timestamp,
  };

  return redacted;
}

export function safeEventMetadata(event: NormalizedTelegramEvent): {
  updateId: string;
  eventType: string;
  chatId?: string;
  chatType?: string;
  userId?: string;
  username?: string;
  firstName?: string;
  messageId?: number;
  textHash?: string;
  textLength?: number;
  linkCount: number;
  mediaType?: string;
  timestamp: number;
} {
  return {
    updateId: event.updateId,
    eventType: event.eventType,
    chatId: event.chatId,
    chatType: event.chatType,
    userId: event.userId,
    username: event.username,
    firstName: event.firstName,
    messageId: event.messageId,
    textHash: event.textHash,
    textLength: event.textLength,
    linkCount: event.links.length,
    mediaType: event.mediaType,
    timestamp: event.timestamp,
  };
}
