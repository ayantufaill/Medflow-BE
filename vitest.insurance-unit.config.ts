import { defineConfig } from 'vitest/config';

// Pure insurance-engine units: the coverage-limits rules and the deductible
// engine (including the flat-amount path). No DB, no transport stubs — never
// load tests/setup.ts, which connects to the configured database.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/coverage-limits.test.ts',
      'tests/deductible-engine.test.ts',
      'tests/coverage-loop.unit.test.ts',
    ],
    // Importing the invoice service pulls in the auth/socket module graph, whose
    // top-level guard demands these secrets. They are throwaway values — nothing
    // here signs or verifies a real token.
    env: {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
    fileParallelism: false,
    restoreMocks: true,
  },
});
