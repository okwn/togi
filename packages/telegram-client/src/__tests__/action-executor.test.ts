// TelegramActionExecutor Tests

// Mock modules before imports
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockActionLock = jest.fn((chatId: string | number, messageId: string | number, action: string) =>
  `action_lock:${chatId}:${messageId}:${action}`
);

jest.mock('@togi/db', () => ({
  keys: {
    actionLock: mockActionLock,
  },
  redis: {
    set: mockSet,
    del: mockDel,
  },
}));

jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    api: {
      deleteMessage: jest.fn(),
      sendMessage: jest.fn(),
      restrictChatMember: jest.fn(),
      banChatMember: jest.fn(),
      unbanChatMember: jest.fn(),
      setChatPermissions: jest.fn(),
      getChatMember: jest.fn(),
    },
  })),
}));

// Import after mocks
import { TelegramActionExecutor } from '../action-executor';

describe('TelegramActionExecutor', () => {
  let executor: TelegramActionExecutor;
  let mockBot: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Bot } = require('grammy');
    mockBot = new Bot('test-token');
    executor = new TelegramActionExecutor(mockBot);

    // Default: lock acquisition succeeds
    mockSet.mockResolvedValue('OK');
    mockDel.mockResolvedValue(1);
  });

  describe('deleteMessage', () => {
    it('should delete message successfully', async () => {
      mockBot.api.deleteMessage.mockResolvedValue(true);

      const result = await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('DELETE');
      expect(result.telegramMethod).toBe('deleteMessage');
      expect(mockBot.api.deleteMessage).toHaveBeenCalledWith(123456, 789);
    });

    it('should be idempotent when lock already exists', async () => {
      mockSet.mockResolvedValue(null); // Lock exists

      const result = await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.errorMessage).toBe('Already attempted');
      expect(mockBot.api.deleteMessage).not.toHaveBeenCalled();
    });

    it('should handle message not found gracefully', async () => {
      const error = new Error('message to delete not found');
      (error as any).error_code = 400;
      mockBot.api.deleteMessage.mockRejectedValue(error);

      const result = await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.errorMessage).toBe('Message already deleted');
    });

    it('should handle missing permissions', async () => {
      const error = new Error('chat not have rights to delete messages');
      (error as any).error_code = 400;
      mockBot.api.deleteMessage.mockRejectedValue(error);

      const result = await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('Missing delete permission');
      expect(result.retriable).toBe(false);
    });

    it('should retry on rate limit error', async () => {
      const error = new Error('Too Many Requests');
      (error as any).error_code = 429;
      mockBot.api.deleteMessage.mockRejectedValue(error);

      const result = await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(result.ok).toBe(false);
      expect(result.retriable).toBe(true);
    });
  });

  describe('warnUser', () => {
    it('should warn user successfully', async () => {
      mockBot.api.sendMessage.mockResolvedValue(true);

      const result = await executor.warnUser({
        chatId: 123456,
        userId: 111,
        reason: 'violation',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('WARN');
      expect(mockBot.api.sendMessage).toHaveBeenCalled();
    });

    it('should not warn admins', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'administrator' });

      const result = await executor.warnUser({
        chatId: 123456,
        userId: 111,
        reason: 'violation',
      });

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('Cannot warn group admin');
    });

    it('should require userId', async () => {
      const result = await executor.warnUser({
        chatId: 123456,
        userId: 0,
        reason: 'violation',
      } as any);

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('userId is required');
    });
  });

  describe('restrictUser', () => {
    it('should restrict user successfully', async () => {
      mockBot.api.restrictChatMember.mockResolvedValue(true);

      const result = await executor.restrictUser({
        chatId: 123456,
        userId: 111,
        untilDate: new Date(Date.now() + 3600000),
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('RESTRICT');
    });

    it('should not restrict admins', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'creator' });

      const result = await executor.restrictUser({
        chatId: 123456,
        userId: 111,
        reason: 'spam',
      });

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('Cannot restrict group admin');
    });
  });

  describe('banUser', () => {
    it('should ban user successfully', async () => {
      mockBot.api.banChatMember.mockResolvedValue(true);

      const result = await executor.banUser({
        chatId: 123456,
        userId: 111,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('BAN');
      expect(mockBot.api.banChatMember).toHaveBeenCalledWith(123456, 111);
    });

    it('should not ban admins', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'administrator' });

      const result = await executor.banUser({
        chatId: 123456,
        userId: 111,
        reason: 'spam',
      });

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('Cannot ban group admin');
    });
  });

  describe('kickUser', () => {
    it('should kick user (ban + unban)', async () => {
      mockBot.api.banChatMember.mockResolvedValue(true);
      mockBot.api.unbanChatMember.mockResolvedValue(true);

      const result = await executor.kickUser({
        chatId: 123456,
        userId: 111,
        reason: 'warning',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('KICK');
      expect(mockBot.api.banChatMember).toHaveBeenCalledWith(123456, 111);
      expect(mockBot.api.unbanChatMember).toHaveBeenCalledWith(123456, 111, { only_if_banned: true });
    });
  });

  describe('setLockdown', () => {
    it('should set lockdown successfully', async () => {
      mockBot.api.setChatPermissions.mockResolvedValue(true);

      const result = await executor.setLockdown({ chatId: 123456 });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('LOCKDOWN');
      expect(mockBot.api.setChatPermissions).toHaveBeenCalled();
    });

    it('should be idempotent when already in lockdown', async () => {
      mockSet.mockResolvedValue(null);

      const result = await executor.setLockdown({ chatId: 123456 });

      expect(result.ok).toBe(true);
      expect(result.errorMessage).toBe('Already in lockdown');
      expect(mockBot.api.setChatPermissions).not.toHaveBeenCalled();
    });
  });

  describe('unsetLockdown', () => {
    it('should restore all permissions', async () => {
      mockBot.api.setChatPermissions.mockResolvedValue(true);

      const result = await executor.unsetLockdown({ chatId: 123456 });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('UNLOCK');
      expect(mockBot.api.setChatPermissions).toHaveBeenCalled();
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for creator', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'creator' });

      const result = await executor.isUserAdmin(123456, 111);

      expect(result).toBe(true);
    });

    it('should return true for administrator', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'administrator' });

      const result = await executor.isUserAdmin(123456, 111);

      expect(result).toBe(true);
    });

    it('should return false for member', async () => {
      mockBot.api.getChatMember.mockResolvedValue({ status: 'member' });

      const result = await executor.isUserAdmin(123456, 111);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockBot.api.getChatMember.mockRejectedValue(new Error('API error'));

      const result = await executor.isUserAdmin(123456, 111);

      expect(result).toBe(false);
    });
  });

  describe('executeDecision', () => {
    it('should execute DELETE decision', async () => {
      mockBot.api.deleteMessage.mockResolvedValue(true);

      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        messageId: 789,
        recommendedAction: 'DELETE',
        riskScore: 65,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('DELETE');
    });

    it('should execute DELETE_WARN decision', async () => {
      mockBot.api.deleteMessage.mockResolvedValue(true);
      mockBot.api.sendMessage.mockResolvedValue(true);

      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        messageId: 789,
        recommendedAction: 'DELETE_WARN',
        riskScore: 75,
        reason: 'spam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('DELETE_WARN');
    });

    it('should execute DELETE_BAN decision', async () => {
      mockBot.api.deleteMessage.mockResolvedValue(true);
      mockBot.api.banChatMember.mockResolvedValue(true);

      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        messageId: 789,
        recommendedAction: 'DELETE_BAN',
        riskScore: 95,
        reason: 'scam',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('DELETE_BAN');
    });

    it('should execute ALLOW as no-op', async () => {
      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        recommendedAction: 'ALLOW',
        riskScore: 10,
        reason: 'ok',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ALLOW');
    });

    it('should execute REVIEW as admin alert', async () => {
      mockBot.api.sendMessage.mockResolvedValue(true);

      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        recommendedAction: 'REVIEW',
        riskScore: 55,
        reason: 'needs review',
      });

      expect(result.ok).toBe(true);
      expect(result.action).toBe('ALERT');
    });

    it('should require messageId for DELETE action', async () => {
      const result = await executor.executeDecision({
        chatId: 123456,
        userId: 111,
        recommendedAction: 'DELETE',
        riskScore: 65,
        reason: 'spam',
      });

      expect(result.ok).toBe(false);
      expect(result.errorMessage).toBe('messageId required');
    });
  });

  describe('action lock release', () => {
    it('should release lock in finally block even on error', async () => {
      mockBot.api.deleteMessage.mockRejectedValue(new Error('API error'));

      await executor.deleteMessage({
        chatId: 123456,
        messageId: 789,
        reason: 'spam',
      });

      expect(mockDel).toHaveBeenCalled();
    });

    it('should use no-msg when messageId is undefined', async () => {
      mockBot.api.sendMessage.mockResolvedValue(true);
      mockActionLock.mockReturnValue('action_lock:123:no-msg:WARN');

      await executor.warnUser({
        chatId: 123,
        userId: 456,
        reason: 'test',
      });

      expect(mockActionLock).toHaveBeenCalledWith(123, 'no-msg', 'WARN');
    });
  });
});