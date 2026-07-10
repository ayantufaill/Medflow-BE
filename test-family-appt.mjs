import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const familyAppts = await prisma.appointment.findMany({ where: { PatNum: 4n } });
  console.log('Appointments for PatNum=4:', familyAppts.length);
  if (familyAppts.length > 0) {
    console.log(familyAppts.map(a => ({ id: a.AptNum, date: a.AptDateTime })));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
