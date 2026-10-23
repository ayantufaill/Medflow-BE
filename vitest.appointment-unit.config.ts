import { defineConfig } from 'vitest/config';

// Controller regressions with mocked services; no database setup required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/appointment-create-branch.unit.test.ts'],
    restoreMocks: true,
  },
});
