import { prisma } from './src/config/db';
import { ClaimService } from './src/services/claim.service';

async function test() {
  const claimService = new ClaimService();
  const claims = await prisma.claim.findMany({
    orderBy: { ClaimNum: 'desc' },
    take: 1
  });
  
  if (claims.length > 0) {
    console.log("Found claim:", claims[0].ClaimNum.toString());
    const claim = await claimService.getClaimById(claims[0].ClaimNum.toString());
    
    console.log("Billing Provider:", claim.billingProvider);
    console.log("Treating Provider:", claim.treatingProvider);
    console.log("Procedures:", JSON.stringify(claim.procedures, null, 2));

    // Let's also check the procedurelog raw entries for this statement
    if (claim.invoiceId && claim.invoiceId._id) {
       const procs = await prisma.procedurelog.findMany({
         where: { StatementNum: BigInt(claim.invoiceId._id) },
         include: { provider_procedurelog_ProvNumToprovider: true }
       });
       console.log("Raw Procedures:", JSON.stringify(procs, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
    }
  } else {
    console.log("No claims found");
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
