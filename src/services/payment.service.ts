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
};

export class PaymentService {
  private mapPaymentToApi(row: any) {
    const meta = parseJson<PaymentMeta>(row.PayNote);
    const receiptNumber = meta.referenceNumber ?? row.PayNum.toString();
    return {
      _id: row.PayNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      invoiceId: meta.invoiceId ?? null,
      receiptNumber,
      paymentCode: receiptNumber,
      amount: Number(row.PayAmt) || 0,
      method: meta.method ?? meta.paymentMethod ?? null,
      paymentMethod: meta.paymentMethod ?? meta.method ?? null,
      paymentSource: meta.paymentSource ?? null,
      referenceNumber: meta.referenceNumber ?? null,
      processorFee: Number(meta.processorFee) || 0,
      status: meta.status ?? 'completed',
      paidAt: meta.paidAt ? new Date(meta.paidAt) : row.PayDate ?? null,
      paymentDate: meta.paidAt ? new Date(meta.paidAt) : row.PayDate ?? null,
      notes: meta.notes ?? null,
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

    if (filters.startDate || filters.endDate) {
      where.PayDate = {};
      if (filters.startDate) where.PayDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.PayDate.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { PayDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    let payments = rows.map((row) => this.mapPaymentToApi(row));

    if (filters.invoiceId) {
      payments = payments.filter((payment) => payment.invoiceId === filters.invoiceId);
    }
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

    const payNum = await getNextId('payment', 'PayNum');
    const payment = await prisma.payment.create({
      data: {
        PayNum: payNum,
        PatNum: BigInt(data.patientId),
        PayAmt: data.amount,
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
        }),
        SecUserNumEntry: BigInt(userId),
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
