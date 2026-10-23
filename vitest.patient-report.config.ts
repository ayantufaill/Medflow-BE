import { defineConfig } from 'vitest/config';

// Unit fixtures only: do not load the integration database setup.
export default defineConfig({
  test: { environment: 'node', include: ['tests/patient-report.unit.test.ts'], fileParallelism: false },
});
