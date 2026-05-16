import type { DetectionContext } from '@togi/detection-engine';

export function createDetectionContext(
  overrides: Partial<DetectionContext> = {}
): DetectionContext {
  const now = Date.now();
  return {
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
}