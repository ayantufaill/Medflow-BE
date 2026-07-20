import { prisma } from './src/config/db';
import { ClaimService } from './src/services/claim.service';

async function test() {
  const claimService = new ClaimService();
  const claims = await prisma.claim.findMany({
    orderBy: { ClaimNum: 'desc' },
    take: 1
  });
  
  if (claims.length > 0) {
    const claim = await claimService.getClaimById(claims[0].ClaimNum.toString());
    console.log(JSON.stringify(claim, null, 2));
  } else {
    console.log("No claims found");
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
