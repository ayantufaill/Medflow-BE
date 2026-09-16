import { prisma } from '../src/config/db.js';
import { getNextId } from '../src/utils/opendental-ids.util.js';

/**
 * Backfill script: Migrates treatment plan items from serialized treatplan.Note JSON
 * into relational proctp rows.
 * Idempotent: Skips plans that already have proctp rows.
 */
async function backfillTreatmentPlansProctp() {
  console.log('--- Starting Treatment Plans proctp Backfill ---');
  try {
    const plans = await prisma.treatplan.findMany({
      orderBy: { TreatPlanNum: 'asc' },
    });

    console.log(`Found ${plans.length} total treatment plans to evaluate.`);

    let migratedPlansCount = 0;
    let createdProctpRowsCount = 0;
    let skippedPlansCount = 0;
    let errorCount = 0;

    for (const plan of plans) {
      // Check if plan already has proctp rows
      const existingCount = await prisma.proctp.count({
        where: { TreatPlanNum: plan.TreatPlanNum },
      });

      if (existingCount > 0) {
        skippedPlansCount++;
        continue;
      }

      // Parse items from Note JSON
      if (!plan.Note) {
        skippedPlansCount++;
        continue;
      }

      let parsedMeta: any = null;
      try {
        parsedMeta = JSON.parse(plan.Note);
      } catch (e) {
        console.warn(`[WARN] Failed to parse Note JSON for TreatPlanNum ${plan.TreatPlanNum}`);
        errorCount++;
        continue;
      }

      const items = parsedMeta?.items;
      if (!Array.isArray(items) || items.length === 0) {
        skippedPlansCount++;
        continue;
      }

      // Flatten items if stored as visit groupings
      let flatItems: any[] = [];
      if (items[0] && Array.isArray(items[0].procedures)) {
        for (const v of items) {
          if (Array.isArray(v.procedures)) flatItems.push(...v.procedures);
        }
      } else {
        flatItems = items;
      }

      let planRowsCreated = 0;
      for (let i = 0; i < flatItems.length; i++) {
        const item = flatItems[i];
        try {
          const procTPNum = await getNextId('proctp', 'ProcTPNum');

          let provNum: bigint | null = null;
          if (item.provider) {
            const prov = await prisma.provider.findFirst({ where: { Abbr: item.provider } });
            if (prov?.ProvNum) provNum = prov.ProvNum;
          }
          if (!provNum && plan.PatNum) {
            const pat = await prisma.patient.findUnique({ where: { PatNum: plan.PatNum } });
            if (pat?.PriProv) provNum = pat.PriProv;
          }

          const feeStr = item.charge ?? item.fee ?? item.patientAmount ?? '0';
          const feeAmt = typeof feeStr === 'number' ? feeStr : Number(String(feeStr).replace(/[^0-9.-]+/g, '')) || 0;
          const priInsAmt = item.insPortion ? Number(item.insPortion) : 0;
          const patAmt = item.ptPortion ? Number(item.ptPortion) : 0;

          await prisma.proctp.create({
            data: {
              ProcTPNum: procTPNum,
              TreatPlanNum: plan.TreatPlanNum,
              PatNum: plan.PatNum,
              ItemOrder: i + 1,
              ToothNumTP: item.tooth ? String(item.tooth) : null,
              Surf: item.site ?? item.surface ?? null,
              ProcCode: item.procedureCode ?? item.code ?? null,
              Descript: item.description ?? item.name ?? null,
              FeeAmt: feeAmt,
              PriInsAmt: priInsAmt,
              PatAmt: patAmt,
              Dx: item.icd ?? item.dx ?? null,
              Prognosis: item.status ?? 'P',
              ProvNum: provNum,
              DateTP: plan.DateTP ?? new Date(),
            },
          });
          planRowsCreated++;
          createdProctpRowsCount++;
        } catch (itemErr) {
          console.error(`Error inserting proctp item ${i} for plan ${plan.TreatPlanNum}:`, itemErr);
          errorCount++;
        }
      }

      if (planRowsCreated > 0) {
        migratedPlansCount++;
      }
    }

    console.log(`Backfill Complete:
- Migrated Plans: ${migratedPlansCount}
- Created proctp Rows: ${createdProctpRowsCount}
- Skipped Plans (already relational or empty): ${skippedPlansCount}
- Errors encountered: ${errorCount}`);
  } catch (error) {
    console.error('Fatal error during treatment plans proctp backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].includes('backfill-treatment-plans-proctp')) {
  backfillTreatmentPlansProctp();
}

export { backfillTreatmentPlansProctp };
