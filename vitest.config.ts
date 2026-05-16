import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 70,
        lines: 60,
      },
      include: [
        'packages/detection-engine/src/**/*.ts',
        'packages/policy-engine/src/**/*.ts',
        'packages/telegram-client/src/action-executor.ts',
        'apps/worker/src/processors/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/types.ts',
      ],
    },
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
    ],
  },
});