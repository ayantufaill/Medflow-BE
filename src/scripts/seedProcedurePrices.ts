import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

/**
 * Seeding script to assign procedure code prices between $60.00 and $190.00
 * across all active procedure codes and fee schedules.
 */
async function seedProcedurePrices() {
  console.log('🚀 Starting Procedure Code Prices Seeding ($60 - $190)...');

  try {
    // 1. Fetch or create the default standard fee schedule
    let defaultSched = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });

    if (!defaultSched) {
      const nextSchedId = await getNextId('feesched', 'FeeSchedNum');
      defaultSched = await prisma.feesched.create({
        data: {
          FeeSchedNum: nextSchedId,
          Description: 'Standard Office Fee Guide',
          FeeSchedType: 0,
          IsHidden: 0,
          IsGlobal: 1,
        },
      });
      console.log(`✅ Created default fee schedule: Standard Office Fee Guide (ID: ${defaultSched.FeeSchedNum})`);
    } else {
      console.log(`ℹ️ Using default fee schedule: ${defaultSched.Description} (ID: ${defaultSched.FeeSchedNum})`);
    }

    // 2. Fetch all active fee schedules
    const feeSchedules = await prisma.feesched.findMany({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });
    console.log(`📋 Found ${feeSchedules.length} active fee schedule(s).`);

    // 3. Fetch all procedure codes
    const procCodes = await prisma.procedurecode.findMany({
      orderBy: { ProcCode: 'asc' },
    });
    console.log(`📦 Found ${procCodes.length} procedure codes in the database.`);

    if (procCodes.length === 0) {
      console.warn('⚠️ No procedure codes found in procedurecode table. Nothing to seed.');
      return;
    }

    // Deterministic price generator between $60.00 and $190.00 based on procedure code string
    function generatePriceForCode(code: string, varianceMultiplier = 1.0): number {
      let hash = 0;
      for (let i = 0; i < code.length; i++) {
        hash = (hash << 5) - hash + code.charCodeAt(i);
        hash |= 0;
      }
      const positiveHash = Math.abs(hash);
      // Generate integer step between 60 and 190 (step of 5 for clean dental pricing, e.g. 60, 65, 70... 190)
      const steps = 26; // (190 - 60) / 5 = 26
      const basePrice = 60 + (positiveHash % (steps + 1)) * 5;
      const adjustedPrice = Math.round(basePrice * varianceMultiplier);
      // Clamp between 60 and 190
      return Math.min(190, Math.max(60, adjustedPrice));
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const sched of feeSchedules) {
      console.log(`\n⏳ Processing Fee Schedule: "${sched.Description}" (ID: ${sched.FeeSchedNum})...`);
      
      // Multiplier depending on schedule type (PPO slightly lower, standard full)
      const multiplier = sched.FeeSchedType === 1 ? 0.85 : sched.FeeSchedType === 2 ? 0.70 : 1.0;

      for (const proc of procCodes) {
        if (!proc.CodeNum) continue;

        const price = generatePriceForCode(proc.ProcCode, multiplier);

        const existingFee = await prisma.fee.findFirst({
          where: {
            CodeNum: proc.CodeNum,
            FeeSched: sched.FeeSchedNum,
          },
        });

        if (existingFee) {
          await prisma.fee.update({
            where: { FeeNum: existingFee.FeeNum },
            data: { Amount: price },
          });
          updatedCount++;
        } else {
          const nextFeeNum = await getNextId('fee', 'FeeNum');
          await prisma.fee.create({
            data: {
              FeeNum: nextFeeNum,
              CodeNum: proc.CodeNum,
              FeeSched: sched.FeeSchedNum,
              Amount: price,
              UseDefaultFee: 0,
              UseDefaultCov: 0,
            },
          });
          createdCount++;
        }
      }
    }

    console.log(`\n🎉 Procedure prices successfully seeded!`);
    console.log(`   - New fee entries created: ${createdCount}`);
    console.log(`   - Existing fee entries updated: ${updatedCount}`);
    console.log(`   - Price range: $60.00 – $190.00`);

    // 4. Update any existing procedurelog records that have ProcFee = 0 or null
    const zeroFeeProcs = await prisma.procedurelog.findMany({
      where: {
        OR: [{ ProcFee: 0 }, { ProcFee: null }],
        OldCode: { not: null },
      },
      take: 500,
    });

    if (zeroFeeProcs.length > 0) {
      let procUpdated = 0;
      for (const pl of zeroFeeProcs) {
        const matchingPrice = generatePriceForCode(pl.OldCode ?? 'D0000');
        await prisma.procedurelog.update({
          where: { ProcNum: pl.ProcNum },
          data: { ProcFee: matchingPrice },
        });
        procUpdated++;
      }
      console.log(`✨ Backfilled ${procUpdated} procedurelog records with standard procedure fees.`);
    }

  } catch (error) {
    console.error('❌ Error seeding procedure prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedProcedurePrices();
