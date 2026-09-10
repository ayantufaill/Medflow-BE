import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { staffNotificationService } from './staffNotification.service';
import { invoiceService } from './invoice.service';
import { claimService } from './claim.service';

const toBigInt = (value?: string | number | bigint | null): bigint | null => {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  return /^\d+$/.test(str) ? BigInt(str) : null;
};

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

type PaymentMeta = {
  invoiceId?: string;
  method?: string;
  paymentMethod?: string;
  paymentSource?: string;
  referenceNumber?: string;
  processorFee?: number;
  paidAt?: string;
  status?: string;
  notes?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  originalAmount?: number;
  isDeposit?: boolean;
  depositType?: string;
  isAccountCredit?: boolean;
  appliedCreditAmount?: number;
};

export class PaymentService {
  private mapPaymentToApi(row: any) {
    const meta = parseJson<PaymentMeta>(row.PayNote);
    const receiptNumber = meta.referenceNumber ?? row.PayNum.toString();
    const isDeposit = Boolean(meta.isDeposit || (row.paysplit && row.paysplit.some((ps: any) => Number(ps.UnearnedType) > 0)));
    const depositSplit = row.paysplit?.find((ps: any) => Number(ps.UnearnedType) > 0);
    const isPatientDeposit = Boolean(meta.isDeposit && meta.depositType !== 'insurance') ||
      Boolean(depositSplit && Number(depositSplit.UnearnedType) === 1);
    const isVoided = String(meta.status || '').toLowerCase() === 'void' || String(meta.status || '').toLowerCase() === 'voided';
    const amount = isVoided && meta.originalAmount ? 0 : (Number(row.PayAmt) || (meta.originalAmount ? Number(meta.originalAmount) : 0));

    return {
      _id: row.PayNum.toString(),
      id: row.PayNum.toString(),
      paymentId: row.PayNum.toString(),
      depositId: depositSplit?.SplitNum?.toString() ?? (isDeposit ? row.PayNum.toString() : null),
      patientId: row.PatNum?.toString() ?? null,
      invoiceId: meta.invoiceId ?? null,
      receiptNumber,
      paymentCode: receiptNumber,
      amount,
      originalAmount: meta.originalAmount ?? (isVoided ? undefined : Number(row.PayAmt)),
      method: isDeposit ? (meta.depositType === 'insurance' ? 'Insurance Deposit' : 'Patient Deposit') : (meta.method ?? meta.paymentMethod ?? null),
      paymentMethod: isDeposit ? (meta.depositType === 'insurance' ? 'Insurance Deposit' : 'Patient Deposit') : (meta.paymentMethod ?? meta.method ?? null),
      paymentSource: meta.paymentSource ?? (isDeposit ? 'deposit' : null),
      referenceNumber: meta.referenceNumber ?? null,
      processorFee: Number(meta.processorFee) || 0,
      status: meta.status ?? 'completed',
      isVoided,
      paidAt: meta.paidAt ? new Date(meta.paidAt) : row.PayDate ?? null,
      paymentDate: meta.paidAt ? new Date(meta.paidAt) : row.PayDate ?? null,
      notes: meta.notes ?? null,
      isAccountCredit: meta.isAccountCredit ?? false,
      appliedCreditAmount: meta.appliedCreditAmount ?? undefined,
      isDeposit,
      isPatientDeposit,
      depositType: meta.depositType ?? (isDeposit ? 'patient' : null),
      voidReason: meta.voidReason ?? null,
      voidedAt: meta.voidedAt ?? null,
    };
  }

  private mapInvoiceSummary(statement: any) {
    return {
      _id: statement.StatementNum.toString(),
      invoiceNumber: statement.ShortGUID ?? '',
      invoiceDate: statement.DateSent ?? null,
      dueDate: statement.DateRangeTo ?? null,
      totalAmount: Number(statement.BalTotal) || 0,
      balanceDue: Number(statement.BalTotal) || 0,
      status: statement.StatementType ?? 'draft',
    };
  }

