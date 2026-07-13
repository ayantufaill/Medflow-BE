import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all family relationships...');
  
  // Reset Guarantor to PatNum for all patients to remove Guarantor-based links
  const result = await prisma.$executeRawUnsafe(`UPDATE patient SET "Guarantor" = "PatNum"`);
  console.log(`Updated Guarantor for patients.`);

  // We should also clear the 'household' array from any patient metadata
  // FkeyType for patient meta is 206 (PATIENT_META_FKEYTYPE from opendental-auth.util.ts)
  const prefs = await prisma.userodpref.findMany({
    where: { FkeyType: 206 }
  });

  let updatedMetaCount = 0;
  for (const pref of prefs) {
    if (pref.ValueString) {
      try {
        const meta = JSON.parse(pref.ValueString);
        if (meta.household && meta.household.length > 0) {
          meta.household = [];
          await prisma.userodpref.update({
            where: { UserOdPrefNum: pref.UserOdPrefNum },
            data: { ValueString: JSON.stringify(meta) }
          });
          updatedMetaCount++;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
  console.log(`Cleared household metadata for ${updatedMetaCount} patients.`);
  
  console.log('All family relationships have been removed.');
}

main()
  .catch((e) => {
    console.error('Error clearing relationships:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
