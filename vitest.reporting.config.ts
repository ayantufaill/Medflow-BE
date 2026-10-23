import { defineConfig } from 'vitest/config';

// No integration setup or seeding. PostgreSQL fixture tests are opt-in via
// REPORTING_POSTGRES_CONTAINER and execute only read-only synthetic CTE queries.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/reporting-*.test.ts'],
    fileParallelism: false,
    clearMocks: true,
  },
});
