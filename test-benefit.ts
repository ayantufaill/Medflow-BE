import { prisma } from './src/config/db';
async function run() {
  const benefits = await prisma.benefit.findMany({
    take: 5
  });
  console.log(benefits);
  const covspans = await prisma.covspan.findMany({
    take: 5
  });
  console.log(covspans);
}
run().finally(() => prisma.$disconnect());
