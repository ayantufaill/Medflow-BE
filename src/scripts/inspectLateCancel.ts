import { prisma } from '../config/db.js';

async function main() {
  const statement = await prisma.statement.findFirst({
    where: { ShortGUID: 'INV1789749201' },
    include: {
      procedurelog: {
        include: {
          procedurecode_procedurelog_CodeNumToprocedurecode: true
        }
      }
    }
  });

  console.log('--- STATEMENT INV1789749201 ---');
  console.log(JSON.stringify(statement, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  // Check procedure codes related to cancellation or missed appointment
  const cancelCodes = await prisma.procedurecode.findMany({
    where: {
      OR: [
        { Descript: { contains: 'cancel', mode: 'insensitive' } },
        { Descript: { contains: 'miss', mode: 'insensitive' } },
        { Descript: { contains: 'broken', mode: 'insensitive' } },
        { ProcCode: { contains: 'cancel', mode: 'insensitive' } },
        { ProcCode: { contains: 'miss', mode: 'insensitive' } },
        { ProcCode: { in: ['D9986', 'D9987'] } },
      ]
    }
  });
  console.log('--- CANCEL/MISSED CODES ---');
  console.log(JSON.stringify(cancelCodes, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
