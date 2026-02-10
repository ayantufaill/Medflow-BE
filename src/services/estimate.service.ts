import crypto from 'crypto';
import { AppointmentModel } from '../models/appointment.model';
import { EstimateModel } from '../models/estimate.model';
import { InvoiceModel } from '../models/invoice.model';
import { ClaimModel } from '../models/claim.model';
import { PatientModel } from '../models/patient.model';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { emailService } from './email.service';

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
      search?: string;
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

    // Text search: estimate number or patient name/code (single word or "FirstName LastName")
    if (filters.search && filters.search.trim()) {
      const search = filters.search.trim();
      const orConditions: any[] = [
        // Match estimate number (e.g. EST000001)
        { estimateNumber: { $regex: escapeRegex(search), $options: 'i' } },
      ];

      const patientConditions: any[] = [
        { firstName: { $regex: escapeRegex(search), $options: 'i' } },
        { lastName: { $regex: escapeRegex(search), $options: 'i' } },
        { patientCode: { $regex: escapeRegex(search), $options: 'i' } },
      ];

      // Full name search: "Ayan Tufail" → match firstName + " " + lastName (or reversed)
      const parts = search.split(/\s+/).filter((p) => p.length > 0);
      if (parts.length >= 2) {
        const first = escapeRegex(parts[0]!);
        const second = escapeRegex(parts[1]!);
        patientConditions.push(
          { $and: [{ firstName: { $regex: first, $options: 'i' } }, { lastName: { $regex: second, $options: 'i' } }] },
          { $and: [{ firstName: { $regex: second, $options: 'i' } }, { lastName: { $regex: first, $options: 'i' } }] }
        );
      }

      const matchingPatients = await PatientModel.find({ $or: patientConditions })
        .select('_id')
        .lean();

      const patientIds = matchingPatients.map((p) => String(p._id));
      if (patientIds.length > 0) {
        orConditions.push({ patientId: { $in: patientIds } });
      }

      if (orConditions.length > 0) {
        if (query.$or) {
          query.$or = [...query.$or, ...orConditions];
        } else {
          query.$or = orConditions;
        }
      }
    }

    const [estimates, total] = await Promise.all([
      EstimateModel.find(query)
        .populate('patientId', 'firstName lastName')
        .sort({ createdDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EstimateModel.countDocuments(query),
    ]);

    const mapped = (estimates as any[]).map((e) => ({
      ...e,
      patient: e.patientId,
      estimateDate: e.createdDate,
      validUntil: e.expirationDate,
      totalAmount: e.estimatedAmount,
    }));

    return {
      estimates: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getEstimateById(estimateId: string) {
    const estimate = await EstimateModel.findById(estimateId)
      .populate('patientId', 'firstName lastName')
      .lean();
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }
    const e = estimate as any;
    const patient = e.patientId;
    const patientIdStr = patient?._id ? String(patient._id) : e.patientId;

    // Estimate vs actual: when converted, get linked claim paid amount
    let actualPaidAmount: number | null = null;
    let claimId: string | null = null;
    let invoiceId: string | null = null;
    if (e.convertedToInvoiceId) {
      invoiceId = String(e.convertedToInvoiceId);
      const claim = await ClaimModel.findOne({ invoiceId: e.convertedToInvoiceId }).select('_id paidAmount').lean();
      if (claim) {
        claimId = String((claim as any)._id);
        actualPaidAmount = Number((claim as any).paidAmount) || 0;
      }
    }

    return {
      ...e,
      patient,
      patientId: patientIdStr,
      estimateDate: e.createdDate,
      validUntil: e.expirationDate,
      totalAmount: e.estimatedAmount,
      lineItems: e.lineItems?.length
        ? e.lineItems
        : e.description
          ? [{ description: e.description, quantity: 1, unitPrice: e.estimatedAmount ?? 0, total: e.estimatedAmount ?? 0 }]
          : [],
      // Estimate vs actual
      convertedInvoiceId: invoiceId,
      linkedClaimId: claimId,
      actualPaidAmount,
      estimatedAmount: e.estimatedAmount,
    };
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
      patientId: string;
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

  async sendToPatient(estimateId: string, userId: string) {
    const estimate = await EstimateModel.findById(estimateId)
      .populate('patientId', 'firstName lastName email')
      .lean();
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }
    const e = estimate as any;
    const status = String(e.status || '');
    if (status !== 'draft') {
      throw new BadRequestError('Only draft estimates can be sent to the patient.');
    }
    const patient = e.patientId;
    const email = patient?.email?.trim();
    if (!email) {
      throw new BadRequestError('Patient has no email address on file. Add an email in the patient record and try again.');
    }
    const firstName = patient?.firstName || 'Patient';
    const validUntil = e.expirationDate
      ? new Date(e.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';

    const respondToken = crypto.randomBytes(24).toString('hex');
    const respondExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const port = process.env.PORT || 5000;
    const respondBaseUrl =
      process.env.BACKEND_URL || process.env.API_URL || process.env.PUBLIC_ESTIMATE_RESPOND_URL || `http://localhost:${port}/api`;

    await emailService.sendEstimateToPatient(
      email,
      firstName,
      String(e.estimateNumber),
      String(e.description || ''),
      Number(e.estimatedAmount) || 0,
      Number(e.insurancePortion) || 0,
      Number(e.patientPortion) || 0,
      validUntil,
      respondToken,
      respondBaseUrl
    );

    const estimateDoc = await EstimateModel.findById(estimateId);
    if (estimateDoc) {
      (estimateDoc as any).status = 'sent';
      (estimateDoc as any).patientResponseToken = respondToken;
      (estimateDoc as any).patientResponseTokenExpiresAt = respondExpiresAt;
      await estimateDoc.save();
      await logActivity(
        userId,
        'updated',
        'estimates',
        estimateId,
        { status: 'draft' },
        estimateDoc.toObject(),
        undefined,
        undefined,
        'low'
      );
      return estimateDoc;
    }
    throw new NotFoundError('Estimate not found');
  }

  /**
   * Record patient response (approve/decline) from email link. No auth required.
   */
  async recordPatientResponse(token: string, action: 'approve' | 'decline') {
    if (!token?.trim()) {
      throw new BadRequestError('Invalid link.');
    }
    const estimate = await EstimateModel.findOne({
      patientResponseToken: token.trim(),
    }).lean();
    if (!estimate) {
      throw new NotFoundError('This link is invalid or has already been used.');
    }
    const e = estimate as any;
    if (e.status !== 'sent') {
      throw new BadRequestError('This estimate has already been responded to.');
    }
    const expiresAt = e.patientResponseTokenExpiresAt ? new Date(e.patientResponseTokenExpiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      throw new BadRequestError('This link has expired.');
    }
    const estimateDoc = await EstimateModel.findById(e._id);
    if (!estimateDoc) {
      throw new NotFoundError('Estimate not found.');
    }
    if (action === 'approve') {
      (estimateDoc as any).status = 'approved';
      (estimateDoc as any).approvedDate = new Date();
    } else {
      (estimateDoc as any).status = 'expired';
    }
    (estimateDoc as any).patientResponseToken = undefined;
    (estimateDoc as any).patientResponseTokenExpiresAt = undefined;
    await estimateDoc.save();
    return { action, estimateNumber: e.estimateNumber };
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
