import { prisma } from '../config/db';

export class AgingService {
  async updatePatientAging(patNum: bigint) {
    const now = new Date();

    // 1. Calculate Pending Insurance Estimate (InsEst)
    // Sum all InsPayEst from claimproc where Status is Unsent (0), Sent (1), or Hold (4)
    const pendingProcs = await prisma.claimproc.findMany({
      where: {
        PatNum: patNum,
        Status: { in: [0, 1, 4] },
      },
    });
    const totalInsEst = pendingProcs.reduce((sum, cp) => sum + (Number(cp.InsPayEst) || 0), 0);

    // 2. Fetch charges (procedures, adjustments) and credits (payments)
    const procs = await prisma.procedurelog.findMany({
      where: { PatNum: patNum },
      orderBy: { ProcDate: 'asc' },
    });
    const adjustments = await prisma.adjustment.findMany({
      where: { PatNum: patNum },
      orderBy: { AdjDate: 'asc' },
    });
    const payments = await prisma.paysplit.findMany({
      where: { PatNum: patNum },
      orderBy: { DatePay: 'asc' },
    });

    const totalProcFee = procs.reduce((sum, p) => sum + (Number(p.ProcFee) || 0), 0);
    const totalAdj = adjustments.reduce((sum, a) => sum + (Number(a.AdjAmt) || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (Number(p.SplitAmt) || 0), 0);
    const totalBalance = Math.round((totalProcFee + totalAdj - totalPayments) * 100) / 100;

    // 3. Compute payment plan due
    const openPayPlans = await prisma.payplan.findMany({
      where: { PatNum: patNum, IsClosed: { not: 1 } },
    });
    const payPlanDue = openPayPlans.reduce((sum, pp) => sum + (Number(pp.PayAmt) || 0), 0);

    // 4. Calculate Age Buckets (FIFO)
    let bal_0_30 = 0;
    let bal_31_60 = 0;
    let bal_61_90 = 0;
    let balOver90 = 0;

    if (totalBalance <= 0) {
      // Credit balance or zero
      bal_0_30 = totalBalance;
    } else {
      // Build a list of debits (procedures and positive adjustments)
      interface ChargeItem {
        date: Date;
        amount: number;
      }
      const charges: ChargeItem[] = [];

      for (const p of procs) {
        const fee = Number(p.ProcFee) || 0;
        if (fee > 0) {
          charges.push({ date: p.ProcDate || p.DateEntryC || now, amount: fee });
        }
      }
      for (const a of adjustments) {
        const adj = Number(a.AdjAmt) || 0;
        if (adj > 0) {
          charges.push({ date: a.AdjDate || now, amount: adj });
        }
      }

      // Sort charges oldest to newest
      charges.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Deductions = payments + negative adjustments
      let totalCredits = totalPayments;
      for (const a of adjustments) {
        const adj = Number(a.AdjAmt) || 0;
        if (adj < 0) {
          totalCredits += Math.abs(adj);
        }
      }

      // Apply credits against oldest charges (FIFO)
      let remCredit = totalCredits;
      for (const charge of charges) {
        if (remCredit >= charge.amount) {
          remCredit -= charge.amount;
          charge.amount = 0;
        } else {
          charge.amount -= remCredit;
          remCredit = 0;
        }

        if (charge.amount > 0) {
          const daysOld = Math.floor((now.getTime() - new Date(charge.date).getTime()) / (1000 * 3600 * 24));
          if (daysOld <= 30) {
            bal_0_30 += charge.amount;
          } else if (daysOld <= 60) {
            bal_31_60 += charge.amount;
          } else if (daysOld <= 90) {
            bal_61_90 += charge.amount;
          } else {
            balOver90 += charge.amount;
          }
        }
      }

      // If charges list was empty or didn't account for full balance, put remainder in bal_0_30
      const sumBuckets = bal_0_30 + bal_31_60 + bal_61_90 + balOver90;
      if (sumBuckets < totalBalance) {
        bal_0_30 += (totalBalance - sumBuckets);
      }

      bal_0_30 = Math.round(bal_0_30 * 100) / 100;
      bal_31_60 = Math.round(bal_31_60 * 100) / 100;
      bal_61_90 = Math.round(bal_61_90 * 100) / 100;
      balOver90 = Math.round(balOver90 * 100) / 100;
    }

    // 5. Upsert into famaging table using Raw SQL (Prisma ignores famaging due to no PK)
    const checkExisting = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "PatNum" FROM famaging WHERE "PatNum" = $1 LIMIT 1`, 
      patNum
    );

    if (checkExisting.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE famaging 
         SET "Bal_0_30" = $1, "Bal_31_60" = $2, "Bal_61_90" = $3, "BalOver90" = $4, "InsEst" = $5, "BalTotal" = $6, "PayPlanDue" = $7 
         WHERE "PatNum" = $8`,
        bal_0_30, bal_31_60, bal_61_90, balOver90, totalInsEst, totalBalance, payPlanDue, patNum
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO famaging ("PatNum", "Bal_0_30", "Bal_31_60", "Bal_61_90", "BalOver90", "InsEst", "BalTotal", "PayPlanDue") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        patNum, bal_0_30, bal_31_60, bal_61_90, balOver90, totalInsEst, totalBalance, payPlanDue
      );
    }
  }
}

export const agingService = new AgingService();
