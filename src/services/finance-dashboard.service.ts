import { prisma } from '../config/db';

export class FinanceDashboardService {
  async getLedgerByPatient(patientId: string) {
    const patNum = BigInt(patientId);

    // Fetch invoices (statements)
    const invoices = await prisma.statement.findMany({
      where: { PatNum: patNum },
      orderBy: { DateSent: 'desc' }
    });

    // Fetch payments
    const payments = await prisma.payment.findMany({
      where: { PatNum: patNum },
      orderBy: { PayDate: 'desc' }
    });

    // Fetch adjustments
    const adjustments = await prisma.adjustment.findMany({
      where: { PatNum: patNum },
      orderBy: { AdjDate: 'desc' }
    });

    const ledger: any[] = [];

    invoices.forEach(inv => {
      ledger.push({
        id: `inv_${inv.StatementNum.toString()}`,
        date: inv.DateSent,
        type: 'Invoice',
        description: inv.Note || 'Invoice Generated',
        charges: Number(inv.BalTotal) || 0,
        credits: 0,
      });
    });

    payments.forEach(pay => {
      let method = 'Payment';
      try {
        if (pay.PayNote) {
          const parsed = JSON.parse(pay.PayNote);
          method = parsed.paymentMethod || parsed.method || 'Payment';
        }
      } catch (e) {
        // ignore
      }
      ledger.push({
        id: `pay_${pay.PayNum.toString()}`,
        date: pay.PayDate,
        type: 'Payment',
        description: `Payment - ${method}`,
        charges: 0,
        credits: Number(pay.PayAmt) || 0,
      });
    });

    adjustments.forEach(adj => {
      const amt = Number(adj.AdjAmt) || 0;
      ledger.push({
        id: `adj_${adj.AdjNum.toString()}`,
        date: adj.AdjDate,
        type: 'Adjustment',
        description: adj.AdjNote || 'Adjustment',
        charges: amt > 0 ? amt : 0,
        credits: amt < 0 ? Math.abs(amt) : 0,
      });
    });

    // Sort ascending by date to calculate running balance
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    const enrichedLedger = ledger.map(entry => {
      balance += entry.charges - entry.credits;
      return {
        ...entry,
        balance
      };
    });

    // Sort descending for the UI
    enrichedLedger.reverse();

    return {
      ledger: enrichedLedger,
      currentBalance: balance
    };
  }

