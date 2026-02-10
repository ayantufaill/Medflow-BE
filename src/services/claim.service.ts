import { ClaimModel } from '../models/claim.model';
import { ClaimDocumentModel } from '../models/claim-document.model';
import { InvoiceModel } from '../models/invoice.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { uploadToS3, deleteFromS3 } from '../utils/s3.util';

const generateClaimNumber = async (): Promise<string> => {
  const lastClaim = await ClaimModel.findOne()
    .sort({ claimNumber: -1 })
    .select('claimNumber')
    .lean();

  if (!lastClaim?.claimNumber) {
    return 'CLM000001';
  }

  const match = String(lastClaim.claimNumber).match(/\d+$/);
  const lastNumber = match ? parseInt(match[0], 10) : 0;
  return `CLM${(lastNumber + 1).toString().padStart(6, '0')}`;
};

export class ClaimService {
  async getAllClaims(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      invoiceId?: string;
      insuranceCompanyId?: string;
      status?: string;
      deniedOnly?: boolean;
      secondaryOnly?: boolean;
      startDate?: string;
      endDate?: string;
      search?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.insuranceCompanyId) query.insuranceCompanyId = filters.insuranceCompanyId;
    if (filters.status) query.status = filters.status;
    if (filters.deniedOnly) query.status = 'denied';
    if (filters.secondaryOnly) query.payerType = 'secondary';

