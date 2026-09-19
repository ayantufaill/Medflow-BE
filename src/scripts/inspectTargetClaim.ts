import { prisma } from '../config/db.js';

async function main() {
  const claim = await prisma.claim.findUnique({
    where: { ClaimNum: 1789465096000n },
  });
  console.log('SECONDARY CLAIM BASIC:', {
    ClaimNum: claim?.ClaimNum.toString(),
    ClaimFee: claim?.ClaimFee,
    ClaimType: claim?.ClaimType,
    InsPayEst: claim?.InsPayEst,
    ClaimStatus: claim?.ClaimStatus,
  });

  const claimprocs = await prisma.claimproc.findMany({
    where: { ClaimNum: 1789465096000n },
  });
  console.log('CLAIMPROCS for Secondary Claim:', JSON.stringify(claimprocs, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  const primaryClaim = await prisma.claim.findUnique({
    where: { ClaimNum: 1789465095999n },
  });
  console.log('PRIMARY CLAIM:', JSON.stringify(primaryClaim, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  const proc = await prisma.procedurelog.findUnique({
    where: { ProcNum: 1789051324119n },
  });
  console.log('PROCEDURE:', JSON.stringify(proc, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
