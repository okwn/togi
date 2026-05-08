import * as crypto from 'crypto';
import {
  NormalizedTelegramEvent,
  RawTelegramUpdate,
  RawTelegramMessage,
  RawTelegramChatMemberUpdate,
  RawTelegramJoinRequest,
  RawTelegramCallbackQuery,
  ChatType,
  EventType,
  MediaType,
} from './types';

const MEDIA_TYPES: Record<string, MediaType> = {
  photo: 'photo',
  video: 'video',
  document: 'document',
  sticker: 'sticker',
  animation: 'animation',
  voice: 'voice',
  audio: 'audio',
};

export function detectMediaType(message: RawTelegramMessage): MediaType {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.sticker) return 'sticker';
  if (message.animation) return 'animation';
  if (message.voice) return 'voice';
  if (message.audio) return 'audio';
  return 'unknown';
}

export function extractLinks(
  message: RawTelegramMessage
): string[] {
  const links: string[] = [];

  if (message.entities) {
    for (const entity of message.entities) {
      if (entity.type === 'text_link' && entity.url) {
        links.push(entity.url);
      }
      if (entity.type === 'url') {
        const text = message.text?.slice(entity.offset, entity.offset + entity.length);
        if (text) links.push(text);
      }
    }
  }

  // Also extract URLs from text directly
  if (message.text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const matches = message.text.match(urlRegex);
    if (matches) {
      for (const match of matches) {
        if (!links.includes(match)) {
          links.push(match);
        }
      }
    }
  }

  return links;
}

export function detectEventType(
  update: RawTelegramUpdate
): EventType {
  if (update.message) return 'MESSAGE';
  if (update.edited_message) return 'EDITED_MESSAGE';
  if (update.my_chat_member) return 'MY_CHAT_MEMBER';
  if (update.chat_member) return 'CHAT_MEMBER';
  if (update.chat_join_request) return 'CHAT_JOIN_REQUEST';
  if (update.callback_query) return 'CALLBACK_QUERY';
  return 'UNKNOWN';
}

export function extractChatInfo(message: RawTelegramMessage) {
  return {
    chatId: message.chat.id.toString(),
    chatType: message.chat.type as ChatType,
    chatTitle: message.chat.title,
  };
}

export function extractUserInfo(message: RawTelegramMessage) {
  if (!message.from) return { userId: undefined, username: undefined, firstName: undefined };

  return {
    userId: message.from.id.toString(),
    username: message.from.username,
    firstName: message.from.first_name,
  };
}

export function normalizeMessage(
  message: RawTelegramMessage,
  updateId: string
): NormalizedTelegramEvent {
  const links = extractLinks(message);
  const mediaType = detectMediaType(message);

  return {
    updateId: updateId.toString(),
    eventType: 'MESSAGE',
    chatId: message.chat.id.toString(),
    chatType: message.chat.type as ChatType,
    chatTitle: message.chat.title,
    userId: message.from?.id.toString(),
    username: message.from?.username,
    firstName: message.from?.first_name,
    messageId: message.message_id,
    text: message.text,
    textLength: message.text?.length,
    links,
    mediaType,
    timestamp: message.date * 1000,
  };
}

export function normalizeEditedMessage(
  message: RawTelegramMessage,
  updateId: string
): NormalizedTelegramEvent {
  const event = normalizeMessage(message, updateId);
  event.eventType = 'EDITED_MESSAGE';
  return event;
}

export function normalizeMyChatMember(
  update: RawTelegramChatMemberUpdate,
  updateId: string
): NormalizedTelegramEvent {
  return {
    updateId: updateId.toString(),
    eventType: 'MY_CHAT_MEMBER',
    chatId: update.chat.id.toString(),
    chatType: update.chat.type as ChatType,
    chatTitle: update.chat.title,
    userId: update.from.id.toString(),
    username: update.from.username,
    firstName: update.from.first_name,
    timestamp: update.date * 1000,
    links: [],
    oldChatMember: update.old_chat_member ? {
      userId: update.old_chat_member.user.id.toString(),
      status: update.old_chat_member.status,
    } : undefined,
    newChatMember: update.new_chat_member ? {
      userId: update.new_chat_member.user.id.toString(),
      status: update.new_chat_member.status,
    } : undefined,
  };
}

export function normalizeChatMember(
  update: RawTelegramChatMemberUpdate,
  updateId: string
): NormalizedTelegramEvent {
  return {
    updateId: updateId.toString(),
    eventType: 'CHAT_MEMBER',
    chatId: update.chat.id.toString(),
    chatType: update.chat.type as ChatType,
    chatTitle: update.chat.title,
    userId: update.from.id.toString(),
    username: update.from.username,
    firstName: update.from.first_name,
    timestamp: update.date * 1000,
    links: [],
  };
}

export function normalizeChatJoinRequest(
  request: RawTelegramJoinRequest,
  updateId: string
): NormalizedTelegramEvent {
  return {
    updateId: updateId.toString(),
    eventType: 'CHAT_JOIN_REQUEST',
    chatId: request.chat.id.toString(),
    chatType: request.chat.type as ChatType,
    chatTitle: request.chat.title,
    userId: request.from.id.toString(),
    username: request.from.username,
    firstName: request.from.first_name,
    timestamp: request.date * 1000,
    links: [],
  };
}

export function normalizeCallbackQuery(
  query: RawTelegramCallbackQuery,
  updateId: string
): NormalizedTelegramEvent {
  return {
    updateId: updateId.toString(),
    eventType: 'CALLBACK_QUERY',
    userId: query.from.id.toString(),
    username: query.from.username,
    firstName: query.from.first_name,
    timestamp: Date.now(),
    links: [],
  };
}

export function normalizeUpdate(update: RawTelegramUpdate): NormalizedTelegramEvent {
  const updateId = update.update_id.toString();
  const eventType = detectEventType(update);

  switch (eventType) {
    case 'MESSAGE':
      return normalizeMessage(update.message!, updateId);
    case 'EDITED_MESSAGE':
      return normalizeEditedMessage(update.edited_message!, updateId);
    case 'MY_CHAT_MEMBER':
      return normalizeMyChatMember(update.my_chat_member!, updateId);
    case 'CHAT_MEMBER':
      return normalizeChatMember(update.chat_member!, updateId);
    case 'CHAT_JOIN_REQUEST':
      return normalizeChatJoinRequest(update.chat_join_request!, updateId);
    case 'CALLBACK_QUERY':
      return normalizeCallbackQuery(update.callback_query!, updateId);
    default:
      return {
        updateId,
        eventType: 'UNKNOWN',
        timestamp: Date.now(),
        links: [],
      };
  }
}
