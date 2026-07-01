import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    clearMocks: true,
    restoreMocks: true,
    maxConcurrency: 1,
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    sequence: { concurrent: false },
  },
});
