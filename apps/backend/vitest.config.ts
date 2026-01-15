import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/modules/betting-insights/**/*.ts'],
      exclude: ['src/modules/betting-insights/**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '@outscore/shared-types': '../../../packages/shared-types/src',
    },
  },
});