    if (filters.search) {
      query.$or = [
        { claimNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      query.submissionDate = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.submissionDate.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.submissionDate.$lte = end;
      }
    }

    if (filters.patientId) {
      const invoices = await InvoiceModel.find({ patientId: filters.patientId }).select('_id').lean();
      const invoiceIds = invoices.map((i) => i._id);
      query.invoiceId = { $in: invoiceIds };
    } else if (filters.invoiceId) {
      query.invoiceId = filters.invoiceId;
    }

    const [claims, total] = await Promise.all([
      ClaimModel.find(query)
        .populate({ path: 'invoiceId', populate: { path: 'patientId', select: 'firstName lastName' } })
        .populate('insuranceCompanyId', 'name')
        .sort({ submissionDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClaimModel.countDocuments(query),
    ]);

    const populated = (claims as any[]).map((c) => {
      const inv = c.invoiceId as any;
      const patient = inv?.patientId;
      return {
        ...c,
        patient,
        patientId: patient?._id || inv?.patientId,
      };
    });

    return {
      claims: populated,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getClaimById(claimId: string) {
    const claim = await ClaimModel.findById(claimId)
      .populate({ path: 'invoiceId', populate: { path: 'patientId', select: 'firstName lastName' } })
      .populate('insuranceCompanyId', 'name')
      .lean();

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const c = claim as any;
    const inv = c.invoiceId;
    const patient = inv?.patientId;
    return {
      ...c,
      patient,
      patientId: patient?._id || inv?.patientId,
    };
  }

  async createClaimFromInvoice(
    invoiceId: string,
    claimData: { insuranceCompanyId?: string; payerType?: string },
    createdBy: string
  ) {
    const invoice = await InvoiceModel.findById(invoiceId)
      .populate('patientId', 'firstName lastName')
      .lean();

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const insuranceCompanyId =
      claimData.insuranceCompanyId || (invoice as any).insuranceCompanyId;
    if (!insuranceCompanyId) {
      throw new ConflictError('Invoice has no insurance company; provide insuranceCompanyId');
    }

    const existing = await ClaimModel.findOne({ invoiceId }).lean();
    if (existing) {
      throw new ConflictError('Claim already exists for this invoice');
    }

    const claimNumber = await generateClaimNumber();
    const submittedAmount = (invoice as any).totalAmount || (invoice as any).balanceDue || 0;

    const payerType = (claimData.payerType as string) || 'primary';
    const claim = await ClaimModel.create({
      invoiceId,
      insuranceCompanyId,
      claimNumber,
      submissionDate: new Date(),
      submittedAmount,
      paidAmount: 0,
      patientResponsibility: 0,
      status: 'draft',
      payerType: ['primary', 'secondary', 'tertiary'].includes(payerType) ? payerType : 'primary',
      resubmissionCount: 0,
      createdBy,
    });

    await logActivity(createdBy, 'created', 'claims', String(claim._id), undefined, claim.toObject(), undefined, undefined, 'low');

    const populated = await ClaimModel.findById(claim._id)
      .populate('invoiceId')
      .populate('insuranceCompanyId', 'name')
      .lean();

    return populated || claim;
  }

  async updateClaim(
    claimId: string,
    updates: Partial<{
      status: string;
      paidAmount: number;
      patientResponsibility: number;
      payerType: string;
      denialReason: string;
      denialCode: string;
    }>,
    userId: string
  ) {
    const claim = await ClaimModel.findById(claimId);
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const oldData = claim.toObject();
    Object.assign(claim, updates);
    await claim.save();

    await logActivity(userId, 'updated', 'claims', claimId, oldData, claim.toObject(), undefined, undefined, 'low');

    return claim;
  }

  async validateClaim(claimId: string) {
    const claim = await ClaimModel.findById(claimId).populate('invoiceId').lean();
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!(claim as any).invoiceId) {
      errors.push('Invoice not found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async submitClaim(claimId: string, userId: string) {
    const claim = await ClaimModel.findById(claimId);
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const oldStatus = claim.status;
    (claim as any).status = 'submitted';
    (claim as any).submissionDate = new Date();
    await claim.save();

    await logActivity(userId, 'updated', 'claims', claimId, { status: oldStatus }, claim.toObject(), undefined, undefined, 'low');

    return {
      success: true,
      claim,
      message: 'Claim submitted successfully (mock - no clearinghouse integration)',
    };
  }

  async getClaimStatusHistory(claimId: string) {
    const claim = await ClaimModel.findById(claimId).lean();
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const history: { status: string; date: Date }[] = [];
    const c = claim as any;
    if (c.submissionDate) {
      history.push({ status: 'submitted', date: c.submissionDate });
    }
    history.push({ status: c.status || 'submitted', date: c.updatedAt || c.createdAt || new Date() });

    return { statusHistory: history };
  }

  async resubmitClaim(
    claimId: string,
    _corrections: Record<string, unknown>,
    userId: string
  ) {
    const claim = await ClaimModel.findById(claimId);
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    (claim as any).status = 'submitted';
    (claim as any).resubmissionCount = ((claim as any).resubmissionCount || 0) + 1;
    (claim as any).denialReason = undefined;
    (claim as any).denialCode = undefined;
    await claim.save();

    await logActivity(userId, 'updated', 'claims', claimId, undefined, claim.toObject(), undefined, undefined, 'low');

    return claim;
  }

  async getClaimDocuments(claimId: string) {
    const claim = await ClaimModel.findById(claimId).lean();
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }
    const documents = await ClaimDocumentModel.find({ claimId })
      .sort({ createdAt: -1 })
      .lean();
    return { documents };
  }

  async attachDocument(
    claimId: string,
    body: { documentName?: string; documentType?: string; description?: string },
    file: Express.Multer.File | undefined,
    userId: string
  ) {
    const claim = await ClaimModel.findById(claimId).lean();
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }
    const documentName = (body?.documentName || file?.originalname || 'Document').trim();
    if (!documentName) {
      throw new ConflictError('Document name is required');
    }
    let storagePath: string | undefined;
    let fileSizeInBytes: number | undefined;
    let mimeType: string | undefined;
    if (file?.buffer) {
      try {
        storagePath = await uploadToS3(file, 'claim-documents');
        fileSizeInBytes = file.size;
        mimeType = file.mimetype;
      } catch (err) {
        console.error('Claim document S3 upload failed:', err);
        throw new Error('Failed to upload file. Please try again.');
      }
    }
    const doc = await ClaimDocumentModel.create({
      claimId,
      documentName,
      documentType: (body?.documentType as string) || 'claim_attachment',
      storagePath,
      fileSizeInBytes,
      mimeType,
      description: body?.description,
      uploadedBy: userId,
    });
    await logActivity(userId, 'created', 'claim_documents', String(doc._id), undefined, doc.toObject(), undefined, undefined, 'low');
    return { document: doc };
  }

  async removeClaimDocument(claimId: string, documentId: string) {
    const claim = await ClaimModel.findById(claimId).lean();
    if (!claim) {
      throw new NotFoundError('Claim not found');
    }
    const doc = await ClaimDocumentModel.findOne({ _id: documentId, claimId }).lean();
    if (!doc) {
      throw new NotFoundError('Claim document not found');
    }
    if ((doc as any).storagePath) {
      await deleteFromS3((doc as any).storagePath);
    }
    await ClaimDocumentModel.deleteOne({ _id: documentId, claimId });
    return { message: 'Document removed' };
  }
}

export const claimService = new ClaimService();
