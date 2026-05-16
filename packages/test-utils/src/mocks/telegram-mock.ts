export type MockFunction<T = any> = (...args: any[]) => Promise<T>;

export interface TelegramMockOptions {
  shouldFail?: boolean;
  failWith?: { ok: false; error_code: number; description: string };
}

export interface MockTelegramApi {
  deleteMessage: MockFunction<any>;
  restrictChatMember: MockFunction<any>;
  banChatMember: MockFunction<any>;
  unbanChatMember: MockFunction<any>;
  sendMessage: MockFunction<any>;
  getChat: MockFunction<any>;
  getChatMember: MockFunction<any>;
}

function createMockFn<T>(shouldFail: boolean, failWith: TelegramMockOptions['failWith'], successValue: T): MockFunction<T> {
  return async () => {
    if (shouldFail && failWith) {
      return failWith as any;
    }
    return { ok: true, result: successValue };
  };
}

export function createTelegramMock(options: TelegramMockOptions = {}): MockTelegramApi {
  const { shouldFail = false, failWith = { ok: false, error_code: 429, description: 'Too Many Requests' } } = options;

  return {
    deleteMessage: createMockFn(shouldFail, failWith, true),
    restrictChatMember: createMockFn(shouldFail, failWith, true),
    banChatMember: createMockFn(shouldFail, failWith, true),
    unbanChatMember: createMockFn(shouldFail, failWith, true),
    sendMessage: createMockFn(shouldFail, failWith, { message_id: 1 }),
    getChat: async () => ({ id: -1001234567890, type: 'supergroup' }),
    getChatMember: async () => ({ status: 'member', user: { id: 123456789 } }),
  };
}