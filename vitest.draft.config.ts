import { defineConfig } from 'vitest/config';

// These regressions stub transport/database engines; never load tests/setup.ts
// or connect to the application's configured database.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/tenant-transaction.unit.test.ts', 'tests/treatment-plan-draft.unit.test.ts'],
    fileParallelism: false,
    restoreMocks: true,
  },
});
