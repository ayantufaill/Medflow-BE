import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pat4 = await prisma.patient.findFirst({ where: { PatNum: 4 } });
  const pat14 = await prisma.patient.findFirst({ where: { PatNum: 14 } });
  
  console.log("Patient 4:", {
    PatNum: pat4?.PatNum?.toString(),
    FName: pat4?.FName,
    LName: pat4?.LName,
    Guarantor: pat4?.Guarantor?.toString(),
    PatStatus: pat4?.PatStatus
  });

  console.log("Patient 14:", {
    PatNum: pat14?.PatNum?.toString(),
    FName: pat14?.FName,
    LName: pat14?.LName,
    Guarantor: pat14?.Guarantor?.toString(),
    PatStatus: pat14?.PatStatus
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
