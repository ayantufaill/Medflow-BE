import { prisma } from '../config/db';
import { tenantContextStorage } from '../config/tenant-context';

/**
 * Backfills patient.GroupNum from each patient's current ClinicNum ->
 * clinic.GroupNum, now that group membership is a real stored column
 * instead of only derived at request time (see PermissionService.
 * getBranchAccess's groupClinicIds). Patients with no ClinicNum get
 * GroupNum = null. A ClinicNum that doesn't resolve to a real clinic row
 * (orphaned data) also gets null, and is logged separately so it's visible
 * rather than silently swallowed.
 *
 * Idempotent — safe to re-run; only writes rows whose GroupNum is wrong.
 */
async function main() {
  console.log('Backfilling patient.GroupNum from patient.ClinicNum -> clinic.GroupNum...');

  const clinics = await prisma.clinic.findMany({ select: { ClinicNum: true, GroupNum: true } });
  const groupByClinic = new Map(clinics.map((c) => [c.ClinicNum.toString(), c.GroupNum]));

  const patients = await prisma.patient.findMany({
    select: { PatNum: true, ClinicNum: true, GroupNum: true },
  });

  let updated = 0;
  let skippedAlreadyCorrect = 0;
  const unresolvedClinicNums = new Set<string>();

  for (const patient of patients) {
    let targetGroupNum: number | null = null;

    if (patient.ClinicNum !== null && patient.ClinicNum !== undefined) {
      const clinicKey = patient.ClinicNum.toString();
      if (groupByClinic.has(clinicKey)) {
        targetGroupNum = groupByClinic.get(clinicKey) ?? null;
      } else {
        unresolvedClinicNums.add(clinicKey);
        targetGroupNum = null;
      }
    }

    if (patient.GroupNum === targetGroupNum) {
      skippedAlreadyCorrect++;
      continue;
    }

    await prisma.patient.update({
      where: { PatNum: patient.PatNum },
      data: { GroupNum: targetGroupNum },
    });
    updated++;
  }

  console.log(`Backfill complete. Updated: ${updated}. Already correct: ${skippedAlreadyCorrect}. Total patients: ${patients.length}.`);
  if (unresolvedClinicNums.size > 0) {
    console.log(
      `ClinicNum values that did not resolve to a real clinic (set to GroupNum = null): ${Array.from(unresolvedClinicNums).join(', ')}`
    );
  } else {
    console.log('All non-null ClinicNum values resolved to a real clinic.');
  }
}

// A trusted admin/backfill operation touching every patient across every
// group — no per-request tenant context exists for a standalone script, so
// RLS's WITH CHECK would otherwise reject every write. Entering the '*'
// wildcard context here is the same bypass a true system Admin gets, not a
// way around RLS.
tenantContextStorage.run({ clinicIds: '*', patientGroupId: '*' }, () => main())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
