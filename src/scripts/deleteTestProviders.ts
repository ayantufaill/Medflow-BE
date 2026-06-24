import { prisma } from '../config/db';

async function deleteTestProviders() {
  console.log('Finding test providers...');
  const testProviders = await prisma.provider.findMany();
  
  const toDelete = testProviders.filter(prov => {
    const fullName = `${prov.FName || ''} ${prov.LName || ''}`.trim().toLowerCase();
    return fullName.startsWith('test providerappt') || fullName.startsWith('detail testprovider');
  });

  console.log(`Found ${toDelete.length} test providers to delete.`);
  for (const prov of toDelete) {
    const provNum = prov.ProvNum;
    const name = `${prov.FName || ''} ${prov.LName || ''}`.trim();
    console.log(`Deleting provider: ${name} (ProvNum: ${provNum})...`);

    try {
      // Clean up related appointments
      await prisma.appointment.deleteMany({
        where: {
          OR: [
            { ProvNum: provNum },
            { ProvHyg: provNum }
          ]
        }
      });

      // Clean up schedule
      await prisma.schedule.deleteMany({
        where: { ProvNum: provNum }
      });

      // Clean up userod (users linked to this provider)
      await prisma.userod.deleteMany({
        where: { ProvNum: provNum }
      });

      // Clean up claim links
      await prisma.claim.updateMany({
        where: { ProvTreat: provNum },
        data: { ProvTreat: null }
      });
      await prisma.claim.updateMany({
        where: { ProvBill: provNum },
        data: { ProvBill: null }
      });
      await prisma.claim.updateMany({
        where: { ProvOrderOverride: provNum },
        data: { ProvOrderOverride: null }
      });

      // Clean up claimproc links
      await prisma.claimproc.deleteMany({
        where: { ProvNum: provNum }
      });

      // Clean up procedurelog links
      await prisma.procedurelog.deleteMany({
        where: { ProvNum: provNum }
      });

      // Finally delete the provider
      await prisma.provider.delete({
        where: { ProvNum: provNum }
      });

      console.log(`Successfully deleted provider: ${name}`);
    } catch (err: any) {
      console.error(`Error deleting provider ${name}:`, err.message || err);
    }
  }

  console.log('Finished database cleanup.');
}

deleteTestProviders()
  .catch((err) => {
    console.error('Fatal error during cleanup:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
