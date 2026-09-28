import { prisma } from '../config/db.js';
import { invoiceService } from '../services/invoice.service.js';
import { claimService } from '../services/claim.service.js';

async function main() {
  console.log('=== VERIFYING SECONDARY CLAIM & INVOICE INTEGRITY ===');

  const stmt = await prisma.statement.findFirst({
    where: {
      OR: [
        { StatementNum: 1789626562928041n },
        { ShortGUID: 'INV1789051300' },
      ],
    },
  });

  if (!stmt) {
    throw new Error('Invoice INV1789051300 not found');
  }

  const { invoice, items } = await invoiceService.getInvoiceById(stmt.StatementNum.toString());
  console.log('Invoice details:', {
    StatementNum: invoice?.id,
    invoiceNumber: invoice?.invoiceNumber,
    totalAmount: invoice?.totalAmount,
    insurancePortion: invoice?.insurancePortion,
    secondaryInsPortion: invoice?.secondaryInsPortion,
    patientPortion: invoice?.patientPortion,
    balanceDue: invoice?.balanceDue,
    paidAmount: invoice?.paidAmount,
  });

  const updatedStmt = await prisma.statement.findUnique({
    where: { StatementNum: stmt.StatementNum },
  });
  console.log('Statement in DB:', {
    StatementNum: updatedStmt?.StatementNum?.toString(),
    InsEst: updatedStmt?.InsEst,
    BalTotal: updatedStmt?.BalTotal,
  });

  const claims = await prisma.claim.findMany({
    where: {
      ClaimNum: { in: [1789465095999n, 1789465096000n] },
    },
    orderBy: { ClaimNum: 'asc' },
  });

  let totalClaimAmount = 0;
  for (const c of claims) {
    const isSec = c.ClaimType?.toLowerCase() === 'secondary' || c.Narrative?.includes('"insuranceType":"secondary"');
    console.log(`Claim ${c.ClaimNum.toString()} (${isSec ? 'SECONDARY' : 'PRIMARY'}):`, {
      ClaimFee: c.ClaimFee,
      InsPayEst: c.InsPayEst,
      ClaimType: c.ClaimType,
      ClaimStatus: c.ClaimStatus,
    });
    totalClaimAmount += Number(c.ClaimFee || 0);
  }

  console.log('Verification checks:');
  console.log(`- Primary Claim Fee: $${claims[0].ClaimFee}`);
  console.log(`- Secondary Claim Fee: $${claims[1].ClaimFee}`);
  console.log(`- Total Claim Fees: $${totalClaimAmount.toFixed(2)}`);
  console.log(`- Total Invoice Amount: $${invoice?.totalAmount}`);
  console.log(`- Statement InsEst: $${updatedStmt?.InsEst}`);

  const passed = totalClaimAmount <= Number(invoice?.totalAmount) && Math.abs(totalClaimAmount - Number(invoice?.totalAmount)) < 0.01;
  console.log(`- Combined Claims Total Matches Invoice Exactly? ${passed ? 'YES (PASS)' : 'NO (FAIL)'}`);

  if (!passed) {
    throw new Error('Verification failed: total claims do not match invoice amount');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
