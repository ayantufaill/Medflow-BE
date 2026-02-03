import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';

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
  status?: string;
  notes?: string;
};

export class PaymentService {
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

    let payments = rows.map((row) => {
      const meta = parseJson<PaymentMeta>(row.PayNote);
      return {
        _id: row.PayNum.toString(),
        patientId: row.PatNum?.toString() ?? null,
        invoiceId: meta.invoiceId ?? null,
        amount: Number(row.PayAmt) || 0,
        method: meta.method ?? null,
        status: meta.status ?? 'completed',
        paidAt: row.PayDate ?? null,
        notes: meta.notes ?? null,
      };
    });

    if (filters.invoiceId) {
      payments = payments.filter((payment) => payment.invoiceId === filters.invoiceId);
    }
    if (filters.paymentMethod) {
      payments = payments.filter((payment) => payment.method === filters.paymentMethod);
    }
    if (filters.status) {
      payments = payments.filter((payment) => payment.status === filters.status);
    }

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

    const meta = parseJson<PaymentMeta>(payment.PayNote);
    return {
      _id: payment.PayNum.toString(),
      patientId: payment.PatNum?.toString() ?? null,
      invoiceId: meta.invoiceId ?? null,
      amount: Number(payment.PayAmt) || 0,
      method: meta.method ?? null,
      status: meta.status ?? 'completed',
      paidAt: payment.PayDate ?? null,
      notes: meta.notes ?? null,
    };
  }

  async createPayment(
    data: {
      patientId: string;
      invoiceId?: string;
      amount: number;
      method?: string;
      notes?: string;
      status?: string;
      paidAt?: Date;
    },
    userId: string
  ) {
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const payNum = await getNextId('payment', 'PayNum');
    const payment = await prisma.payment.create({
      data: {
        PayNum: payNum,
        PatNum: BigInt(data.patientId),
        PayAmt: data.amount,
        PayDate: data.paidAt ?? new Date(),
        PayNote: buildJson({
          invoiceId: data.invoiceId ?? null,
          method: data.method ?? null,
          status: data.status ?? 'completed',
          notes: data.notes ?? null,
        }),
        SecUserNumEntry: BigInt(userId),
      },
    });

    await logActivity(userId, 'created', 'payments', payment.PayNum.toString(), undefined, payment);

    return payment;
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

    return updated;
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

    return updated;
  }
}

export const paymentService = new PaymentService();
