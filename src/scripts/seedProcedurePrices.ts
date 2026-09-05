import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

/**
 * High-performance batch ID allocator for sequences.
 */
async function getNextBatchIds(table: string, column: string, count: number): Promise<bigint[]> {
  if (count <= 0) return [];
  return await prisma.$transaction(async (tx) => {
    const model = (tx as any)[table];
    if (!model) throw new Error(`Model ${table} does not exist on PrismaClient`);
    const result = await model.aggregate({ _max: { [column]: true } });
    const maxVal = result._max[column] ? BigInt(result._max[column]) : 0n;
    const targetNextId = maxVal + 1n;

    const inserted = await tx.$queryRawUnsafe<any[]>(`
      INSERT INTO medflow_sequences (table_name, next_id) 
      VALUES ($1, $2 + $3) 
      ON CONFLICT (table_name) DO UPDATE 
      SET next_id = GREATEST(medflow_sequences.next_id + $3, $2 + $3) 
      RETURNING next_id
    `, table, targetNextId, BigInt(count));

    const endId = BigInt(inserted[0].next_id);
    const startId = endId - BigInt(count) + 1n;
    const ids: bigint[] = [];
    for (let i = 0n; i < BigInt(count); i++) {
      ids.push(startId + i);
    }
    return ids;
  });
}

/**
 * Deterministic price generator between $60.00 and $190.00 based on procedure code string.
 */
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

/**
 * Seeding script to assign procedure code prices between $60.00 and $190.00
 * across all active procedure codes and fee schedules using fast bulk operations.
 */
async function seedProcedurePrices() {
  console.log('🚀 Starting Fast Procedure Code Prices Seeding ($60 - $190)...');

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

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const sched of feeSchedules) {
      console.log(`\n⏳ Processing Fee Schedule: "${sched.Description}" (ID: ${sched.FeeSchedNum})...`);

      // Multiplier depending on schedule type (PPO slightly lower, standard full)
      const multiplier = sched.FeeSchedType === 1 ? 0.85 : sched.FeeSchedType === 2 ? 0.70 : 1.0;

      // Fetch all existing fees for this schedule at once
      const existingFees = await prisma.fee.findMany({
        where: { FeeSched: sched.FeeSchedNum },
      });
      const feeMap = new Map<string, { FeeNum: bigint; Amount: number | null }>();
      for (const f of existingFees) {
        if (f.CodeNum) {
          feeMap.set(f.CodeNum.toString(), { FeeNum: f.FeeNum, Amount: f.Amount });
        }
      }

      const toCreate: { CodeNum: bigint; Amount: number }[] = [];
      const toUpdate: { FeeNum: bigint; Amount: number }[] = [];

      for (const proc of procCodes) {
        if (!proc.CodeNum) continue;

        const price = generatePriceForCode(proc.ProcCode, multiplier);
        const existing = feeMap.get(proc.CodeNum.toString());

        if (!existing) {
          toCreate.push({ CodeNum: proc.CodeNum, Amount: price });
        } else if (existing.Amount === null || existing.Amount === 0 || existing.Amount !== price) {
          toUpdate.push({ FeeNum: existing.FeeNum, Amount: price });
        }
      }

      // Bulk create
      if (toCreate.length > 0) {
        const batchIds = await getNextBatchIds('fee', 'FeeNum', toCreate.length);
        const createData = toCreate.map((item, idx) => ({
          FeeNum: batchIds[idx],
          CodeNum: item.CodeNum,
          FeeSched: sched.FeeSchedNum,
          Amount: item.Amount,
          UseDefaultFee: 0,
          UseDefaultCov: 0,
        }));

        // Batch in chunks of 500
        for (let i = 0; i < createData.length; i += 500) {
          const chunk = createData.slice(i, i + 500);
          await prisma.fee.createMany({ data: chunk });
        }
        totalCreated += toCreate.length;
        console.log(`   ➕ Created ${toCreate.length} fees`);
      }

      // Parallel bulk update in chunks
      if (toUpdate.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < toUpdate.length; i += chunkSize) {
          const chunk = toUpdate.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map((item) =>
              prisma.fee.update({
                where: { FeeNum: item.FeeNum },
                data: { Amount: item.Amount },
              })
            )
          );
        }
        totalUpdated += toUpdate.length;
        console.log(`   🔄 Updated ${toUpdate.length} fees`);
      }
    }

    console.log(`\n🎉 Procedure prices successfully seeded!`);
    console.log(`   - New fee entries created: ${totalCreated}`);
    console.log(`   - Existing fee entries updated: ${totalUpdated}`);
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
