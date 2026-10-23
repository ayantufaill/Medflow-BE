import { defineConfig } from 'vitest/config';

// Eligibility (Stedi 270/271) units: fetch and Prisma are stubbed, so no DB
// and no Stedi key are needed. Never load tests/setup.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/eligibility.unit.test.ts'],
    fileParallelism: false,
    restoreMocks: true,
  },
});
