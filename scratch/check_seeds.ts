import { prisma } from '../src/config/db';

async function main() {
  const carrierCount = await prisma.carrier.count();
  const insplanCount = await prisma.insplan.count();
  const inssubCount = await prisma.inssub.count();
  const patplanCount = await prisma.patplan.count();
  const claimCount = await prisma.claim.count();
  const claimprocCount = await prisma.claimproc.count();
  const claimpaymentCount = await prisma.claimpayment.count();
  const claimtrackingCount = await prisma.claimtracking.count();

  console.log('--- Database Seeding Check ---');
  console.log(`Carriers: ${carrierCount}`);
  console.log(`Insurance Plans (insplan): ${insplanCount}`);
  console.log(`Subscribers (inssub): ${inssubCount}`);
  console.log(`Patient Plans (patplan): ${patplanCount}`);
  console.log(`Claims: ${claimCount}`);
  console.log(`Claim Procedures (claimproc): ${claimprocCount}`);
  console.log(`Claim Payments (claimpayment): ${claimpaymentCount}`);
  console.log(`Claim Tracking: ${claimtrackingCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
