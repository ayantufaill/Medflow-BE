import { prisma } from '../config/db';

async function removeAllPatientInsurances() {
  console.log('🔄 Starting patient insurance removal...');

  try {
    const totalPatPlans = await prisma.patplan.count();
    console.log(`📋 Found ${totalPatPlans} patient insurance plan records.`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete patient-specific benefit overrides referencing patplan
      const benefits = await tx.benefit.deleteMany({
        where: { PatPlanNum: { not: null } },
      });

      // 2. Delete MedFlow patient insurance metadata (FkeyType = 207)
      const metadata = await tx.userodpref.deleteMany({
        where: { FkeyType: 207 },
      });

      // 3. Delete all patient insurance links
      const patplans = await tx.patplan.deleteMany();

      // 4. Delete only orphaned subscriber policies not linked to any historical claims
      const activeClaimSubscribers = await tx.$queryRaw<{ InsSubNum: bigint }[]>`
        SELECT "InsSubNum" FROM claim WHERE "InsSubNum" IS NOT NULL
        UNION
        SELECT "InsSubNum2" FROM claim WHERE "InsSubNum2" IS NOT NULL
        UNION
        SELECT "InsSubNum" FROM claimproc WHERE "InsSubNum" IS NOT NULL
        UNION
        SELECT "InsSubNum" FROM payplan WHERE "InsSubNum" IS NOT NULL
        UNION
        SELECT "InsSubNum" FROM etrans WHERE "InsSubNum" IS NOT NULL
      `;

      const activeSubIds = activeClaimSubscribers.map((r) => r.InsSubNum);

      const inssubs = await tx.inssub.deleteMany({
        where: {
          InsSubNum: { notIn: activeSubIds },
        },
      });

      return {
        deletedBenefits: benefits.count,
        deletedMetadata: metadata.count,
        deletedPatPlans: patplans.count,
        deletedOrphanSubscribers: inssubs.count,
      };
    });

    console.log('✅ Successfully removed patient insurances:');
    console.log(`   - Benefit overrides deleted: ${result.deletedBenefits}`);
    console.log(`   - Metadata entries deleted:  ${result.deletedMetadata}`);
    console.log(`   - Patient plans detached:    ${result.deletedPatPlans}`);
    console.log(`   - Orphan subscriber records: ${result.deletedOrphanSubscribers}`);
  } catch (error) {
    console.error('❌ Failed to remove patient insurances:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

removeAllPatientInsurances();
