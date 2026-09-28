import { prisma } from '../config/db.js';

/**
 * Backfill script: Sets IsPending = 0 on all existing patplan records where IsPending IS NULL.
 * Ensures legacy and uninitialized insurance plans are treated as active.
 * Idempotent — safe to re-run.
 */
async function backfillPatPlanIsPending() {
  console.log('--- Starting PatPlan IsPending Backfill ---');
  try {
    const nullRecordsCount = await prisma.patplan.count({
      where: { IsPending: null },
    });

    console.log(`Found ${nullRecordsCount} patplan records with IsPending = NULL.`);

    if (nullRecordsCount > 0) {
      const updateResult = await prisma.patplan.updateMany({
        where: { IsPending: null },
        data: { IsPending: 0 },
      });

      console.log(`Successfully updated ${updateResult.count} patplan records to IsPending = 0.`);
    } else {
      console.log('No patplan records require update.');
    }

    const remainingNulls = await prisma.patplan.count({
      where: { IsPending: null },
    });
    console.log(`Verification: ${remainingNulls} records remaining with IsPending = NULL.`);
    console.log('--- PatPlan IsPending Backfill Complete ---');
  } catch (error) {
    console.error('Error executing patplan IsPending backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].includes('backfillPatPlanIsPending')) {
  backfillPatPlanIsPending();
}

export { backfillPatPlanIsPending };
