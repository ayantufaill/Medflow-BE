import { prisma } from '../config/db';
import { ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { invoiceService } from './invoice.service';
import { mapPatientToApi, mapProviderToApi } from '../utils/opendental-mappers.util';

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

const statusToClaimStatus = (status?: string) => {
  switch (status) {
    case 'sent':
      return 'S';
    case 'approved':
      return 'A';
    case 'declined':
      return 'R';
    case 'converted':
      return 'C';
    case 'expired':
      return 'E';
    default:
      return 'D';
  }
};

const claimStatusToStatus = (value?: string | null) => {
  switch (value) {
    case 'S':
      return 'sent';
    case 'A':
      return 'approved';
    case 'R':
      return 'declined';
    case 'C':
      return 'converted';
    case 'E':
      return 'expired';
    default:
      return 'draft';
  }
};

type ClaimMeta = {
  approvedDate?: string;
  expirationDate?: string;
  convertedToInvoiceId?: string;
  createdBy?: string;
  sentDate?: string;
  declineReason?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
};

const generateEstimateNumber = async (): Promise<string> => {
  const recent = await prisma.claim.findMany({
    where: { PreAuthString: { startsWith: 'EST' } },
    orderBy: { ClaimNum: 'desc' },
    take: 50,
  });
  let max = 0;
  for (const claim of recent) {
    const match = String(claim.PreAuthString || '').match(/\d+$/);
    const num = match ? parseInt(match[0], 10) : 0;
    if (num > max) max = num;
  }
  const next = max + 1;
  return `EST${next.toString().padStart(6, '0')}`;
};

export class EstimateService {
  private mapClaimToEstimate(claim: any, meta: ClaimMeta) {
    const fallbackTotal = Number(claim.ClaimFee) || 0;
    const lineItems =
      Array.isArray(meta.lineItems) && meta.lineItems.length > 0
        ? meta.lineItems
        : [
            {
              description: claim.ClaimNote ?? 'Estimated Service',
              quantity: 1,
              unitPrice: fallbackTotal,
              total: fallbackTotal,
            },
          ];

    return {
      _id: claim.ClaimNum.toString(),
      patientId: claim.PatNum?.toString() ?? null,
      providerId: claim.ProvTreat?.toString() ?? null,
      estimateNumber: claim.PreAuthString ?? '',
      description: claim.ClaimNote ?? '',
      estimatedAmount: Number(claim.ClaimFee) || 0,
      totalAmount: Number(claim.ClaimFee) || 0,
      insurancePortion: Number(claim.InsPayEst) || 0,
      patientPortion: Number(claim.DedApplied) || 0,
      status: claimStatusToStatus(claim.ClaimStatus),
      estimateDate: claim.DateService ?? null,
      createdDate: claim.DateService ?? null,
      validUntil: meta.expirationDate ? new Date(meta.expirationDate) : null,
      expirationDate: meta.expirationDate ? new Date(meta.expirationDate) : null,
      approvedDate: meta.approvedDate ? new Date(meta.approvedDate) : null,
      sentDate: meta.sentDate ? new Date(meta.sentDate) : null,
      declineReason: meta.declineReason ?? null,
      convertedToInvoiceId: meta.convertedToInvoiceId ?? null,
      createdBy: meta.createdBy ?? null,
      lineItems,
    };
  }

  private async enrichEstimate(estimate: any) {
    const [patient, provider] = await Promise.all([
      estimate.patientId && /^\d+$/.test(estimate.patientId)
        ? prisma.patient.findUnique({ where: { PatNum: BigInt(estimate.patientId) } })
        : null,
      estimate.providerId && /^\d+$/.test(estimate.providerId)
        ? prisma.provider.findUnique({
            where: { ProvNum: BigInt(estimate.providerId) },
            include: { definition: true },
          })
        : null,
    ]);

    return {
      ...estimate,
      patient: patient ? mapPatientToApi(patient) : null,
      provider: provider
        ? mapProviderToApi(provider, {
            specialtyName: provider.definition?.ItemName ?? null,
            userId: provider.CustomID ?? null,
          })
        : null,
    };
  }

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
    const where: any = {
      ClaimType: 'PreAuth',
    };

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);
    if (filters.status) where.ClaimStatus = statusToClaimStatus(filters.status);
    if (filters.search) {
      where.OR = [
        { ClaimNote: { contains: filters.search, mode: 'insensitive' } },
        { PreAuthString: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.DateService = {};
      if (filters.startDate) where.DateService.gte = new Date(filters.startDate);
      if (filters.endDate) where.DateService.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { DateService: 'desc' },
        skip,
        take: limit,
      }),
      prisma.claim.count({ where }),
    ]);

    const estimates = await Promise.all(
      rows.map(async (row) => {
        const meta = parseJson<ClaimMeta>(row.Narrative);
        return this.enrichEstimate(this.mapClaimToEstimate(row, meta));
      })
    );

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
    const estimate = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(estimateId) },
    });
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }
    const meta = parseJson<ClaimMeta>(estimate.Narrative);
    return this.enrichEstimate(this.mapClaimToEstimate(estimate, meta));
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
      status?: 'draft' | 'sent' | 'approved' | 'declined' | 'converted' | 'expired';
      createdDate?: Date;
      expirationDate?: Date;
    },
    createdBy: string
  ) {
    const estimateNumber = data.estimateNumber || (await generateEstimateNumber());
    const createdDate = data.createdDate || new Date();
    const expirationDate = data.expirationDate || new Date(createdDate.getTime() + 30 * 86400000);

    const claimNum = await getNextId('claim', 'ClaimNum');
    const meta: ClaimMeta = {
      expirationDate: expirationDate.toISOString(),
      createdBy,
    };

    const estimate = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: BigInt(data.patientId),
        ProvTreat: data.providerId ? BigInt(data.providerId) : null,
        ClaimType: 'PreAuth',
        ClaimStatus: statusToClaimStatus(data.status),
        DateService: createdDate,
        ClaimNote: data.description,
        ClaimFee: data.estimatedAmount,
        InsPayEst: data.insurancePortion ?? 0,
        DedApplied: data.patientPortion ?? 0,
        PreAuthString: estimateNumber,
        Narrative: buildJson(meta),
      },
    });

    await logActivity(
      createdBy,
      'created',
      'estimates',
      estimate.ClaimNum.toString(),
      undefined,
      this.mapClaimToEstimate(estimate, meta),
      undefined,
      undefined,
      'low'
    );

    return this.mapClaimToEstimate(estimate, meta);
  }

  async updateEstimate(
    estimateId: string,
    updates: Partial<{
      providerId: string;
      description: string;
      estimatedAmount: number;
      insurancePortion: number;
      patientPortion: number;
      status: 'draft' | 'sent' | 'approved' | 'declined' | 'converted' | 'expired';
      expirationDate: Date;
      approvedDate: Date;
      sentDate: Date;
      declineReason: string;
    }>,
    userId: string
  ) {
    const estimate = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(estimateId) },
    });
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const meta = parseJson<ClaimMeta>(estimate.Narrative);
    const nextMeta: ClaimMeta = {
      ...meta,
      approvedDate: updates.approvedDate ? updates.approvedDate.toISOString() : meta.approvedDate,
      expirationDate: updates.expirationDate ? updates.expirationDate.toISOString() : meta.expirationDate,
      sentDate: updates.sentDate ? updates.sentDate.toISOString() : meta.sentDate,
      declineReason: updates.declineReason ?? meta.declineReason,
    };

    const updated = await prisma.claim.update({
      where: { ClaimNum: BigInt(estimateId) },
      data: {
        ProvTreat: updates.providerId ? BigInt(updates.providerId) : undefined,
        ClaimNote: updates.description ?? undefined,
        ClaimFee: updates.estimatedAmount ?? undefined,
        InsPayEst: updates.insurancePortion ?? undefined,
        DedApplied: updates.patientPortion ?? undefined,
        ClaimStatus: updates.status ? statusToClaimStatus(updates.status) : undefined,
        Narrative: buildJson(nextMeta),
      },
    });

    await logActivity(
      userId,
      'updated',
      'estimates',
      estimateId,
      this.mapClaimToEstimate(estimate, meta),
      this.mapClaimToEstimate(updated, nextMeta),
      undefined,
      undefined,
      'low'
    );

    return this.mapClaimToEstimate(updated, nextMeta);
  }

  async deleteEstimate(estimateId: string, userId: string) {
    const estimate = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(estimateId) },
    });
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const meta = parseJson<ClaimMeta>(estimate.Narrative);
    await prisma.claim.delete({ where: { ClaimNum: BigInt(estimateId) } });

    await logActivity(
      userId,
      'deleted',
      'estimates',
      estimateId,
      this.mapClaimToEstimate(estimate, meta),
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
    const estimate = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(estimateId) },
    });
    if (!estimate) {
      throw new NotFoundError('Estimate not found');
    }

    const meta = parseJson<ClaimMeta>(estimate.Narrative);

    const invoice = await invoiceService.createInvoiceFromAppointment(
      appointmentId,
      {
        dueDate,
        insuranceCompanyId: undefined,
        providerId: estimate.ProvTreat?.toString() ?? undefined,
        notes: estimate.ClaimNote ?? undefined,
        copayAmount: 0,
      },
      userId
    );

    const nextMeta: ClaimMeta = {
      ...meta,
      convertedToInvoiceId: invoice._id,
      approvedDate: meta.approvedDate ?? new Date().toISOString(),
    };

    await prisma.claim.update({
      where: { ClaimNum: BigInt(estimateId) },
      data: {
        ClaimStatus: statusToClaimStatus('converted'),
        Narrative: buildJson(nextMeta),
      },
    });

    await logActivity(
      userId,
      'updated',
      'estimates',
      estimateId,
      undefined,
      this.mapClaimToEstimate(estimate, nextMeta),
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
      invoice,
      undefined,
      undefined,
      'low'
    );

    return invoice;
  }

  async getEstimatesByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllEstimates(page, limit, { patientId });
  }

  async sendEstimateToPatient(estimateId: string, userId: string) {
    return this.updateEstimate(
      estimateId,
      {
        status: 'sent',
        sentDate: new Date(),
      },
      userId
    );
  }

  async acceptEstimate(estimateId: string, userId: string) {
    return this.updateEstimate(
      estimateId,
      {
        status: 'approved',
        approvedDate: new Date(),
      },
      userId
    );
  }

  async declineEstimate(estimateId: string, reason: string | undefined, userId: string) {
    return this.updateEstimate(
      estimateId,
      {
        status: 'declined',
        declineReason: reason,
      },
      userId
    );
  }

  async expireEstimate(estimateId: string, userId: string) {
    return this.updateEstimate(
      estimateId,
      {
        status: 'expired',
      },
      userId
    );
  }
}

export const estimateService = new EstimateService();
