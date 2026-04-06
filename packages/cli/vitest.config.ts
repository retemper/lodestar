import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.e2e.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.e2e.ts',
        'src/__tests__/**',
        'src/**/index.ts',
        'src/bin.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 95,
        lines: 95,
      },
    },
  },
});
