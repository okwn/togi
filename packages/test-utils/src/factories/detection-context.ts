import type { DetectionContext } from '@togi/detection-engine';

export function createDetectionContext(
  overrides: Partial<DetectionContext> = {}
): DetectionContext {
  const now = Date.now();
  const context: DetectionContext = {
    chatId: '-1001234567890',
    userId: '123456789',
    username: 'testuser',
    text: 'Hello world',
    links: [],
    mediaType: undefined,
    messageId: 1,
    mentions: [],
    isNewUser: false,
    userMemberSince: undefined,
    timestamp: now,
    ...overrides,
  };

  // Validate inputs
  if (typeof context.chatId !== 'string' || context.chatId.length === 0) {
    throw new Error(`chatId must be a non-empty string, got: ${context.chatId}`);
  }

  if (typeof context.messageId !== 'number' || context.messageId <= 0) {
    throw new Error(`messageId must be a positive number, got: ${context.messageId}`);
  }

  return context;
}