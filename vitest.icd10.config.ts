import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/icd10-code.unit.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 30000 } });
