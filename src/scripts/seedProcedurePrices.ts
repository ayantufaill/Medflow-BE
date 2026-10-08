// Unrestricted tenant context for RLS — must be imported before any query.
//
// `fee` has row-level security. Its policy passes a row whose ClinicNum is
// NULL, which is how this script got away with no context, but a fee carrying
// a ClinicNum would be refused with 42501 and the price would silently not be
// written. Every other seed script imports this for the same reason.
import '../config/seed-context';
import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { mapCodeToCategory } from '../services/deductible.service';

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
 * Plausible price band per CDT category, in dollars.
 *
 * WHY NOT ONE FLAT $60-$190 BAND
 * ------------------------------
 * This script used to hash the code string into a single $60-$190 range for
 * every procedure, which priced a porcelain crown at $89 and a periodic oral
 * evaluation at $136 — the exam cost more than the crown. Any estimate,
 * treatment plan or COB calculation built on that is nonsense in a way that
 * looks plausible until a human reads the number.
 *
 * The bands below are rough US private-practice ranges by category, which is
 * enough for the data to behave correctly (a crown outranks a cleaning, a
 * deductible actually bites, a secondary estimate is meaningful). They are
 * still SEED data, not a real fee guide — a practice sets its own in
 * Fee Management, and `seedFeeSchedules` carries hand-picked realistic
 * amounts for 11 common codes which this script now leaves alone.
 */
const CATEGORY_PRICE_BANDS: Record<string, [number, number]> = {
  diagnostic: [40, 180],
  preventative: [60, 220],
  restorative: [140, 420],
  endodontics: [600, 1400],
  periodonticsbasic: [120, 400],
  periodonticsmajor: [600, 1800],
  prosthodonticsremovable: [900, 2600],
  maxillofacialprosthetics: [800, 3000],
  implantservices: [1400, 4500],
  prosthodonticsfixed: [800, 2200],
  oralsurgery: [150, 900],
  orthodontics: [1500, 6500],
  adjunctgeneral: [60, 400],
};

/** Codes that map to no category (non-CDT, custom) fall back to this band. */
const DEFAULT_PRICE_BAND: [number, number] = [60, 190];

/**
 * Deterministic price for a code, inside its category's band.
 *
 * Deterministic on purpose: re-running the seed must not churn every price,
 * and two developers' databases should agree.
 */
function generatePriceForCode(code: string, varianceMultiplier = 1.0): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  const category = mapCodeToCategory(code);
  const [low, high] = (category && CATEGORY_PRICE_BANDS[category]) || DEFAULT_PRICE_BAND;

  // Step in $5 increments across the band, the way a real fee guide is written.
  const steps = Math.max(1, Math.floor((high - low) / 5));
  const basePrice = low + (positiveHash % (steps + 1)) * 5;
  const adjusted = Math.round(basePrice * varianceMultiplier);
  return Math.min(high, Math.max(low, adjusted));
}

/**
 * Seeding script to assign procedure code prices between $60.00 and $190.00
 * across all active procedure codes and fee schedules using fast bulk operations.
 */
async function seedProcedurePrices() {
  console.log('🚀 Seeding procedure code prices by CDT category (gaps only)...');

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
        } else if (existing.Amount === null || existing.Amount === 0) {
          // FILL GAPS ONLY. The previous condition also fired on
          // `existing.Amount !== price`, so every run overwrote any amount
          // that was not exactly this generator's output — which meant it
          // clobbered the hand-picked realistic fees seedFeeSchedules and
          // seedFees had just written, AND silently reset any price a
          // practice had edited in Fee Management the next time the seed ran.
          //
          // A seed may create a missing price. It must never overwrite one
          // somebody chose.
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
    console.log('   - Priced by CDT category; existing non-zero fees left untouched');

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
