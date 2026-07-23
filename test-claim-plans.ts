import { prisma } from './src/config/db';
async function run() {
  const claims = await prisma.claim.findMany({
    orderBy: { ClaimNum: 'desc' },
    take: 5
  });
  
  for (const claim of claims) {
    console.log(`Claim ${claim.ClaimNum}: PatNum=${claim.PatNum} PlanNum=${claim.PlanNum} InsSubNum=${claim.InsSubNum}`);
  }
}
run().finally(() => prisma.$disconnect());
