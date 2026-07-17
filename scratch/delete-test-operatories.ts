import { prisma } from '../src/config/db';

async function main() {
  console.log('Finding test operatories...');
  const allOps = await prisma.operatory.findMany();

  const realOps = [1n, 2n, 3n, 4n, 5n];
  const toDelete = allOps.filter(op => !realOps.includes(op.OperatoryNum));

  console.log(`Found ${toDelete.length} test operatories to delete.`);

  for (const op of toDelete) {
    const opNum = op.OperatoryNum;
    const name = op.OpName;
    console.log(`Deleting operatory: ${name} (OperatoryNum: ${opNum.toString()})...`);

    try {
      // 1. Clean up appointments linked to this operatory
      await prisma.appointment.deleteMany({
        where: { Op: opNum }
      });

      // 2. Clean up scheduleop linked to this operatory
      await prisma.scheduleop.deleteMany({
        where: { OperatoryNum: opNum }
      });

      // 3. Delete the operatory:
      await prisma.operatory.delete({
        where: { OperatoryNum: opNum }
      });

      console.log(`Successfully deleted operatory: ${name}`);
    } catch (err: any) {
      console.error(`Error deleting operatory ${name}:`, err.message || err);
    }
  }

  console.log('Finished operatory cleanup.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during cleanup:', err);
    process.exit(1);
  });
