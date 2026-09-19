import { prisma } from '../config/db.js';

async function main() {
  const statement = await prisma.statement.findFirst({
    where: {
      OR: [
        { ShortGUID: 'INV1789051268' },
        { ShortGUID: { contains: '1789051268' } },
      ],
    },
  });

  console.log('STATEMENT:', JSON.stringify(statement, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  if (statement) {
    const procs = await prisma.procedurelog.findMany({
      where: { StatementNum: statement.StatementNum },
    });
    console.log('PROCEDURES:', JSON.stringify(procs, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    const cps = await prisma.claimproc.findMany({
      where: { ProcNum: { in: procs.map(p => p.ProcNum) } },
    });
    console.log('CLAIMPROCS:', JSON.stringify(cps, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    const payments = await prisma.payment.findMany({
      where: { PatNum: statement.PatNum },
      orderBy: { PayNum: 'asc' },
    });
    console.log('PAYMENTS:', JSON.stringify(payments, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  }
}

main().finally(() => prisma.$disconnect());
