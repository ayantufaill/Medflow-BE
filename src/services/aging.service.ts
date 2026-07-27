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
    const procs = await prisma.procedurelog.findMany({ where: { PatNum: patNum } });
    const totalProcFee = procs.reduce((sum, p) => sum + (Number(p.ProcFee) || 0), 0);

    const payments = await prisma.paysplit.findMany({ where: { PatNum: patNum } });
    const totalPayments = payments.reduce((sum, p) => sum + (Number(p.SplitAmt) || 0), 0);

    const adjustments = await prisma.adjustment.findMany({ where: { PatNum: patNum } });
    const totalAdj = adjustments.reduce((sum, a) => sum + (Number(a.AdjAmt) || 0), 0);

    const totalBalance = totalProcFee + totalAdj - totalPayments;

    // 3. Upsert into famaging table using Raw SQL (Prisma ignores famaging due to no PK)
    const checkExisting = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "PatNum" FROM famaging WHERE "PatNum" = $1 LIMIT 1`, 
      patNum
    );

    if (checkExisting.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE famaging SET "Bal_0_30" = $1, "InsEst" = $2, "BalTotal" = $3 WHERE "PatNum" = $4`,
        totalBalance, totalInsEst, totalBalance, patNum
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO famaging ("PatNum", "Bal_0_30", "Bal_31_60", "Bal_61_90", "BalOver90", "InsEst", "BalTotal", "PayPlanDue") 
         VALUES ($1, $2, 0, 0, 0, $3, $4, 0)`,
        patNum, totalBalance, totalInsEst, totalBalance
      );
    }
  }
}

export const agingService = new AgingService();
