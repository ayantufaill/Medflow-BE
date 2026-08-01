import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { invoiceService } from './invoice.service';

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);
const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

export class PayPlanService {
  private mapPayPlanToApi(row: any) {
    return {
      _id: row.PayPlanNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      guarantorId: row.Guarantor?.toString() ?? null,
      startDate: row.PayPlanDate ?? null,
      apr: Number(row.APR) || 0,
      downPayment: Number(row.DownPayment) || 0,
      monthlyPayment: Number(row.PayAmt) || 0,
      numberOfPayments: Number(row.NumberOfPayments) || 0,
      completedAmount: Number(row.CompletedAmt) || 0,
      isClosed: Boolean(row.IsClosed),
      notes: row.Note ?? null,
      charges: row.payplancharge ? row.payplancharge.map((c: any) => ({
        _id: c.PayPlanChargeNum.toString(),
        chargeDate: c.ChargeDate,
        principal: Number(c.Principal) || 0,
        interest: Number(c.Interest) || 0,
        notes: c.Note,
      })) : [],
    };
  }

  private async enrichPayPlan(plan: any) {
    const patient = plan.patientId
      ? await prisma.patient.findUnique({ where: { PatNum: BigInt(plan.patientId) } })
      : null;
    return {
      ...plan,
      patient: patient ? mapPatientToApi(patient) : null,
    };
  }

