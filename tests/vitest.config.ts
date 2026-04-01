import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.integration.ts', '**/*.e2e.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['../packages/*/src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/index.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
