export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export type MediaType =
  | 'photo'
  | 'video'
  | 'document'
  | 'sticker'
  | 'animation'
  | 'voice'
  | 'audio'
  | 'unknown';

export type EventType =
  | 'MESSAGE'
  | 'EDITED_MESSAGE'
  | 'MY_CHAT_MEMBER'
  | 'CHAT_MEMBER'
  | 'CHAT_JOIN_REQUEST'
  | 'CALLBACK_QUERY'
  | 'UNKNOWN';

export interface NormalizedTelegramEvent {
  updateId: string;
  eventType: EventType;
  chatId?: string;
  chatType?: ChatType;
  chatTitle?: string;
  userId?: string;
  username?: string;
  firstName?: string;
  messageId?: number;
  text?: string;
  textLength?: number;
  textHash?: string;
  links: string[];
  mediaType?: MediaType;
  timestamp: number;
  oldChatMember?: {
    userId: string;
    status: string;
  };
  newChatMember?: {
    userId: string;
    status: string;
  };
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  language?: string;
}

export interface RawTelegramUpdate {
  update_id: number;
  message?: RawTelegramMessage;
  edited_message?: RawTelegramMessage;
  my_chat_member?: RawTelegramChatMemberUpdate;
  chat_member?: RawTelegramChatMemberUpdate;
  chat_join_request?: RawTelegramJoinRequest;
  callback_query?: RawTelegramCallbackQuery;
}

export interface RawTelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
  photo?: unknown[];
  video?: unknown;
  document?: unknown;
  sticker?: unknown;
  animation?: unknown;
  voice?: unknown;
  audio?: unknown;
}

export interface RawTelegramChatMemberUpdate {
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  old_chat_member?: {
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    status: string;
  };
  new_chat_member?: {
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    status: string;
  };
}

export interface RawTelegramJoinRequest {
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  user_chat_id: number;
  invite_link?: string;
}

export interface RawTelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat_instance: string;
  data?: string;
}
