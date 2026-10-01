import { prisma } from '../config/db';

/**
 * Creates the "Default Clinic" (ClinicNum = 1) that the rest of the seed
 * chain assumes already exists:
 *
 *  - seedUsers.ts attaches every sample account to ClinicNum 1 (both the
 *    userod.ClinicNum column and a userclinic row). Without the clinic row
 *    that write trips the fk_userod_2_ClinicNum foreign key, and because
 *    seedUsers swallows its own errors the whole user roster is silently
 *    skipped — which then fails every test that logs in.
 *  - seedBranches.ts looks ClinicNum 1 up by id ("Default Clinic") and links
 *    it to the Bright Smile practicegroup; on an empty clinic table that
 *    lookup missed and the Westside branch took ClinicNum 1 instead.
 *
 * Must therefore run FIRST in seedAll.ts, before seedUsers.
 *
 * Idempotent — safe to re-run. Only ever creates the row; an existing
 * ClinicNum 1 is left exactly as it is (including its GroupNum, which
 * seedBranches owns).
 */
async function main() {
  const existing = await prisma.clinic.findUnique({ where: { ClinicNum: 1n } });

  if (existing) {
    console.log(`Clinic ClinicNum=1 ("${existing.Description}") already exists. Skipping create...`);
    return;
  }

  // ClinicNum is set explicitly rather than through getNextId: this row has to
  // land on 1 specifically. getNextId is MAX-based and its medflow_sequences
  // bookkeeping uses GREATEST, so the next allocation still returns 2.
  const clinic = await prisma.clinic.create({
    data: {
      ClinicNum: 1n,
      Description: 'Default Clinic',
      Abbr: 'DEFAULT',
      IsMedicalOnly: 0,
      IsHidden: 0,
    },
  });

  console.log(`Created clinic: ${clinic.Description} (ClinicNum=${clinic.ClinicNum})`);
}

main()
  .catch((error) => {
    console.error('Error seeding default clinic:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
