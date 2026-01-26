import { AppointmentModel } from '../models/appointment.model';
import { EstimateModel } from '../models/estimate.model';
import { InvoiceModel } from '../models/invoice.model';
import { ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

const generateEstimateNumber = async (): Promise<string> => {
  const lastEstimate = await EstimateModel.findOne()
    .sort({ estimateNumber: -1 })
    .select('estimateNumber')
    .lean();

  if (!lastEstimate?.estimateNumber) {
    return 'EST000001';
  }

  const match = String(lastEstimate.estimateNumber).match(/\d+$/);
  const lastNumber = match ? parseInt(match[0], 10) : 0;
  const nextNumber = lastNumber + 1;
  return `EST${nextNumber.toString().padStart(6, '0')}`;
};

export class EstimateService {
  async getAllEstimates(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.status) query.status = filters.status;

    if (filters.startDate || filters.endDate) {
      query.createdDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.createdDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdDate.$lte = end;
      }
    }

    const [estimates, total] = await Promise.all([
      EstimateModel.find(query)
        .sort({ createdDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EstimateModel.countDocuments(query),
    ]);

    return {
      estimates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getEstimateById(estimateId: string) {
    const estimate = await EstimateModel.findById(estimateId).lean();
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }
    return estimate;
  }

  async createEstimate(
    data: {
      patientId: string;
      providerId?: string;
      estimateNumber?: string;
      description: string;
      estimatedAmount: number;
      insurancePortion?: number;
      patientPortion?: number;
      status?: 'draft' | 'sent' | 'approved' | 'converted' | 'expired';
      createdDate?: Date;
      expirationDate?: Date;
    },
    createdBy: string
  ) {
    const estimateNumber = data.estimateNumber || (await generateEstimateNumber());
    const createdDate = data.createdDate || new Date();
    const expirationDate = data.expirationDate || new Date(createdDate.getTime() + 30 * 86400000);

    const estimate = await EstimateModel.create({
      patientId: data.patientId,
      providerId: data.providerId,
      estimateNumber,
      description: data.description,
      estimatedAmount: data.estimatedAmount,
      insurancePortion: data.insurancePortion ?? 0,
      patientPortion: data.patientPortion ?? 0,
      status: data.status || 'draft',
      createdDate,
      expirationDate,
      createdBy,
    });

    await logActivity(
      createdBy,
      'created',
      'estimates',
      String(estimate._id),
      undefined,
      estimate.toObject(),
      undefined,
      undefined,
      'low'
    );

    return estimate;
  }

  async updateEstimate(
    estimateId: string,
    updates: Partial<{
      providerId: string;
      description: string;
      estimatedAmount: number;
      insurancePortion: number;
      patientPortion: number;
      status: 'draft' | 'sent' | 'approved' | 'converted' | 'expired';
      expirationDate: Date;
      approvedDate: Date;
    }>,
    userId: string
  ) {
    const estimate = await EstimateModel.findById(estimateId);
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const oldData = estimate.toObject();
    Object.assign(estimate, updates);
    await estimate.save();

    await logActivity(
      userId,
      'updated',
      'estimates',
      estimateId,
      oldData,
      estimate.toObject(),
      undefined,
      undefined,
      'low'
    );

    return estimate;
  }

  async deleteEstimate(estimateId: string, userId: string) {
    const estimate = await EstimateModel.findById(estimateId);
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const oldData = estimate.toObject();
    await EstimateModel.deleteOne({ _id: estimateId });

    await logActivity(
      userId,
      'deleted',
      'estimates',
      estimateId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Estimate deleted successfully' };
  }

  async convertToInvoice(
    estimateId: string,
    appointmentId: string,
    dueDate: Date,
    userId: string
  ) {
    const estimate = await EstimateModel.findById(estimateId);
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const existingInvoice = await InvoiceModel.findOne({ appointmentId }).lean();
    if (existingInvoice) {
      throw new ConflictError('Invoice already exists for this appointment');
    }

    const invoiceNumber = await (async () => {
      const lastInvoice = await InvoiceModel.findOne()
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber')
        .lean();

      if (!lastInvoice?.invoiceNumber) {
        return 'INV000001';
      }

      const match = String(lastInvoice.invoiceNumber).match(/\d+$/);
      const lastNumber = match ? parseInt(match[0], 10) : 0;
      const nextNumber = lastNumber + 1;
      return `INV${nextNumber.toString().padStart(6, '0')}`;
    })();

    const invoice = await InvoiceModel.create({
      invoiceNumber,
      patientId: estimate.patientId,
      appointmentId,
      insuranceCompanyId: undefined,
      providerId: estimate.providerId || appointment.providerId,
      invoiceDate: new Date(),
      dueDate,
      totalAmount: estimate.estimatedAmount,
      insurancePortion: estimate.insurancePortion,
      patientPortion: estimate.patientPortion,
      copayAmount: 0,
      paidAmount: 0,
      balanceDue: estimate.estimatedAmount,
      taxAmount: 0,
      discountAmount: 0,
      status: 'draft',
      createdBy: userId,
      notes: estimate.description,
    });

    (estimate as any).status = 'converted';
    (estimate as any).convertedToInvoiceId = invoice._id;
    (estimate as any).approvedDate = estimate.approvedDate || new Date();
    await estimate.save();

    await logActivity(
      userId,
      'updated',
      'estimates',
      estimateId,
      undefined,
      estimate.toObject(),
      undefined,
      undefined,
      'low'
    );

    await logActivity(
      userId,
      'created',
      'invoices',
      String(invoice._id),
      undefined,
      invoice.toObject(),
      undefined,
      undefined,
      'low'
    );

    return invoice;
  }
}

export const estimateService = new EstimateService();
