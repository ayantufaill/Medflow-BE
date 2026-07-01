import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Concurrency - getNextId atomic lock', () => {
  beforeAll(async () => {
    // Ensure we have a clean state or don't care, we just need to hit the DB
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.securitylog.deleteMany({
      where: { LogText: { startsWith: 'Concurrency Test' } }
    });
  });

  it('should generate unique IDs without unique constraint failures when called concurrently', async () => {
    const CONCURRENCY_COUNT = 15;
    
    // Create an array of parallel promises that all try to getNextId and insert
    const promises = Array.from({ length: CONCURRENCY_COUNT }).map(async (_, index) => {
      const logNum = await getNextId('securitylog', 'SecurityLogNum');
      
      // Attempt to create. If getNextId is not atomic, multiple threads will get the same ID
      // and this will throw a Prisma P2002 Unique Constraint Failed error.
      const log = await prisma.securitylog.create({
        data: {
          SecurityLogNum: logNum,
          LogDateTime: new Date(),
          LogText: `Concurrency Test Run - ${index}`,
        },
      });
      return log;
    });

    // If it throws, the test fails.
    const results = await Promise.all(promises);
    
    expect(results.length).toBe(CONCURRENCY_COUNT);
    
    // Verify that all IDs are strictly unique
    const ids = results.map(r => r.SecurityLogNum.toString());
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(CONCURRENCY_COUNT);
  });
});
