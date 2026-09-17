import { prisma } from '../config/db.js';
import { invoiceService } from '../services/invoice.service.js';
import { agingService } from '../services/aging.service.js';

async function fixInvoiceUnderpayment() {
  console.log('--- Starting Invoice Underpayment Fix for Scenario 1 & 2 ---');
  try {
    // -------------------------------------------------------------
    // Scenario 1: Fix INV1789051265 (David Kim)
    // Insurance pays first ($22.50 / $42.50) -> underpay shifts to Pt Balance ($62.50)
    // -------------------------------------------------------------
    const stmt1 = await prisma.statement.findFirst({
      where: {
        OR: [
          { ShortGUID: 'INV1789051265' },
          { ShortGUID: { contains: '1789051265' } },
        ],
      },
    });

    if (stmt1) {
      console.log(`\nFixing Scenario 1: Invoice ${stmt1.ShortGUID}...`);
      const procs1 = await prisma.procedurelog.findMany({
        where: { StatementNum: stmt1.StatementNum },
      });

      for (const proc of procs1) {
        const meta = JSON.parse(proc.BillingNote || '{}');
        const fee = Number(proc.ProcFee || meta.charge || 85);
        const insPaid = 22.50;
        const writeoff = 0;
        const ptPortion = fee - writeoff - insPaid; // 62.50

        meta.writeoff = writeoff;
        meta.ptPortion = ptPortion;
        meta.insPortion = insPaid;
        meta.isManuallyAdjusted = true;

        await prisma.procedurelog.update({
          where: { ProcNum: proc.ProcNum },
          data: { BillingNote: JSON.stringify(meta) },
        });

        await prisma.claimproc.updateMany({
          where: { ProcNum: proc.ProcNum },
          data: { WriteOff: 0, InsPayAmt: 22.50, Status: 1 },
        });
      }

      const updated1 = await invoiceService.recalculateInvoice(stmt1.StatementNum.toString());
      console.log(`Scenario 1 Invoice ${updated1.invoiceNumber} result:`, {
        totalAmount: updated1.totalAmount,
        patientPortion: updated1.patientPortion,
        insurancePortion: updated1.insurancePortion,
        writeoffAmount: updated1.writeoffAmount,
        paidAmount: updated1.paidAmount,
        balanceDue: updated1.balanceDue,
      });

      if (stmt1.PatNum) {
        await agingService.updatePatientAging(stmt1.PatNum);
      }
    }

    // -------------------------------------------------------------
    // Scenario 2: Fix INV1789051268 (Andrew Garcia)
    // Patient paid in full first ($20.40 / $20.40) -> underpay ($20.00) remains in Ins Balance
    // -------------------------------------------------------------
    const stmt2 = await prisma.statement.findFirst({
      where: {
        OR: [
          { ShortGUID: 'INV1789051268' },
          { ShortGUID: { contains: '1789051268' } },
        ],
      },
    });

    if (stmt2) {
      console.log(`\nFixing Scenario 2: Invoice ${stmt2.ShortGUID}...`);
      const procs2 = await prisma.procedurelog.findMany({
        where: { StatementNum: stmt2.StatementNum },
      });

      for (const proc of procs2) {
        const meta = JSON.parse(proc.BillingNote || '{}');
        const fee = Number(proc.ProcFee || meta.charge || 102);
        const ptPortion = 20.40;
        const insPortion = 81.60;
        const writeoff = 0;

        meta.writeoff = writeoff;
        meta.ptPortion = ptPortion;
        meta.insPortion = insPortion;
        meta.isManuallyAdjusted = true;

        await prisma.procedurelog.update({
          where: { ProcNum: proc.ProcNum },
          data: { BillingNote: JSON.stringify(meta) },
        });

        await prisma.claimproc.updateMany({
          where: { ProcNum: proc.ProcNum },
          data: { WriteOff: 0, InsPayAmt: 61.60, Status: 1 },
        });
      }

      const updated2 = await invoiceService.recalculateInvoice(stmt2.StatementNum.toString());
      console.log(`Scenario 2 Invoice ${updated2.invoiceNumber} result:`, {
        totalAmount: updated2.totalAmount,
        patientPortion: updated2.patientPortion,
        insurancePortion: updated2.insurancePortion,
        writeoffAmount: updated2.writeoffAmount,
        paidAmount: updated2.paidAmount,
        balanceDue: updated2.balanceDue,
      });

      if (stmt2.PatNum) {
        await agingService.updatePatientAging(stmt2.PatNum);
      }
    }

    console.log('\n--- Both Scenarios Fixed Successfully ---');
  } catch (error) {
    console.error('Error fixing invoice underpayment:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixInvoiceUnderpayment();
