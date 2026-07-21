import { prisma } from './src/config/db';

async function fix() {
  // 1. Fix procedurelog
  const procs = await prisma.procedurelog.findMany({ where: { ProvNum: null } });
  let count = 0;
  for (const proc of procs) {
     if (proc.BillingNote) {
        try {
           const bn = JSON.parse(proc.BillingNote);
           if (bn.provider) {
              const nameParts = bn.provider.trim().split(' ');
              const lastName = nameParts[nameParts.length - 1];
              const prov = await prisma.provider.findFirst({ where: { LName: { contains: lastName, mode: 'insensitive' } } });
              if (prov) {
                 await prisma.procedurelog.update({
                    where: { ProcNum: proc.ProcNum },
                    data: { ProvNum: prov.ProvNum }
                 });
                 count++;
              }
           }
        } catch(e) {}
     }
  }
  console.log(`Updated ${count} procedurelogs with ProvNum`);

  // 2. Fix Claims
  const claims = await prisma.claim.findMany({ where: { ProvTreat: null } });
  let claimCount = 0;
  for (const claim of claims) {
      // Find procedures for this claim's invoice
      if (claim.Narrative) {
          try {
              const meta = JSON.parse(claim.Narrative);
              if (meta.invoiceId) {
                 const claimProcs = await prisma.procedurelog.findMany({ where: { StatementNum: BigInt(meta.invoiceId) }});
                 if (claimProcs.length > 0 && claimProcs[0].ProvNum) {
                     const provTreat = claimProcs[0].ProvNum;
                     const patient = await prisma.patient.findUnique({ where: { PatNum: claim.PatNum } });
                     const provBill = patient?.PriProv || provTreat;
                     await prisma.claim.update({
                        where: { ClaimNum: claim.ClaimNum },
                        data: { ProvTreat: provTreat, ProvBill: provBill }
                     });
                     claimCount++;
                 }
              }
          } catch(e) {}
      }
  }
  console.log(`Updated ${claimCount} claims with ProvTreat and ProvBill`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
