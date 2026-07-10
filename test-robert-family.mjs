import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.patient.findFirst({ where: { FName: 'Robert', LName: 'Johnson' }});
  console.log('Robert:', p.PatNum, 'Guarantor:', p.Guarantor);
  const family = await prisma.patient.findMany({ where: { OR: [{ Guarantor: p.Guarantor }, { PatNum: p.Guarantor }] } });
  console.log('Family:', family.map(m => ({ PatNum: m.PatNum, Name: m.FName + ' ' + m.LName })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
