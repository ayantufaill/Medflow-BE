import { prisma } from '../config/db';

export class AgingService {
  async updatePatientAging(patNum: bigint) {
    // 1. Calculate Pending Insurance Estimate (InsEst)
    // Sum all InsPayEst from claimproc where Status is Unsent (0), Sent (1), or Hold (4)
    const pendingProcs = await prisma.claimproc.findMany({
      where: {
        PatNum: patNum,
        Status: { in: [0, 1, 4] },
      },
    });
    const totalInsEst = pendingProcs.reduce((sum, cp) => sum + (Number(cp.InsPayEst) || 0), 0);

    // 2. Calculate Patient Balance (Simplified)
    // Sum all ProcFee from procedurelog
    const procs = await prisma.procedurelog.findMany({ where: { PatNum: patNum } });
    const totalProcFee = procs.reduce((sum, p) => sum + (Number(p.ProcFee) || 0), 0);

    // Sum all SplitAmt from paysplit (patient payments)
    const payments = await prisma.paysplit.findMany({ where: { PatNum: patNum } });
    const totalPayments = payments.reduce((sum, p) => sum + (Number(p.SplitAmt) || 0), 0);

    // Sum all AdjAmt from adjustment
    const adjustments = await prisma.adjustment.findMany({ where: { PatNum: patNum } });
    const totalAdj = adjustments.reduce((sum, a) => sum + (Number(a.AdjAmt) || 0), 0);

    const totalBalance = totalProcFee + totalAdj - totalPayments;

    // 3. Upsert into famaging table
    await prisma.famaging.upsert({
      where: { PatNum: patNum },
      create: {
        PatNum: patNum,
        Bal_0_30: totalBalance, // Simplified: Putting all balance in 0-30 bucket for now
        Bal_31_60: 0,
        Bal_61_90: 0,
        BalOver90: 0,
        InsEst: totalInsEst,
        BalTotal: totalBalance,
        PayPlanDue: 0
      },
      update: {
        Bal_0_30: totalBalance,
        InsEst: totalInsEst,
        BalTotal: totalBalance,
      }
    });
  }
}

export const agingService = new AgingService();
