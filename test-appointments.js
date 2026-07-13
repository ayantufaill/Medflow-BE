import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const appts4 = await prisma.appointment.findMany({
    where: { PatNum: 4 }
  });
  const appts14 = await prisma.appointment.findMany({
    where: { PatNum: 14 }
  });

  console.log("Appointments for PatNum 4:");
  console.log(appts4.map(a => ({
    AptNum: a.AptNum.toString(),
    PatNum: a.PatNum.toString(),
    AptDateTime: a.AptDateTime,
    AptStatus: a.AptStatus
  })));

  console.log("Appointments for PatNum 14:");
  console.log(appts14.map(a => ({
    AptNum: a.AptNum.toString(),
    PatNum: a.PatNum.toString(),
    AptDateTime: a.AptDateTime,
    AptStatus: a.AptStatus
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
