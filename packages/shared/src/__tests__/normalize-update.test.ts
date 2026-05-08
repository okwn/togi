import { normalizeUpdate } from '../telegram/normalize-update';

describe('normalize-update', () => {
  describe('normalizeMessage', () => {
    it('should normalize a basic message', () => {
      const rawUpdate = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: { id: 111, is_bot: false, first_name: 'John', username: 'johndoe' },
          chat: { id: -1001234567890, type: 'supergroup', title: 'Test Group' },
          date: 1699999999,
          text: 'Hello world',
        },
      };

      const result = normalizeUpdate(rawUpdate);

      expect(result.updateId).toBe('123456789');
      expect(result.eventType).toBe('MESSAGE');
      expect(result.chatId).toBe('-1001234567890');
      expect(result.chatType).toBe('supergroup');
      expect(result.text).toBe('Hello world');
      expect(result.textLength).toBe(11);
      expect(result.links).toEqual([]);
    });

    it('should extract URLs from message text', () => {
      const rawUpdate = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: { id: 111, is_bot: false, first_name: 'John' },
          chat: { id: -1001234567890, type: 'supergroup' },
          date: 1699999999,
          text: 'Check https://example.com',
        },
      };

      const result = normalizeUpdate(rawUpdate);
      expect(result.links).toContain('https://example.com');
    });

    it('should detect photo media type', () => {
      const rawUpdate = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: { id: 111, is_bot: false, first_name: 'John' },
          chat: { id: -1001234567890, type: 'supergroup' },
          date: 1699999999,
          photo: ['photo1'],
        },
      };

      const result = normalizeUpdate(rawUpdate);
      expect(result.mediaType).toBe('photo');
    });
  });

  describe('normalizeChatJoinRequest', () => {
    it('should normalize a join request', () => {
      const rawUpdate = {
        update_id: 123456789,
        chat_join_request: {
          chat: { id: -1001234567890, type: 'supergroup', title: 'Test Group' },
          from: { id: 222, is_bot: false, first_name: 'Jane', username: 'janedoe' },
          date: 1699999999,
          user_chat_id: 222,
        },
      };

      const result = normalizeUpdate(rawUpdate);
      expect(result.eventType).toBe('CHAT_JOIN_REQUEST');
      expect(result.userId).toBe('222');
    });
  });

  describe('detectEventType', () => {
    it('should detect MESSAGE', () => {
      const update = { update_id: 1, message: { message_id: 1, chat: { id: 1, type: 'private' }, date: 1, text: 'hi' } };
      expect(normalizeUpdate(update).eventType).toBe('MESSAGE');
    });

    it('should detect EDITED_MESSAGE', () => {
      const update = { update_id: 1, edited_message: { message_id: 1, chat: { id: 1, type: 'private' }, date: 1, text: 'hi' } };
      expect(normalizeUpdate(update).eventType).toBe('EDITED_MESSAGE');
    });

    it('should detect MY_CHAT_MEMBER', () => {
      const update = { update_id: 1, my_chat_member: { chat: { id: 1, type: 'private' }, from: { id: 1, is_bot: false, first_name: 'A' }, date: 1 } };
      expect(normalizeUpdate(update).eventType).toBe('MY_CHAT_MEMBER');
    });

    it('should detect CALLBACK_QUERY', () => {
      const update = { update_id: 1, callback_query: { id: '1', from: { id: 1, is_bot: false, first_name: 'A' }, chat_instance: '1' } };
      expect(normalizeUpdate(update).eventType).toBe('CALLBACK_QUERY');
    });
  });
});
