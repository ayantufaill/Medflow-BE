import crypto from 'crypto';
import { prisma } from '../config/db';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { uploadToS3, deleteFromS3 } from '../utils/s3.util';

type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'partially_paid'
  | 'accepted'
  | 'denied'
  | 'rejected'
  | 'cancelled';

type ClaimMeta = {
  invoiceId?: string;
  insuranceCompanyId?: string;
  insuranceType?: string;
  status?: ClaimStatus;
  claimAmount?: number;
  submittedAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  policyNumber?: string;
  notes?: string;
  submissionDate?: string;
  deniedDate?: string;
  denialReason?: string;
  paidDate?: string;
  corrections?: Record<string, unknown>;
};

type ClaimFilters = {
  search?: string;
  status?: string;
  patientId?: string;
  invoiceId?: string;
  insuranceCompanyId?: string;
  insuranceType?: string;
  startDate?: string;
  endDate?: string;
  deniedOnly?: boolean;
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

const toBigInt = (value?: string | null): bigint | null => {
  if (!value) return null;
  return /^\d+$/.test(value) ? BigInt(value) : null;
};

const normalizeClaimStatus = (value?: string | null): ClaimStatus => {
  const normalized = String(value || '').toLowerCase();
  switch (normalized) {
    case 'submitted':
      return 'submitted';
    case 'pending':
      return 'pending';
    case 'paid':
      return 'paid';
    case 'partial':
      return 'partial';
    case 'partially_paid':
      return 'partially_paid';
    case 'accepted':
      return 'accepted';
    case 'denied':
      return 'denied';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'draft';
  }
};

const claimStatusToCode = (status?: string | null): string => {
  switch (normalizeClaimStatus(status)) {
    case 'submitted':
      return 'S';
    case 'pending':
      return 'P';
    case 'paid':
    case 'accepted':
      return 'R';
    case 'partial':
    case 'partially_paid':
      return 'T';
    case 'denied':
      return 'D';
    case 'rejected':
      return 'X';
    case 'cancelled':
      return 'C';
    default:
      return 'H';
  }
};

const claimCodeToStatus = (code?: string | null): ClaimStatus => {
  switch ((code || '').toUpperCase()) {
    case 'S':
      return 'submitted';
    case 'P':
      return 'pending';
    case 'R':
      return 'paid';
    case 'T':
      return 'partial';
    case 'D':
      return 'denied';
    case 'X':
      return 'rejected';
    case 'C':
      return 'cancelled';
    default:
      return 'draft';
  }
};

const buildInsuranceView = (row: any) => {
  if (!row) return null;
  return {
    _id: row.CarrierNum?.toString() ?? null,
    name: row.CarrierName ?? '',
    payerId: row.ElectID ?? null,
  };
};

const buildInvoiceView = (row: any, patientById: Map<string, any>) => {
  if (!row) return null;
  const patient = row.PatNum ? patientById.get(row.PatNum.toString()) : null;
  return {
    _id: row.StatementNum.toString(),
    invoiceNumber: row.ShortGUID ?? null,
    patientId: patient ?? row.PatNum?.toString() ?? null,
    totalAmount: Number(row.BalTotal) || 0,
    balanceDue: Number(row.BalTotal) || 0,
  };
};

const mapDocument = (doc: any, claimId: string) => {
  const meta = parseJson<Record<string, any>>(doc.Note);
  return {
    _id: doc.DocNum.toString(),
    id: doc.DocNum.toString(),
    claimId,
    patientId: doc.PatNum?.toString() ?? null,
    documentName: doc.Description ?? doc.FileName ?? 'Document',
    documentType: meta.documentType ?? 'claim_attachment',
    storagePath: meta.storagePath ?? doc.FileName ?? null,
    fileSizeInBytes: meta.fileSizeInBytes ?? null,
    mimeType: meta.mimeType ?? null,
    description: meta.description ?? null,
    uploadedBy: meta.uploadedBy ?? doc.UserNum?.toString() ?? null,
    createdAt: doc.DateCreated ?? null,
  };
};

export class ClaimService {
  private async generateClaimNumber() {
    const recent = await prisma.claim.findMany({
      where: {
        ClaimType: { not: 'PreAuth' },
        OR: [
          { PreAuthString: { startsWith: 'CLM' } },
          { PriorAuthorizationNumber: { startsWith: 'CLM' } },
        ],
      },
      orderBy: { ClaimNum: 'desc' },
      take: 100,
    });

    let maxNumber = 0;
    for (const row of recent) {
      const value = row.PreAuthString ?? row.PriorAuthorizationNumber ?? '';
      const match = value.match(/(\d+)$/);
      const numeric = match?.[1] ? parseInt(match[1], 10) : 0;
      if (numeric > maxNumber) {
        maxNumber = numeric;
      }
    }

    return `CLM${String(maxNumber + 1).padStart(6, '0')}`;
  }

  private async createStatusHistoryEntry(
    claimId: string,
    status: ClaimStatus,
    note: string | undefined,
    userId?: string
  ) {
    const claimTrackingNum = await getNextId('claimtracking', 'ClaimTrackingNum');

    await prisma.claimtracking.create({
      data: {
        ClaimTrackingNum: claimTrackingNum,
        ClaimNum: BigInt(claimId),
        TrackingType: 'status',
        DateTimeEntry: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
        Note: note ?? `Status changed to ${status}`,
      },
    });
  }

  private mapClaim(row: any, meta: ClaimMeta, context: { invoice?: any; insurance?: any }) {
    const status = normalizeClaimStatus(meta.status ?? claimCodeToStatus(row.ClaimStatus));
    const patient = row.patient ? mapPatientToApi(row.patient) : null;

    return {
      _id: row.ClaimNum.toString(),
      id: row.ClaimNum.toString(),
      claimNumber: row.PreAuthString ?? row.PriorAuthorizationNumber ?? row.ClaimIdentifier ?? row.ClaimNum.toString(),
      claimCode: row.PreAuthString ?? row.PriorAuthorizationNumber ?? row.ClaimIdentifier ?? row.ClaimNum.toString(),
      patientRefId: row.PatNum?.toString() ?? null,
      patientId: patient ?? row.PatNum?.toString() ?? null,
      patient,
      invoiceRefId: meta.invoiceId ?? null,
      invoiceId: context.invoice ?? meta.invoiceId ?? null,
      invoice: context.invoice ?? null,
      insuranceCompanyRefId: meta.insuranceCompanyId ?? null,
      insuranceCompanyId: context.insurance ?? meta.insuranceCompanyId ?? null,
      insuranceCompany: context.insurance ?? null,
      insuranceType: meta.insuranceType ?? 'primary',
      status,
      submissionDate: meta.submissionDate ? new Date(meta.submissionDate) : row.DateSent ?? row.DateService ?? null,
      submittedDate: meta.submissionDate ? new Date(meta.submissionDate) : row.DateSent ?? row.DateService ?? null,
      submittedAmount:
        Number(meta.submittedAmount ?? meta.claimAmount ?? meta.totalAmount ?? row.ClaimFee ?? row.InsPayEst) || 0,
      claimAmount: Number(meta.claimAmount ?? meta.totalAmount ?? row.ClaimFee ?? row.InsPayEst) || 0,
      totalAmount: Number(meta.totalAmount ?? meta.claimAmount ?? row.ClaimFee ?? row.InsPayEst) || 0,
      paidAmount: Number(meta.paidAmount ?? row.InsPayAmt) || 0,
      patientResponsibility: Number(meta.patientResponsibility ?? row.DedApplied) || 0,
      denialReason: meta.denialReason ?? row.ReasonUnderPaid ?? null,
      deniedDate: meta.deniedDate ? new Date(meta.deniedDate) : null,
      denialDate: meta.deniedDate ? new Date(meta.deniedDate) : null,
      paidDate: meta.paidDate ? new Date(meta.paidDate) : null,
      policyNumber: meta.policyNumber ?? row.RefNumString ?? null,
      notes: meta.notes ?? row.ClaimNote ?? null,
      createdAt: row.SecDateEntry ?? row.DateService ?? null,
      updatedAt: row.SecDateTEdit ?? row.DateService ?? null,
    };
  }

  private async buildInvoiceContext(invoiceIds: string[]) {
    const invoicePkIds = invoiceIds
      .map((id) => toBigInt(id))
      .filter((id): id is bigint => id !== null);

    const invoices = invoicePkIds.length
      ? await prisma.statement.findMany({
          where: {
            StatementNum: { in: invoicePkIds },
          },
        })
      : [];

    const patientIds = Array.from(
      new Set(
        invoices
          .map((invoice) => invoice.PatNum?.toString())
          .filter((value): value is string => Boolean(value))
      )
    );

    const patients = patientIds.length
      ? await prisma.patient.findMany({
          where: {
            PatNum: {
              in: patientIds.map((id) => BigInt(id)),
            },
          },
        })
      : [];

    const patientById = new Map(patients.map((patient) => [patient.PatNum.toString(), mapPatientToApi(patient)]));

    return new Map(invoices.map((invoice) => [invoice.StatementNum.toString(), buildInvoiceView(invoice, patientById)]));
  }

  private async buildInsuranceContext(insuranceCompanyIds: string[]) {
    const insurancePks = insuranceCompanyIds
      .map((id) => toBigInt(id))
      .filter((id): id is bigint => id !== null);

    const companies = insurancePks.length
      ? await prisma.carrier.findMany({ where: { CarrierNum: { in: insurancePks } } })
      : [];

    return new Map(companies.map((item) => [item.CarrierNum.toString(), buildInsuranceView(item)]));
  }

  private async getClaimRecord(claimId: string) {
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claimId) },
      include: { patient: true },
    });

    if (!claim || claim.ClaimType === 'PreAuth') {
      throw new NotFoundError('Claim not found');
    }

    return claim;
  }

  async getAllClaims(page = 1, limit = 10, filters: ClaimFilters = {}) {
    const where: any = {
      ClaimType: { not: 'PreAuth' },
    };

    if (filters.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }

    if (filters.startDate || filters.endDate) {
      where.DateService = {};
      if (filters.startDate) where.DateService.gte = new Date(filters.startDate);
      if (filters.endDate) where.DateService.lte = new Date(filters.endDate);
    }

    const rows = await prisma.claim.findMany({
      where,
      include: { patient: true },
      orderBy: { DateService: 'desc' },
    });

    const metas = rows.map((row) => parseJson<ClaimMeta>(row.Narrative));

    const invoiceIds = Array.from(
      new Set(metas.map((meta) => meta.invoiceId).filter((value): value is string => Boolean(value)))
    );
    const insuranceIds = Array.from(
      new Set(
        metas
          .map((meta) => meta.insuranceCompanyId)
          .filter((value): value is string => Boolean(value))
      )
    );

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext(invoiceIds),
      this.buildInsuranceContext(insuranceIds),
    ]);

    let claims = rows.map((row, index) => {
      const meta = metas[index] ?? {};
      const invoice = meta.invoiceId ? invoiceById.get(meta.invoiceId) : null;
      const insurance = meta.insuranceCompanyId ? insuranceById.get(meta.insuranceCompanyId) : null;
      return this.mapClaim(row, meta, {
        invoice,
        insurance,
      });
    });

    if (filters.invoiceId) {
      claims = claims.filter(
        (claim) => claim.invoiceRefId === filters.invoiceId || claim.invoice?._id === filters.invoiceId
      );
    }

    if (filters.insuranceCompanyId) {
      claims = claims.filter(
        (claim) =>
          claim.insuranceCompanyRefId === filters.insuranceCompanyId ||
          claim.insuranceCompany?._id === filters.insuranceCompanyId
      );
    }

    if (filters.insuranceType) {
      const insuranceType = String(filters.insuranceType).toLowerCase();
      claims = claims.filter((claim) => String(claim.insuranceType || '').toLowerCase() === insuranceType);
    }

    if (filters.status) {
      const status = normalizeClaimStatus(filters.status);
      claims = claims.filter((claim) => normalizeClaimStatus(claim.status) === status);
    }

    if (filters.deniedOnly) {
      claims = claims.filter((claim) => normalizeClaimStatus(claim.status) === 'denied');
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      claims = claims.filter((claim) => {
        const patientName = `${claim.patient?.firstName || ''} ${claim.patient?.lastName || ''}`.trim();
        return [
          claim.claimNumber,
          claim.claimCode,
          claim.status,
          patientName,
          claim.invoice?.invoiceNumber,
          claim.insuranceCompany?.name,
          claim.notes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    const total = claims.length;
    const skip = (page - 1) * limit;
    const paged = claims.slice(skip, skip + limit);

    return {
      claims: paged,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getClaimById(claimId: string) {
    const row = await this.getClaimRecord(claimId);
    const meta = parseJson<ClaimMeta>(row.Narrative);

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext(meta.invoiceId ? [meta.invoiceId] : []),
      this.buildInsuranceContext(meta.insuranceCompanyId ? [meta.insuranceCompanyId] : []),
    ]);

    const claim = this.mapClaim(row, meta, {
      invoice: meta.invoiceId ? invoiceById.get(meta.invoiceId) : null,
      insurance: meta.insuranceCompanyId ? insuranceById.get(meta.insuranceCompanyId) : null,
    });

    return claim;
  }

  async createClaimFromInvoice(
    invoiceId: string,
    data: {
      insuranceCompanyId?: string;
      insuranceType?: string;
      claimAmount?: number;
      submittedAmount?: number;
      policyNumber?: string;
      notes?: string;
    },
    userId?: string
  ) {
    const invoice = await prisma.statement.findUnique({
      where: { StatementNum: BigInt(invoiceId) },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const existing = await prisma.claim.findFirst({
      where: {
        ClaimType: { not: 'PreAuth' },
        Narrative: { contains: `\"invoiceId\":\"${invoiceId}\"` },
      },
    });

    if (existing) {
      throw new ConflictError('Claim already exists for this invoice');
    }

    const invoiceMeta = parseJson<Record<string, any>>(invoice.NoteBold);
    const status: ClaimStatus = 'draft';
    const claimAmount = Number(data.claimAmount ?? data.submittedAmount ?? invoice.BalTotal) || 0;
    const claimNumber = await this.generateClaimNumber();

    const claimMeta: ClaimMeta = {
      invoiceId,
      insuranceCompanyId: data.insuranceCompanyId ?? invoiceMeta.insuranceCompanyId ?? undefined,
      insuranceType: data.insuranceType ?? 'primary',
      status,
      claimAmount,
      submittedAmount: Number(data.submittedAmount ?? claimAmount) || claimAmount,
      totalAmount: claimAmount,
      paidAmount: 0,
      patientResponsibility: 0,
      policyNumber: data.policyNumber,
      notes: data.notes,
    };

    const claimNum = await getNextId('claim', 'ClaimNum');
    const created = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: invoice.PatNum ?? null,
        ClaimType: data.insuranceType ?? 'Primary',
        ClaimStatus: claimStatusToCode(status),
        DateService: new Date(),
        ClaimFee: claimAmount,
        InsPayEst: claimAmount,
        InsPayAmt: 0,
        DedApplied: 0,
        PreAuthString: claimNumber,
        PriorAuthorizationNumber: claimNumber,
        ClaimIdentifier: claimNumber,
        ClaimNote: data.notes ?? null,
        Narrative: buildJson(claimMeta),
      },
      include: { patient: true },
    });

    await this.createStatusHistoryEntry(created.ClaimNum.toString(), status, 'Claim created from invoice', userId);

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext([invoiceId]),
      this.buildInsuranceContext(claimMeta.insuranceCompanyId ? [claimMeta.insuranceCompanyId] : []),
    ]);

    return this.mapClaim(created, claimMeta, {
      invoice: invoiceById.get(invoiceId),
      insurance: claimMeta.insuranceCompanyId ? insuranceById.get(claimMeta.insuranceCompanyId) : null,
    });
  }

  async updateClaim(
    claimId: string,
    updates: Partial<{
      insuranceCompanyId: string;
      invoiceId: string;
      insuranceType: string;
      status: ClaimStatus;
      claimAmount: number;
      submittedAmount: number;
      totalAmount: number;
      paidAmount: number;
      patientResponsibility: number;
      policyNumber: string;
      notes: string;
      submissionDate: Date;
      deniedDate: Date | null;
      denialReason: string | null;
      paidDate: Date;
      corrections: Record<string, unknown>;
    }>,
    userId?: string
  ) {
    const existing = await this.getClaimRecord(claimId);
    const currentMeta = parseJson<ClaimMeta>(existing.Narrative);

    const previousStatus = normalizeClaimStatus(currentMeta.status ?? claimCodeToStatus(existing.ClaimStatus));
    const nextStatus = updates.status
      ? normalizeClaimStatus(updates.status)
      : previousStatus;

    const nextMeta: ClaimMeta = {
      ...currentMeta,
      insuranceCompanyId: updates.insuranceCompanyId ?? currentMeta.insuranceCompanyId,
      invoiceId: updates.invoiceId ?? currentMeta.invoiceId,
      insuranceType: updates.insuranceType ?? currentMeta.insuranceType,
      status: nextStatus,
      claimAmount: updates.claimAmount ?? currentMeta.claimAmount,
      submittedAmount: updates.submittedAmount ?? currentMeta.submittedAmount,
      totalAmount: updates.totalAmount ?? currentMeta.totalAmount,
      paidAmount: updates.paidAmount ?? currentMeta.paidAmount,
      patientResponsibility: updates.patientResponsibility ?? currentMeta.patientResponsibility,
      policyNumber: updates.policyNumber ?? currentMeta.policyNumber,
      notes: updates.notes ?? currentMeta.notes,
      submissionDate:
        updates.submissionDate !== undefined
          ? updates.submissionDate.toISOString()
          : nextStatus === 'submitted' && !currentMeta.submissionDate
            ? new Date().toISOString()
            : currentMeta.submissionDate,
      deniedDate:
        updates.deniedDate !== undefined
          ? updates.deniedDate
            ? updates.deniedDate.toISOString()
            : undefined
          : nextStatus === 'denied' && !currentMeta.deniedDate
            ? new Date().toISOString()
            : currentMeta.deniedDate,
      denialReason:
        updates.denialReason !== undefined
          ? updates.denialReason ?? undefined
          : currentMeta.denialReason,
      paidDate:
        updates.paidDate !== undefined
          ? updates.paidDate.toISOString()
          : nextStatus === 'paid' && !currentMeta.paidDate
            ? new Date().toISOString()
            : currentMeta.paidDate,
      corrections: updates.corrections ?? currentMeta.corrections,
    };

    const updated = await prisma.claim.update({
      where: { ClaimNum: existing.ClaimNum },
      data: {
        ClaimType: updates.insuranceType ?? undefined,
        ClaimStatus: claimStatusToCode(nextStatus),
        ClaimFee: updates.claimAmount ?? updates.totalAmount ?? undefined,
        InsPayEst: updates.submittedAmount ?? undefined,
        InsPayAmt: updates.paidAmount ?? undefined,
        DedApplied: updates.patientResponsibility ?? undefined,
        DateSent: nextMeta.submissionDate ? new Date(nextMeta.submissionDate) : existing.DateSent,
        DateReceived: nextStatus === 'paid' || nextStatus === 'partial'
          ? (nextMeta.paidDate ? new Date(nextMeta.paidDate) : new Date())
          : existing.DateReceived,
        ClaimNote: updates.notes ?? undefined,
        Narrative: buildJson(nextMeta),
      },
      include: { patient: true },
    });

    if (previousStatus !== nextStatus) {
      await this.createStatusHistoryEntry(
        claimId,
        nextStatus,
        updates.notes ?? `Status changed from ${previousStatus} to ${nextStatus}`,
        userId
      );
    }

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext(nextMeta.invoiceId ? [nextMeta.invoiceId] : []),
      this.buildInsuranceContext(nextMeta.insuranceCompanyId ? [nextMeta.insuranceCompanyId] : []),
    ]);

    return this.mapClaim(updated, nextMeta, {
      invoice: nextMeta.invoiceId ? invoiceById.get(nextMeta.invoiceId) : null,
      insurance: nextMeta.insuranceCompanyId ? insuranceById.get(nextMeta.insuranceCompanyId) : null,
    });
  }

  async validateClaim(claimId: string) {
    const claim = await this.getClaimById(claimId);
    const errors: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];

    if (!claim.patientRefId) {
      errors.push({ code: 'MISSING_PATIENT', message: 'Claim is missing patient information.' });
    }

    if (!claim.invoiceRefId) {
      errors.push({ code: 'MISSING_INVOICE', message: 'Claim must be linked to an invoice.' });
    }

    if (!claim.insuranceCompanyRefId) {
      errors.push({ code: 'MISSING_INSURANCE', message: 'Claim must have an insurance company.' });
    }

    if ((claim.submittedAmount ?? 0) <= 0) {
      warnings.push({ code: 'ZERO_AMOUNT', message: 'Submitted amount is zero.' });
    }

    if (claim.status !== 'draft' && claim.status !== 'pending') {
      warnings.push({ code: 'STATUS_CHECK', message: `Claim is currently in '${claim.status}' status.` });
    }

    return {
      claimId,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async submitClaim(claimId: string, userId?: string) {
    const claim = await this.updateClaim(
      claimId,
      {
        status: 'submitted',
        submissionDate: new Date(),
      },
      userId
    );

    return {
      claim,
      submittedAt: claim.submissionDate,
      message: 'Claim submitted successfully',
    };
  }

  async getClaimStatusHistory(claimId: string) {
    await this.getClaimRecord(claimId);

    const history = await prisma.claimtracking.findMany({
      where: { ClaimNum: BigInt(claimId) },
      orderBy: { DateTimeEntry: 'asc' },
      include: { userod: true },
    });

    return history.map((entry) => {
      const match = (entry.Note || '').match(/status\s*(?:changed\s*to)?\s*([a-z_]+)/i);
      const status = match ? normalizeClaimStatus(match[1]) : 'pending';

      return {
        _id: entry.ClaimTrackingNum.toString(),
        status,
        note: entry.Note ?? null,
        timestamp: entry.DateTimeEntry ?? null,
        changedBy: entry.userod
          ? {
              _id: entry.userod.UserNum.toString(),
              firstName: entry.userod.UserName ?? '',
              lastName: '',
            }
          : null,
      };
    });
  }

  async resubmitClaim(
    claimId: string,
    corrections: {
      workflowType?: string;
      correctionNotes?: string;
      appealReason?: string;
      correctedFields?: Record<string, unknown>;
    },
    userId?: string
  ) {
    const claim = await this.getClaimById(claimId);

    if (claim.status !== 'denied' && claim.status !== 'rejected') {
      throw new BadRequestError('Only denied or rejected claims can be resubmitted');
    }

    const notes = [corrections.correctionNotes, corrections.appealReason]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    const updated = await this.updateClaim(
      claimId,
      {
        status: 'submitted',
        submissionDate: new Date(),
        deniedDate: null,
        denialReason: null,
        corrections: {
          workflowType: corrections.workflowType ?? 'correction',
          correctionNotes: corrections.correctionNotes,
          appealReason: corrections.appealReason,
          correctedFields: corrections.correctedFields,
          resubmittedAt: new Date().toISOString(),
        },
        notes: notes || claim.notes || undefined,
      },
      userId
    );

    await this.createStatusHistoryEntry(
      claimId,
      'submitted',
      `Claim resubmitted (${corrections.workflowType || 'correction'})`,
      userId
    );

    return updated;
  }

  async attachDocument(
    claimId: string,
    file: Express.Multer.File,
    payload: {
      documentName?: string;
      documentType?: string;
      description?: string;
    },
    userId?: string
  ) {
    const claim = await this.getClaimRecord(claimId);

    if (!file) {
      throw new BadRequestError('File is required');
    }

    const storagePath = await uploadToS3(file, 'claim-documents');
    const docNum = await getNextId('document', 'DocNum');

    const meta = {
      claimId,
      documentType: payload.documentType ?? 'claim_attachment',
      description: payload.description ?? null,
      storagePath,
      fileSizeInBytes: file.size,
      mimeType: file.mimetype,
      uploadedBy: userId ?? null,
      checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    };

    const created = await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: claim.PatNum,
        Description: payload.documentName ?? file.originalname,
        FileName: storagePath,
        Note: buildJson(meta),
        DateCreated: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
      },
    });

    return mapDocument(created, claimId);
  }

  async getClaimDocuments(claimId: string) {
    await this.getClaimRecord(claimId);

    const rows = await prisma.document.findMany({
      where: {
        Note: { contains: `\"claimId\":\"${claimId}\"` },
      },
      orderBy: { DateCreated: 'desc' },
    });

    return rows
      .filter((doc) => {
        const meta = parseJson<Record<string, any>>(doc.Note);
        return String(meta.claimId || '') === claimId;
      })
      .map((doc) => mapDocument(doc, claimId));
  }

  async removeClaimDocument(claimId: string, documentId: string) {
    await this.getClaimRecord(claimId);

    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });

    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    const meta = parseJson<Record<string, any>>(doc.Note);
    if (String(meta.claimId || '') !== claimId) {
      throw new NotFoundError('Document not found for this claim');
    }

    await prisma.document.delete({ where: { DocNum: doc.DocNum } });
    if (meta.storagePath) {
      await deleteFromS3(String(meta.storagePath));
    }

    return { message: 'Document removed successfully' };
  }
}

export const claimService = new ClaimService();