  async getAllPayPlans(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    const [rows, total] = await Promise.all([
      prisma.payplan.findMany({
        where,
        include: { payplancharge: true },
        orderBy: { PayPlanDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payplan.count({ where }),
    ]);

    const payplans = await Promise.all(
      rows.map((row) => this.enrichPayPlan(this.mapPayPlanToApi(row)))
    );

    return {
      payplans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPayPlanById(payPlanId: string) {
    const plan = await prisma.payplan.findUnique({
      where: { PayPlanNum: BigInt(payPlanId) },
      include: { payplancharge: true },
    });
    if (!plan) {
      throw new NotFoundError('Payment plan not found');
    }

    return this.enrichPayPlan(this.mapPayPlanToApi(plan));
  }

  async createPayPlan(
    data: {
      patientId: string;
      totalAmount: number;
      downPayment?: number;
      monthlyPayment?: number;
      numberOfPayments?: number;
      apr?: number;
      startDate?: Date;
      notes?: string;
      invoiceIds?: string[];
    },
    userId: string
  ) {
    const resolvedStartDate = data.startDate ?? new Date();
    const payPlanNum = await getNextId('payplan', 'PayPlanNum');
    
    // Auto-calculate monthly payment if numberOfPayments is provided but not monthlyPayment
    const amountToFinance = data.totalAmount - (data.downPayment ?? 0);
    let numPayments = data.numberOfPayments ?? 0;
    let monthPay = data.monthlyPayment ?? 0;

    if (numPayments > 0 && monthPay === 0) {
      monthPay = amountToFinance / numPayments;
    } else if (monthPay > 0 && numPayments === 0) {
      numPayments = Math.ceil(amountToFinance / monthPay);
    }

    // Create the plan
    let planNote = data.notes ?? '';
    if (data.invoiceIds && data.invoiceIds.length > 0) {
      const invoiceNote = `Invoices: ${data.invoiceIds.join(', ')}`;
      planNote = planNote ? `${planNote}\n${invoiceNote}` : invoiceNote;
    }

    const plan = await prisma.payplan.create({
      data: {
        PayPlanNum: payPlanNum,
        PatNum: BigInt(data.patientId),
        Guarantor: BigInt(data.patientId),
        PayPlanDate: resolvedStartDate,
        APR: data.apr ?? 0,
        Note: planNote || null,
        CompletedAmt: data.downPayment ?? 0,
        PayAmt: monthPay,
        DownPayment: data.downPayment ?? 0,
        NumberOfPayments: numPayments,
        IsClosed: 0,
      },
    });

    // Distribute down payment across invoices
    if (data.downPayment && data.downPayment > 0 && data.invoiceIds && data.invoiceIds.length > 0) {
      const validInvoiceIds = data.invoiceIds.filter((id: any) => id != null);
      const invoices = await prisma.statement.findMany({
        where: { StatementNum: { in: validInvoiceIds.map((id: any) => BigInt(id)) } },
        orderBy: { StatementNum: 'asc' },
      });

      let remainingDownPayment = data.downPayment;
      
      for (const inv of invoices) {
        if (remainingDownPayment <= 0) break;
        
        const invBalance = Number(inv.BalTotal) || 0;
        if (invBalance <= 0) continue;
        
        const amountToApply = Math.min(remainingDownPayment, invBalance);
        remainingDownPayment -= amountToApply;

        const payNum = await getNextId('payment', 'PayNum');
        const payNote = JSON.stringify({
          notes: 'Down payment for payment plan',
          paymentMethod: 'Payment Plan',
          invoiceId: inv.StatementNum.toString(),
        });

        await prisma.payment.create({
          data: {
            PayNum: payNum,
            PatNum: BigInt(data.patientId),
            PayAmt: amountToApply,
            PayDate: resolvedStartDate,
            PayNote: payNote,
            SecUserNumEntry: BigInt(userId),
          },
        });
        
        const splitNum = await getNextId('paysplit', 'SplitNum');
        await prisma.paysplit.create({
          data: {
            SplitNum: splitNum,
            SplitAmt: amountToApply,
            PatNum: BigInt(data.patientId),
            DatePay: resolvedStartDate,
            PayNum: payNum,
            PayPlanNum: plan.PayPlanNum,
            DateEntry: new Date(),
            SecUserNumEntry: BigInt(userId),
          }
        });

        // Distribute amountToApply across procedurelog items
        const procLogs = await prisma.procedurelog.findMany({
          where: { StatementNum: inv.StatementNum },
          orderBy: { ProcNum: 'asc' },
        });

        let remainingForProcs = amountToApply;

        for (const proc of procLogs) {
          if (remainingForProcs <= 0) break;

          const billingNote = parseJson<any>(proc.BillingNote);
          const procFee = Number(proc.ProcFee) || 0;
          const currentPaid = Number(billingNote.paidAmount) || 0;
          const insPortion = Number(billingNote.insPortion) || 0;
          const writeoff = Number(billingNote.writeoff) || 0;
          
          const maxToApply = procFee - insPortion - writeoff - currentPaid;
          if (maxToApply <= 0) continue;
          
          const appliedToProc = Math.min(remainingForProcs, maxToApply);
          remainingForProcs -= appliedToProc;
          
          billingNote.paidAmount = currentPaid + appliedToProc;
          
          await prisma.procedurelog.update({
            where: { ProcNum: proc.ProcNum },
            data: { BillingNote: buildJson(billingNote) },
          });
        }

        // Trigger recalculation of the invoice
        await invoiceService.recalculateInvoice(inv.StatementNum.toString());
      }
    }

    // Generate charges
    if (numPayments > 0 && monthPay > 0) {
      const chargeData = [];
      let currentPrincipal = amountToFinance;
      
      let baseChargeNum = await getNextId('payplancharge', 'PayPlanChargeNum');
      
      for (let i = 0; i < numPayments; i++) {
        const chargeDate = new Date(resolvedStartDate);
        chargeDate.setMonth(chargeDate.getMonth() + i + 1); // Payments typically start next month
        
        let principalForMonth = monthPay;
        if (i === numPayments - 1) {
          principalForMonth = currentPrincipal; // Last payment covers remaining principal
        }
        
        chargeData.push({
          PayPlanChargeNum: baseChargeNum + BigInt(i),
          PayPlanNum: payPlanNum,
          Guarantor: BigInt(data.patientId),
          PatNum: BigInt(data.patientId),
          ChargeDate: chargeDate,
          Principal: principalForMonth,
          Interest: 0, // Simplified: interest calculations can be complex
          Note: `Installment ${i + 1} of ${numPayments}`,
        });
        
        currentPrincipal -= principalForMonth;
      }
      
      if (chargeData.length > 0) {
        await prisma.payplancharge.createMany({
          data: chargeData,
        });
      }
    }

    await logActivity(userId, 'created', 'payplan', plan.PayPlanNum.toString(), undefined, plan);

    return this.getPayPlanById(plan.PayPlanNum.toString());
  }

  async updatePayPlan(
    payPlanId: string,
    updates: {
      isClosed?: boolean;
      notes?: string;
    },
    userId: string
  ) {
    const plan = await prisma.payplan.findUnique({
      where: { PayPlanNum: BigInt(payPlanId) },
    });
    if (!plan) {
      throw new NotFoundError('Payment plan not found');
    }

    const updated = await prisma.payplan.update({
      where: { PayPlanNum: plan.PayPlanNum },
      data: {
        IsClosed: updates.isClosed !== undefined ? (updates.isClosed ? 1 : 0) : undefined,
        Note: updates.notes ?? undefined,
      },
    });

    await logActivity(userId, 'updated', 'payplan', payPlanId, plan, updated);

    return this.getPayPlanById(payPlanId);
  }

  async getPayPlansByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllPayPlans(page, limit, { patientId });
  }
}

export const payPlanService = new PayPlanService();
