import { defineConfig } from 'vitest/config';

// Note history units mock Prisma and do not need the database setup used by
// the main integration test configuration.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/note-history.unit.test.ts'],
    fileParallelism: false,
    restoreMocks: true,
  },
});
