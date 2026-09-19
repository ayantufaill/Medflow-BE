import { prisma } from '../config/db.js';
import { invoiceService } from '../services/invoice.service.js';

async function main() {
  console.log('--- Starting Secondary Claim & Procedure Data Repair ---');

  // 1. Update Claim 1789465096000
  const claim = await prisma.claim.findUnique({
    where: { ClaimNum: 1789465096000n },
  });

  if (!claim) {
    throw new Error('Claim 1789465096000 not found');
  }

  let narrativeObj: any = {};
  try {
    narrativeObj = JSON.parse(claim.Narrative || '{}');
  } catch (e) {
    narrativeObj = {};
  }

  if (narrativeObj.selectedItems && Array.isArray(narrativeObj.selectedItems)) {
    narrativeObj.selectedItems = narrativeObj.selectedItems.map((item: any) => ({
      ...item,
      insAmount: 20.4,
      amount: 20.4,
    }));
  }

  narrativeObj.claimType = 'Secondary';
  narrativeObj.insuranceType = 'secondary';
  narrativeObj.claimAmount = 20.4;
  narrativeObj.submittedAmount = 20.4;

  const updatedClaim = await prisma.claim.update({
    where: { ClaimNum: 1789465096000n },
    data: {
      ClaimFee: 20.4,
      InsPayEst: 20.4,
      ClaimType: 'Secondary',
      Narrative: JSON.stringify(narrativeObj),
    },
  });

  console.log('Updated Secondary Claim:', {
    ClaimNum: updatedClaim.ClaimNum.toString(),
    ClaimFee: updatedClaim.ClaimFee,
    ClaimType: updatedClaim.ClaimType,
    InsPayEst: updatedClaim.InsPayEst,
    Narrative: updatedClaim.Narrative,
  });

  // 2. Update claimproc 1789051257472
  const updatedClaimProc = await prisma.claimproc.update({
    where: { ClaimProcNum: 1789051257472n },
    data: {
      InsPayEst: 20.4,
    },
  });

  console.log('Updated ClaimProc:', {
    ClaimProcNum: updatedClaimProc.ClaimProcNum.toString(),
    ProcNum: updatedClaimProc.ProcNum?.toString(),
    FeeBilled: updatedClaimProc.FeeBilled,
    InsPayEst: updatedClaimProc.InsPayEst,
  });

  // 3. Update procedurelog 1789051324119
  const proc = await prisma.procedurelog.findUnique({
    where: { ProcNum: 1789051324119n },
  });

  if (proc) {
    let billingNote: any = {};
    try {
      billingNote = JSON.parse(proc.BillingNote || '{}');
    } catch (e) {
      billingNote = {};
    }

    billingNote.insPortion = 81.6;
    billingNote.secondaryInsPortion = 20.4;
    billingNote.ptPortion = 0;
    billingNote.paidAmount = 0;

    const updatedProc = await prisma.procedurelog.update({
      where: { ProcNum: 1789051324119n },
      data: {
        BillingNote: JSON.stringify(billingNote),
      },
    });

    console.log('Updated Procedure BillingNote:', updatedProc.BillingNote);
  }

  // 4. Recalculate invoice INV1789051300 (StatementNum: 1789626562928041)
  const stmt = await prisma.statement.findFirst({
    where: {
      OR: [
        { StatementNum: 1789626562928041n },
        { ShortGUID: 'INV1789051300' },
        { ShortGUID: { contains: '1789051300' } },
      ],
    },
  });

  if (stmt) {
    const recalculated = await invoiceService.recalculateInvoice(stmt.StatementNum.toString());
    console.log('Recalculated Invoice Summary:', {
      invoiceNumber: recalculated.invoiceNumber,
      totalAmount: recalculated.totalAmount,
      insurancePortion: recalculated.insurancePortion,
      patientPortion: recalculated.patientPortion,
      paidAmount: recalculated.paidAmount,
      balanceDue: recalculated.balanceDue,
    });
  }

  console.log('--- Data repair completed successfully ---');
}

main()
  .catch((err) => {
    console.error('Error during data repair:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
