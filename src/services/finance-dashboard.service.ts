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

    const invoices = await prisma.statement.findMany({
      where: { PatNum: patNum },
    });

    const payments = await prisma.payment.aggregate({
      where: { PatNum: patNum },
      _sum: { PayAmt: true }
    });

    const adjustments = await prisma.adjustment.aggregate({
      where: { PatNum: patNum },
      _sum: { AdjAmt: true }
    });

    const adjSum = Number(adjustments._sum.AdjAmt) || 0;
    const totalPaid = (Number(payments._sum.PayAmt) || 0) + Math.abs(adjSum < 0 ? adjSum : 0);
    
    const sortedInvoices = [...invoices].sort((a, b) => {
      const dA = a.DateSent ? new Date(a.DateSent).getTime() : 0;
      const dB = b.DateSent ? new Date(b.DateSent).getTime() : 0;
      return dA - dB;
    });
    
    let remainingPayment = totalPaid;
    
    let bucket0_30 = 0;
    let bucket31_60 = 0;
    let bucket61_90 = 0;
    let bucket90Plus = 0;

    const now = new Date();

    sortedInvoices.forEach(inv => {
      let invBalance = Number(inv.BalTotal) || 0;
      if (remainingPayment > 0) {
        if (remainingPayment >= invBalance) {
          remainingPayment -= invBalance;
          invBalance = 0;
        } else {
          invBalance -= remainingPayment;
          remainingPayment = 0;
        }
      }

      if (invBalance > 0 && inv.DateSent) {
        const daysOld = Math.floor((now.getTime() - new Date(inv.DateSent).getTime()) / (1000 * 3600 * 24));
        if (daysOld <= 30) bucket0_30 += invBalance;
        else if (daysOld <= 60) bucket31_60 += invBalance;
        else if (daysOld <= 90) bucket61_90 += invBalance;
        else bucket90Plus += invBalance;
      }
    });

    return {
      '0_30': bucket0_30,
      '31_60': bucket31_60,
      '61_90': bucket61_90,
      '90_plus': bucket90Plus,
      total: bucket0_30 + bucket31_60 + bucket61_90 + bucket90Plus
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