  private async enrichPayment(payment: any) {
    const [patient, invoice] = await Promise.all([
      payment.patientId && /^\d+$/.test(payment.patientId)
        ? prisma.patient.findUnique({ where: { PatNum: BigInt(payment.patientId) } })
        : null,
      payment.invoiceId && /^\d+$/.test(payment.invoiceId)
        ? prisma.statement.findUnique({ where: { StatementNum: BigInt(payment.invoiceId) } })
        : null,
    ]);

    return {
      ...payment,
      patient: patient ? mapPatientToApi(patient) : null,
      invoice: invoice ? this.mapInvoiceSummary(invoice) : null,
    };
  }

  async getAllPayments(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      invoiceId?: string;
      paymentMethod?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    if (filters.invoiceId) {
      where.PayNote = { contains: `"invoiceId":"${filters.invoiceId}"` };
    }

    if (filters.startDate || filters.endDate) {
      where.PayDate = {};
      if (filters.startDate) where.PayDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.PayDate.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { paysplit: true },
        orderBy: { PayDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    let payments = rows.map((row) => this.mapPaymentToApi(row));
    if (filters.paymentMethod) {
      payments = payments.filter((payment) => payment.method === filters.paymentMethod);
    }
    if (filters.status) {
      payments = payments.filter((payment) => payment.status === filters.status);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      payments = payments.filter((payment) =>
        [
          payment._id,
          payment.patientId,
          payment.invoiceId,
          payment.method,
          payment.status,
          payment.notes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }

    const patientIds = Array.from(
      new Set(payments.map((p: any) => p.patientId).filter((id): id is string => Boolean(id && /^\d+$/.test(id))))
    ).map((id) => BigInt(id));

    const invoiceIds = Array.from(
      new Set(payments.map((p: any) => p.invoiceId).filter((id): id is string => Boolean(id && /^\d+$/.test(id))))
    ).map((id) => BigInt(id));

    const [patients, invoices] = await Promise.all([
      patientIds.length ? prisma.patient.findMany({ where: { PatNum: { in: patientIds } } }) : [],
      invoiceIds.length ? prisma.statement.findMany({ where: { StatementNum: { in: invoiceIds } } }) : [],
    ]);

    const patientMap = new Map(patients.map((p) => [p.PatNum.toString(), p]));
    const invoiceMap = new Map(invoices.map((i) => [i.StatementNum.toString(), i]));

    payments = payments.map((payment: any) => ({
      ...payment,
      patient: payment.patientId && patientMap.has(payment.patientId)
        ? mapPatientToApi(patientMap.get(payment.patientId)!)
        : null,
      invoice: payment.invoiceId && invoiceMap.has(payment.invoiceId)
        ? this.mapInvoiceSummary(invoiceMap.get(payment.invoiceId)!)
        : null,
    }));

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { PayNum: BigInt(paymentId) },
    });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return this.enrichPayment(this.mapPaymentToApi(payment));
  }

  async createPayment(
    data: {
      patientId: string;
      invoiceId?: string;
      amount: number;
      method?: string;
      paymentMethod?: string;
      paymentSource?: string;
      referenceNumber?: string;
      processorFee?: number;
      notes?: string;
      status?: string;
      paidAt?: Date;
      paymentDate?: string;
      procedures?: Array<{
        id?: string;
        procId?: string;
        procedureId?: string;
        allowed?: number;
        wo?: number;
        writeoff?: number;
        pay?: number;
        insPay?: number;
        ded?: number;
        deductible?: number;
        updateAllowedFee?: boolean;
        updateInsFlatPortion?: boolean;
        moveToNewClaim?: boolean;
        claimId?: string;
      }>;
    },
    userId: string
  ) {
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const resolvedMethod = data.method ?? data.paymentMethod ?? null;
    const resolvedPaidAt =
      data.paidAt ?? (data.paymentDate ? new Date(data.paymentDate) : undefined) ?? new Date();

    const methodNormalized = String(resolvedMethod || '').toLowerCase().trim();
    const isAccountCredit =
      methodNormalized.includes('account credit') ||
      methodNormalized.includes('account_credit') ||
      methodNormalized.includes('patient credit') ||
      methodNormalized === 'credit';

    const payNum = await getNextId('payment', 'PayNum');

    let paysplitData: any = undefined;

    if (isAccountCredit) {
      const splitNum1 = await getNextId('paysplit', 'SplitNum');
      const splitNum2 = await getNextId('paysplit', 'SplitNum');
      paysplitData = {
        create: [
          {
            SplitNum: splitNum1,
            PatNum: BigInt(data.patientId),
            SplitAmt: -data.amount,
            UnearnedType: BigInt(1), // Deduction from patient deposit pool
            DatePay: resolvedPaidAt,
            DateEntry: new Date(),
            SecUserNumEntry: BigInt(userId),
          },
          {
            SplitNum: splitNum2,
            PatNum: BigInt(data.patientId),
            SplitAmt: data.amount,
            DatePay: resolvedPaidAt,
            DateEntry: new Date(),
            SecUserNumEntry: BigInt(userId),
          },
        ],
      };
    }

    const payment = await prisma.payment.create({
      data: {
        PayNum: payNum,
        PatNum: BigInt(data.patientId),
        PayAmt: isAccountCredit ? 0 : data.amount,
        PayDate: resolvedPaidAt,
        PayNote: buildJson({
          invoiceId: data.invoiceId ?? null,
          method: resolvedMethod,
          paymentMethod: resolvedMethod,
          paymentSource: data.paymentSource ?? null,
          referenceNumber: data.referenceNumber ?? null,
          processorFee: data.processorFee ?? 0,
          paidAt: resolvedPaidAt.toISOString(),
          status: data.status ?? 'completed',
          notes: data.notes ?? null,
          isAccountCredit,
          appliedCreditAmount: isAccountCredit ? data.amount : undefined,
        }),
        SecUserNumEntry: BigInt(userId),
        ...(paysplitData ? { paysplit: paysplitData } : {}),
      },
    });

    // Process procedure-level flags & payments
    if (data.procedures && Array.isArray(data.procedures) && data.procedures.length > 0) {
      for (const procItem of data.procedures) {
        const procId = procItem.id || procItem.procId || procItem.procedureId;
        if (!procId) continue;
        const procNum = toBigInt(procId);
        if (!procNum) continue;

        const allowed = procItem.allowed !== undefined ? Number(procItem.allowed) : undefined;
        const pay = procItem.pay !== undefined ? Number(procItem.pay) : (procItem.insPay !== undefined ? Number(procItem.insPay) : undefined);
        const updateAllowedFee = Boolean(procItem.updateAllowedFee);
        const updateInsFlatPortion = Boolean(procItem.updateInsFlatPortion);
        const moveToNewClaim = Boolean(procItem.moveToNewClaim);

        // 1. Update allowed fee if checkbox checked
        if (updateAllowedFee && allowed !== undefined && !isNaN(allowed)) {
          const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
          if (item) {
            const itemMeta = parseJson<Record<string, any>>(item.BillingNote);
            const updatedMeta = { ...itemMeta, feeAllowed: allowed };
            await prisma.procedurelog.update({
              where: { ProcNum: procNum },
              data: { BillingNote: JSON.stringify(updatedMeta) },
            });
          }
          await prisma.claimproc.updateMany({
            where: { ProcNum: procNum },
            data: { AllowedOverride: allowed },
          });
        }

        // 2. Update Ins. Flat Portion if checkbox checked
        if (updateInsFlatPortion && pay !== undefined && !isNaN(pay)) {
          const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
          if (item) {
            const itemMeta = parseJson<Record<string, any>>(item.BillingNote);
            const updatedMeta = { ...itemMeta, insPortion: pay };
            await prisma.procedurelog.update({
              where: { ProcNum: procNum },
              data: { BillingNote: buildJson(updatedMeta) },
            });
          }
        }

        // 3. Move to new claim if checkbox checked
        if (moveToNewClaim) {
          await claimService.moveProcedureToNewClaim(procId, procItem.claimId, userId);
        }

        // 4. Record procedure payment if pay > 0
        if (pay !== undefined && !isNaN(pay) && pay > 0) {
          let targetInvoiceId = data.invoiceId;
          if (!targetInvoiceId) {
            const item = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
            targetInvoiceId = item?.StatementNum?.toString();
          }
          if (targetInvoiceId) {
            try {
              await invoiceService.markItemPaid(targetInvoiceId, procId, pay);
            } catch (e) {
              // Ignore if already marked or invoice structure differs
            }
          }
        }

        // 5. Update or create claimproc record for insurance payment tracking
        if (data.paymentSource === 'insurance_company' || (pay !== undefined && !isNaN(pay) && pay > 0)) {
          const wo = procItem.wo !== undefined ? Number(procItem.wo) : (procItem.writeoff !== undefined ? Number(procItem.writeoff) : ((procItem as any).writeOff !== undefined ? Number((procItem as any).writeOff) : undefined));
          const ded = procItem.ded !== undefined ? Number(procItem.ded) : ((procItem as any).deductible !== undefined ? Number((procItem as any).deductible) : undefined);
          const claimId = procItem.claimId ? toBigInt(procItem.claimId) : undefined;

          const claimProcWhere: any = { ProcNum: procNum };
          if (claimId) {
            claimProcWhere.ClaimNum = claimId;
          }

          const existingClaimProcs = await prisma.claimproc.findMany({ where: claimProcWhere });
          if (existingClaimProcs.length > 0) {
            for (const ecp of existingClaimProcs) {
              await prisma.claimproc.update({
                where: { ClaimProcNum: ecp.ClaimProcNum },
                data: {
                  Status: 1, // 1 = Received / Paid
                  InsPayAmt: pay !== undefined && !isNaN(pay) ? pay : ecp.InsPayAmt,
                  WriteOff: wo !== undefined && !isNaN(wo) ? wo : ecp.WriteOff,
                  DedApplied: ded !== undefined && !isNaN(ded) ? ded : ecp.DedApplied,
                  DateCP: resolvedPaidAt,
                },
              });
            }
          } else {
            const patPlan = await prisma.patplan.findFirst({
              where: { PatNum: BigInt(data.patientId), IsPending: 0 },
              orderBy: { Ordinal: 'asc' },
            });
            const proc = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
            const nextCpNum = await getNextId('claimproc', 'ClaimProcNum');
            await prisma.claimproc.create({
              data: {
                ClaimProcNum: nextCpNum,
                ProcNum: procNum,
                ClaimNum: claimId ?? null,
                PatNum: BigInt(data.patientId),
                InsSubNum: patPlan?.InsSubNum ?? null,
                ClinicNum: proc?.ClinicNum ?? null,
                ProvNum: proc?.ProvNum ?? null,
                DateCP: resolvedPaidAt,
                ProcDate: proc?.ProcDate ?? resolvedPaidAt,
                DateEntry: new Date(),
                Status: 1,
                FeeBilled: proc?.ProcFee ?? 0,
                InsPayAmt: pay !== undefined && !isNaN(pay) ? pay : 0,
                WriteOff: wo !== undefined && !isNaN(wo) ? wo : 0,
                DedApplied: ded !== undefined && !isNaN(ded) ? ded : 0,
              },
            });
          }
        }
      }
    }

    await logActivity(userId, 'created', 'payments', payment.PayNum.toString(), undefined, payment);

    await this.notifyStaffPaymentReceived(payment.PayNum, data.patientId, data.amount);

    return this.enrichPayment(this.mapPaymentToApi(payment));
  }

  /**
   * Notifies Admin-role staff of a new payment. There's no single "owner" for a payment
   * (SecUserNumEntry is just the entering user, and invoices have no CreatedBy FK), so this
   * broadcasts to the Admin usergroup instead of one specific recipient. Failures are logged,
   * not thrown, so a notification hiccup never blocks the payment itself.
   */
  private async notifyStaffPaymentReceived(payNum: bigint, patientId: string, amount: number) {
    try {
      const patient = await prisma.patient.findUnique({ where: { PatNum: BigInt(patientId) } });
      const patientName = patient ? [patient.FName, patient.LName].filter(Boolean).join(' ') : 'A patient';

      const adminGroup = await prisma.usergroup.findFirst({ where: { Description: 'Admin' } });
      if (!adminGroup) return;

      const attachments = await prisma.usergroupattach.findMany({
        where: { UserGroupNum: adminGroup.UserGroupNum },
      });

      for (const attachment of attachments) {
        if (!attachment.UserNum) continue;
        await staffNotificationService.createAndEmit({
          userNum: attachment.UserNum,
          type: 'payment_received',
          title: 'Payment received',
          body: `$${amount.toFixed(2)} from ${patientName}`,
          relatedType: 'payment',
          relatedId: payNum,
        });
      }
    } catch (error) {
      console.error(`Failed to notify staff of payment ${payNum}:`, error);
    }
  }

  async updatePayment(
    paymentId: string,
    updates: Partial<{
      amount: number;
      method: string;
      notes: string;
      status: string;
      paidAt: Date;
    }>,
    userId: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { PayNum: BigInt(paymentId) },
    });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const meta = parseJson<PaymentMeta>(payment.PayNote);
    const nextMeta: PaymentMeta = {
      ...meta,
      method: updates.method ?? meta.method,
      status: updates.status ?? meta.status,
      notes: updates.notes ?? meta.notes,
    };

    const updated = await prisma.payment.update({
      where: { PayNum: payment.PayNum },
      data: {
        PayAmt: updates.amount ?? undefined,
        PayDate: updates.paidAt ?? undefined,
        PayNote: buildJson(nextMeta),
      },
    });

    await logActivity(userId, 'updated', 'payments', paymentId, payment, updated);

    return this.enrichPayment(this.mapPaymentToApi(updated));
  }

