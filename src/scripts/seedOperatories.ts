import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Operatories...');

  const operatories = [
    { name: 'Op1', abbrev: 'Op1', order: 1 },
    { name: 'Op2', abbrev: 'Op2', order: 2 },
    { name: 'Op3', abbrev: 'Op3', order: 3 },
    { name: 'Op4', abbrev: 'Op4', order: 4 },
    { name: 'Op5', abbrev: 'Op5', order: 5 },
  ];

  for (const op of operatories) {
    // Generate an ID for the operatory
    const nextIdResult = await prisma.$queryRaw<[{ current_val: bigint }]>`SELECT COALESCE(MAX("OperatoryNum"), 0) + 1 AS current_val FROM operatory`;
    const nextId = nextIdResult[0]?.current_val || BigInt(1);

    // Try to find if an operatory with this name already exists
    const existingOp = await prisma.operatory.findFirst({
      where: { OpName: op.name }
    });

    if (existingOp) {
      console.log(`Operatory ${op.name} already exists. Skipping...`);
    } else {
      await prisma.operatory.create({
        data: {
          OperatoryNum: nextId,
          OpName: op.name,
          Abbrev: op.abbrev,
          ItemOrder: op.order,
          IsHidden: 0,
          IsHygiene: 0,
          SetProspective: 0,
          IsWebSched: 0,
          IsNewPatAppt: 0
        }
      });
      console.log(`Created operatory: ${op.name}`);
    }
  }

  console.log('Finished seeding operatories.');
}

main()
  .catch((e) => {
    console.error('Error seeding operatories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
