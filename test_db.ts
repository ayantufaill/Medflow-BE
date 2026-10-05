import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const p0 = await prisma.procedurelog.findFirst({ where: { StatementNum: 0n } });
  const pNull = await prisma.procedurelog.findFirst({ where: { StatementNum: null } });
  console.log('Count StatementNum=0:', await prisma.procedurelog.count({ where: { StatementNum: 0n } }));
  console.log('Count StatementNum=null:', await prisma.procedurelog.count({ where: { StatementNum: null } }));
}
test().catch(console.error).finally(() => prisma.$disconnect());