  async deletePayment(paymentId: string, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { PayNum: BigInt(paymentId) },
    });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    await prisma.payment.delete({ where: { PayNum: payment.PayNum } });
    await logActivity(userId, 'deleted', 'payments', paymentId, payment, undefined);

    return { message: 'Payment deleted successfully' };
  }

  async applyPaymentToInvoice(
    paymentId: string,
    invoiceId: string,
    amount: number | undefined,
    userId: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { PayNum: BigInt(paymentId) },
    });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const meta = parseJson<PaymentMeta>(payment.PayNote);
    const nextMeta: PaymentMeta = {
      ...meta,
      invoiceId,
    };

    const updated = await prisma.payment.update({
      where: { PayNum: payment.PayNum },
      data: {
        PayAmt: amount ?? Number(payment.PayAmt),
        PayNote: buildJson(nextMeta),
      },
    });

    await logActivity(userId, 'updated', 'payments', paymentId, payment, updated);

    return this.enrichPayment(this.mapPaymentToApi(updated));
  }

  async getPaymentsByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllPayments(page, limit, { patientId });
  }

  async getPaymentsByInvoice(invoiceId: string, page = 1, limit = 10) {
    return this.getAllPayments(page, limit, { invoiceId });
  }

  async voidPayment(paymentId: string, reason: string | undefined, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { PayNum: BigInt(paymentId) },
      include: { paysplit: true },
    });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const meta = parseJson<PaymentMeta>(payment.PayNote);
    const isDeposit = Boolean(meta.isDeposit || (payment.paysplit && payment.paysplit.some((ps) => Number(ps.UnearnedType) > 0)));

    if (isDeposit) {
      const { depositService } = await import('./deposit.service');
      return depositService.voidDeposit(paymentId, { reason }, userId);
    }

    return this.updatePayment(
      paymentId,
      {
        status: 'void',
        notes: reason,
      },
      userId
    );
  }
}

export const paymentService = new PaymentService();