  async getAgingByPatient(patientId: string) {
    const patNum = BigInt(patientId);

    // Resolve patient & family members
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patNum },
      select: { PatNum: true, Guarantor: true }
    });

    let patNums: bigint[] = [patNum];
    if (patient) {
      const guarantorId = (patient.Guarantor && patient.Guarantor > 0n) ? patient.Guarantor : patNum;
      const familyMembers = await prisma.patient.findMany({
        where: {
          OR: [
            { Guarantor: guarantorId },
            { PatNum: guarantorId }
          ]
        },
        select: { PatNum: true }
      });
      if (familyMembers.length > 0) {
        patNums = Array.from(new Set(familyMembers.map(m => m.PatNum)));
      }
    }

    const now = new Date();
    const round2 = (val: number) => Math.round(val * 100) / 100;

    // ─────────────────────────────────────────────────────────────
    // 1. Insurance Balance
    // ─────────────────────────────────────────────────────────────
    const claims = await prisma.claim.findMany({
      where: { PatNum: { in: patNums } },
    });

    const claimProcs = await prisma.claimproc.findMany({
      where: { PatNum: { in: patNums } },
    });

    const claimProcMap = new Map<string, { insEst: number; insPaid: number }>();
    for (const cp of claimProcs) {
      if (cp.ClaimNum) {
        const key = cp.ClaimNum.toString();
        const existing = claimProcMap.get(key) || { insEst: 0, insPaid: 0 };
        existing.insEst += Number(cp.InsPayEst) || 0;
        existing.insPaid += Number(cp.InsPayAmt) || 0;
        claimProcMap.set(key, existing);
      }
    }

    let insBucket0_30 = 0;
    let insBucket31_60 = 0;
    let insBucket61_90 = 0;
    let insBucket90Plus = 0;

    for (const claim of claims) {
      const claimKey = claim.ClaimNum.toString();
      const cpTotals = claimProcMap.get(claimKey);

      const insEst = (Number(claim.InsPayEst) || 0) || (cpTotals?.insEst || 0);
      const insPaid = (Number(claim.InsPayAmt) || 0) || (cpTotals?.insPaid || 0);

      const remainingIns = Math.max(0, insEst - insPaid);
      if (remainingIns > 0) {
        const claimDate = claim.DateSent || claim.DateService || now;
        const daysOld = Math.floor((now.getTime() - new Date(claimDate).getTime()) / (1000 * 3600 * 24));
        if (daysOld <= 30) insBucket0_30 += remainingIns;
        else if (daysOld <= 60) insBucket31_60 += remainingIns;
        else if (daysOld <= 90) insBucket61_90 += remainingIns;
        else insBucket90Plus += remainingIns;
      }
    }

    for (const cp of claimProcs) {
      if (!cp.ClaimNum) {
        const remainingIns = Math.max(0, (Number(cp.InsPayEst) || 0) - (Number(cp.InsPayAmt) || 0));
        if (remainingIns > 0) {
          const procDate = cp.ProcDate || cp.DateCP || now;
          const daysOld = Math.floor((now.getTime() - new Date(procDate).getTime()) / (1000 * 3600 * 24));
          if (daysOld <= 30) insBucket0_30 += remainingIns;
          else if (daysOld <= 60) insBucket31_60 += remainingIns;
          else if (daysOld <= 90) insBucket61_90 += remainingIns;
          else insBucket90Plus += remainingIns;
        }
      }
    }

    const insuranceBalance = {
      '0_30': round2(insBucket0_30),
      '31_60': round2(insBucket31_60),
      '61_90': round2(insBucket61_90),
      '90_plus': round2(insBucket90Plus),
      total: round2(insBucket0_30 + insBucket31_60 + insBucket61_90 + insBucket90Plus)
    };

    // ─────────────────────────────────────────────────────────────
    // 2. Family Outstanding Bills
    // ─────────────────────────────────────────────────────────────
    const statements = await prisma.statement.findMany({
      where: { PatNum: { in: patNums } },
    });

    const payments = await prisma.payment.aggregate({
      where: { PatNum: { in: patNums } },
      _sum: { PayAmt: true }
    });

    const adjustments = await prisma.adjustment.aggregate({
      where: { PatNum: { in: patNums } },
      _sum: { AdjAmt: true }
    });

    const adjSum = Number(adjustments._sum.AdjAmt) || 0;
    const totalPaid = (Number(payments._sum.PayAmt) || 0) + Math.abs(adjSum < 0 ? adjSum : 0);

    const sortedStatements = [...statements].sort((a, b) => {
      const dA = a.DateSent ? new Date(a.DateSent).getTime() : 0;
      const dB = b.DateSent ? new Date(b.DateSent).getTime() : 0;
      return dA - dB;
    });

    let remainingPayment = totalPaid;

    let outBucket0_30 = 0;
    let outBucket31_60 = 0;
    let outBucket61_90 = 0;
    let outBucket90Plus = 0;

    sortedStatements.forEach(inv => {
      const balTotal = Number(inv.BalTotal) || 0;
      const insEst = Number(inv.InsEst) || 0;
      let patientPortion = Math.max(0, balTotal - insEst);

      if (remainingPayment > 0) {
        if (remainingPayment >= patientPortion) {
          remainingPayment -= patientPortion;
          patientPortion = 0;
        } else {
          patientPortion -= remainingPayment;
          remainingPayment = 0;
        }
      }

      if (patientPortion > 0 && inv.DateSent) {
        const daysOld = Math.floor((now.getTime() - new Date(inv.DateSent).getTime()) / (1000 * 3600 * 24));
        if (daysOld <= 30) outBucket0_30 += patientPortion;
        else if (daysOld <= 60) outBucket31_60 += patientPortion;
        else if (daysOld <= 90) outBucket61_90 += patientPortion;
        else outBucket90Plus += patientPortion;
      }
    });

    const familyOutstanding = {
      '0_30': round2(outBucket0_30),
      '31_60': round2(outBucket31_60),
      '61_90': round2(outBucket61_90),
      '90_plus': round2(outBucket90Plus),
      total: round2(outBucket0_30 + outBucket31_60 + outBucket61_90 + outBucket90Plus)
    };

    // ─────────────────────────────────────────────────────────────
    // 3. Family Balance
    // ─────────────────────────────────────────────────────────────
    const unbilledProcs = await prisma.procedurelog.findMany({
      where: {
        PatNum: { in: patNums },
        ProcStatus: 2, // Completed
        OR: [
          { StatementNum: null },
          { StatementNum: BigInt(0) }
        ]
      }
    });

    const unbilledProcNums = unbilledProcs.map(p => p.ProcNum);
    const unbilledClaimProcs = unbilledProcNums.length > 0
      ? await prisma.claimproc.findMany({
          where: { ProcNum: { in: unbilledProcNums } }
        })
      : [];

    const procInsEstMap = new Map<string, number>();
    for (const cp of unbilledClaimProcs) {
      if (cp.ProcNum) {
        const key = cp.ProcNum.toString();
        const current = procInsEstMap.get(key) || 0;
        procInsEstMap.set(key, current + (Number(cp.InsPayEst) || 0));
      }
    }

    let unbilledPatientPortionTotal = 0;
    for (const proc of unbilledProcs) {
      const fee = Number(proc.ProcFee) || 0;
      const insEst = procInsEstMap.get(proc.ProcNum.toString()) || 0;
      unbilledPatientPortionTotal += Math.max(0, fee - insEst);
    }

    let netUnbilledFor0_30 = unbilledPatientPortionTotal;
    if (remainingPayment > 0) {
      netUnbilledFor0_30 = Math.max(0, unbilledPatientPortionTotal - remainingPayment);
    }

    const balBucket0_30 = outBucket0_30 + netUnbilledFor0_30;

    const familyBalance = {
      '0_30': round2(balBucket0_30),
      '31_60': round2(outBucket31_60),
      '61_90': round2(outBucket61_90),
      '90_plus': round2(outBucket90Plus),
      total: round2(balBucket0_30 + outBucket31_60 + outBucket61_90 + outBucket90Plus)
    };

    // ─────────────────────────────────────────────────────────────
    // 4. Patient & Insurance Unallocated Credits (Prepayments)
    // ─────────────────────────────────────────────────────────────
    const unearnedPaysplits = await prisma.paysplit.findMany({
      where: {
        PatNum: { in: patNums },
        UnearnedType: { gt: 0 }
      }
    });

    let patientAccountCredit = 0;
    let insuranceAccountCredit = 0;

    for (const split of unearnedPaysplits) {
      const splitAmt = Number(split.SplitAmt) || 0;
      const unearnedType = Number(split.UnearnedType) || 0;
      if (unearnedType === 2) {
        insuranceAccountCredit += splitAmt;
      } else {
        patientAccountCredit += splitAmt;
      }
    }

    patientAccountCredit = round2(patientAccountCredit);
    insuranceAccountCredit = round2(insuranceAccountCredit);

    return {
      familyOutstanding,
      familyBalance,
      insuranceBalance,
      patientAccountCredit,
      insuranceAccountCredit
    };
  }

  async getGlobalOverview() {
    // Total Practice Collections
    const totalPayments = await prisma.payment.aggregate({
      _sum: { PayAmt: true }
    });

    const totalAdjustments = await prisma.adjustment.aggregate({
      _sum: { AdjAmt: true }
    });

    // We can estimate total billing by looking at all statements or patient balances
    const totalInvoices = await prisma.statement.aggregate({
      _sum: { BalTotal: true }
    });

    // Monthly Performance
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyPayments = await prisma.payment.aggregate({
      where: {
        PayDate: { gte: firstDayOfMonth }
      },
      _sum: { PayAmt: true }
    });

    // Claim stats
    const totalClaims = await prisma.claim.count();
    const pendingClaims = await prisma.claim.count({
      where: { ClaimStatus: 'S' } // 'S' for Sent (Pending)
    });

    const collections = Number(totalPayments._sum.PayAmt) || 0;
    const adjustments = Number(totalAdjustments._sum.AdjAmt) || 0;
    const billings = Number(totalInvoices._sum.BalTotal) || 0;

    // Simplified A/R calculation
    const totalAR = billings + adjustments - collections;

    return {
      totalCollections: collections,
      totalAR: totalAR > 0 ? totalAR : 0,
      monthlyCollections: Number(monthlyPayments._sum.PayAmt) || 0,
      claims: {
        total: totalClaims,
        pending: pendingClaims
      }
    };
  }
}

export const financeDashboardService = new FinanceDashboardService();
