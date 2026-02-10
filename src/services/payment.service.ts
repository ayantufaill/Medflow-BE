import { InvoiceModel } from '../models/invoice.model';
import { PaymentModel } from '../models/payment.model';
import { BadRequestError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const generatePaymentCode = async (): Promise<string> => {
  const lastPayment = await PaymentModel.findOne()
    .sort({ paymentCode: -1 })
    .select('paymentCode')
    .lean();

  if (!lastPayment?.paymentCode) {
    return 'PAY000001';
  }

  const lastCode = String(lastPayment.paymentCode);
  const match = lastCode.match(/\d+$/);
  const lastNumber = match ? parseInt(match[0], 10) : 0;
  const nextNumber = lastNumber + 1;
  return `PAY${nextNumber.toString().padStart(6, '0')}`;
};

export class PaymentService {
  async getAllPayments(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      invoiceId?: string;
      paymentMethod?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.invoiceId) query.invoiceId = filters.invoiceId;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;

    if (filters.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { paymentCode: searchRegex },
        { referenceNumber: searchRegex },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.paymentDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.paymentDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = end;
      }
    }

    const [payments, total] = await Promise.all([
      PaymentModel.find(query)
        .populate('patientId', 'firstName lastName patientCode')
        .populate('invoiceId', 'invoiceNumber totalAmount balanceDue')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentModel.countDocuments(query),
    ]);

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
    const payment = await PaymentModel.findById(paymentId)
      .populate('patientId', 'firstName lastName patientCode')
      .populate('invoiceId', 'invoiceNumber totalAmount balanceDue')
      .lean();
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    return payment;
  }

  async createPayment(
    data: {
      invoiceId: string;
      patientId: string;
      insuranceCompanyId?: string;
      amount: number;
      paymentMethod: 'cash' | 'check' | 'card' | 'ach' | 'insurance' | 'payment_plan';
      paymentSource?: 'patient' | 'insurance_company' | 'other';
      paymentDate: Date;
      referenceNumber?: string;
      processorFee?: number;
      notes?: string;
    },
    createdBy: string
  ) {
    const invoice = await InvoiceModel.findById(data.invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const paymentCode = await generatePaymentCode();
    const processorFee = data.processorFee ?? 0;
    const netAmount = roundCurrency(data.amount - processorFee);

    const balanceDue = Number(invoice.get('balanceDue') ?? 0);
    const appliedAmount = Math.min(data.amount, balanceDue);
    const unappliedAmount = roundCurrency(data.amount - appliedAmount);

    const currentPaid = Number(invoice.get('paidAmount') ?? 0);
    const updatedPaid = roundCurrency(currentPaid + appliedAmount);
    const updatedBalance = roundCurrency(Math.max(0, balanceDue - appliedAmount));

    invoice.set('paidAmount', updatedPaid);
    invoice.set('balanceDue', updatedBalance);

    const currentStatus = invoice.get('status') as unknown as string | undefined;
    if (updatedBalance === 0 && updatedPaid > 0) {
      invoice.set('status', 'paid');
    } else if (updatedPaid > 0) {
      invoice.set('status', 'partially_paid');
    } else if (currentStatus) {
      invoice.set('status', currentStatus);
    }
    await invoice.save();

    const payment = await PaymentModel.create({
      paymentCode,
      invoiceId: data.invoiceId,
      patientId: data.patientId,
      insuranceCompanyId: data.insuranceCompanyId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentSource: data.paymentSource || 'patient',
      paymentDate: data.paymentDate,
      referenceNumber: data.referenceNumber,
      processorFee,
      netAmount,
      notes: data.notes,
      createdBy,
      appliedAmount,
      unappliedAmount,
    });

    await logActivity(
      createdBy,
      'created',
      'payments',
      payment.id,
      undefined,
      payment.toObject(),
      undefined,
      undefined,
      'low'
    );

    return payment;
  }

  async applyPaymentToInvoice(
    paymentId: string,
    invoiceId: string,
    amount: number,
    userId: string
  ) {
    if (amount <= 0) {
      throw new BadRequestError('Amount must be greater than 0');
    }

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.invoiceId !== invoiceId) {
      throw new BadRequestError('Payment is not associated with this invoice');
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const available = Number(payment.get('unappliedAmount') ?? 0);
    const balanceDue = Number(invoice.get('balanceDue') ?? 0);
    const appliedAmount = Math.min(amount, available, balanceDue);

    if (appliedAmount <= 0) {
      throw new BadRequestError('No available amount to apply');
    }

    const oldPayment = payment.toObject();
    const currentApplied = Number(payment.get('appliedAmount') ?? 0);
    payment.set('appliedAmount', roundCurrency(currentApplied + appliedAmount));
    payment.set('unappliedAmount', roundCurrency(Math.max(0, available - appliedAmount)));
    await payment.save();

    const currentPaid = Number(invoice.get('paidAmount') ?? 0);
    const updatedPaid = roundCurrency(currentPaid + appliedAmount);
    const updatedBalance = roundCurrency(Math.max(0, balanceDue - appliedAmount));

    invoice.set('paidAmount', updatedPaid);
    invoice.set('balanceDue', updatedBalance);

    const currentStatus = invoice.get('status') as unknown as string | undefined;
    if (updatedBalance === 0 && updatedPaid > 0) {
      invoice.set('status', 'paid');
    } else if (updatedPaid > 0) {
      invoice.set('status', 'partially_paid');
    } else if (currentStatus) {
      invoice.set('status', currentStatus);
    }
    await invoice.save();

    await logActivity(
      userId,
      'updated',
      'payments',
      paymentId,
      oldPayment,
      payment.toObject(),
      undefined,
      undefined,
      'low'
    );

    return payment;
  }
}

export const paymentService = new PaymentService();
