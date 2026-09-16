import { prisma } from '../config/db';
import { tenantContextStorage } from '../config/tenant-context';

/**
 * Backfill script: finds all operatories with NULL ClinicNum and either:
 *   1. Assigns them to a clinic inferred from their linked appointments, OR
 *   2. Hides them (IsHidden=1) if they have no appointment usage.
 *
 * Why: The RLS policy on operatory has a `"ClinicNum" IS NULL` passthrough
 * that makes NULL-ClinicNum rows visible to ALL users, defeating tenant
 * isolation. Legacy seedOperatories.ts created Op1–Op5 without ClinicNum.
 */
async function backfillOperatoryClinicNums() {
  console.log('🔍 Scanning for operatories with NULL ClinicNum...\n');

  const nullClinicOps = await prisma.operatory.findMany({
    where: { ClinicNum: null },
    select: {
      OperatoryNum: true,
      OpName: true,
      Abbrev: true,
      IsHidden: true,
    },
  });

  if (nullClinicOps.length === 0) {
    console.log('✅ No operatories with NULL ClinicNum found. Nothing to do.');
    return;
  }

  console.log(`Found ${nullClinicOps.length} operatories with NULL ClinicNum:\n`);

  let assigned = 0;
  let hidden = 0;

  for (const op of nullClinicOps) {
    const name = op.OpName ?? op.Abbrev ?? `ID:${op.OperatoryNum}`;

    // Try to infer ClinicNum from linked appointments
    const linkedAppt = await prisma.appointment.findFirst({
      where: {
        Op: op.OperatoryNum,
        ClinicNum: { not: null },
      },
      select: { ClinicNum: true },
      orderBy: { AptDateTime: 'desc' },
    });

    if (linkedAppt?.ClinicNum) {
      // Assign to the clinic of the most recent appointment
      await prisma.operatory.update({
        where: { OperatoryNum: op.OperatoryNum },
        data: { ClinicNum: linkedAppt.ClinicNum },
      });
      console.log(`  ✅ "${name}" → assigned to ClinicNum ${linkedAppt.ClinicNum} (from appointment history)`);
      assigned++;
    } else {
      // No appointment usage — hide the operatory to prevent RLS leakage
      if (op.IsHidden !== 1) {
        await prisma.operatory.update({
          where: { OperatoryNum: op.OperatoryNum },
          data: { IsHidden: 1 },
        });
        console.log(`  🙈 "${name}" → hidden (no appointment usage, no clinic to infer)`);
        hidden++;
      } else {
        console.log(`  ⏭️  "${name}" → already hidden, skipping`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Assigned to clinic: ${assigned}`);
  console.log(`   Hidden:             ${hidden}`);
  console.log(`   Total processed:    ${nullClinicOps.length}`);
}

// Run with unrestricted tenant context (script, not a request)
tenantContextStorage.run({ clinicIds: '*', patientGroupId: '*' }, () =>
  backfillOperatoryClinicNums()
)
  .catch((e) => {
    console.error('Error backfilling operatory ClinicNums:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
