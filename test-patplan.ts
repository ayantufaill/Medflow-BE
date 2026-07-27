import { prisma } from './src/config/db';
async function run() {
  const c = await prisma.patplan.count();
  console.log('PatPlan count:', c);
  
  const p = await prisma.patplan.findFirst();
  console.log('Sample patplan:', p);
}
run().finally(() => prisma.$disconnect());
