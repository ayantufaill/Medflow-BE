import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';

type AuthorizationStatus = 'requested' | 'pending' | 'approved' | 'denied' | 'expired' | 'cancelled';

type AuthMeta = {
  unitsAuthorized?: number;
  unitsUsed?: number;
  status?: AuthorizationStatus;
  notes?: string;
  requestedBy?: string;
  approvedDate?: string;
  expirationDate?: string;
  serviceId?: string;
  insuranceCompanyId?: string;
};

type AuthorizationFilters = {
  search?: string;
  status?: string;
  patientId?: string;
  insuranceCompanyId?: string;
  startDate?: string;
  endDate?: string;
};

type AuthViewContext = {
  patient?: any;
  insuranceCompany?: any;
  service?: any;
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

const normalizeStatus = (status?: string | null): AuthorizationStatus => {
  const value = String(status || '').toLowerCase();
  if (value === 'requested') return 'pending';
  if (value === 'approved') return 'approved';
  if (value === 'denied') return 'denied';
  if (value === 'expired') return 'expired';
  if (value === 'cancelled') return 'cancelled';
  return 'pending';
};

const claimStatusToAuthStatus = (status?: string | null): AuthorizationStatus => {
  switch ((status || '').toUpperCase()) {
    case 'R':
      return 'approved';
    case 'D':
      return 'denied';
    case 'X':
      return 'expired';
    case 'C':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const authStatusToClaimStatus = (status?: string | null): string => {
  switch (normalizeStatus(status)) {
    case 'approved':
      return 'R';
    case 'denied':
      return 'D';
    case 'expired':
      return 'X';
    case 'cancelled':
      return 'C';
    default:
      return 'P';
  }
};

const buildInsuranceCompanyView = (company: any) => {
  if (!company) return null;
  return {
    _id: company.CarrierNum?.toString() ?? null,
    name: company.CarrierName ?? '',
    payerId: company.ElectID ?? null,
    phone: company.Phone ?? null,
    isActive: !company.IsHidden,
  };
};

const buildServiceView = (service: any) => {
  if (!service) return null;
  return {
    _id: service.CodeNum?.toString() ?? service.ProcCode ?? null,
    cptCode: service.ProcCode ?? null,
    name: service.Descript ?? service.AbbrDesc ?? service.LaymanTerm ?? 'Service',
  };
};

export class AuthorizationService {
  private async createStatusHistoryEntry(
    authorizationId: string,
    status: AuthorizationStatus,
    note: string | undefined,
    userId?: string
  ) {
    const claimTrackingNum = await getNextId('claimtracking', 'ClaimTrackingNum');
    await prisma.claimtracking.create({
      data: {
        ClaimTrackingNum: claimTrackingNum,
        ClaimNum: BigInt(authorizationId),
        TrackingType: 'status',
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
        DateTimeEntry: new Date(),
        Note: note ?? `Status changed to ${status}`,
      },
    });
  }

  private buildAuthorization(row: any, meta: AuthMeta, context: AuthViewContext = {}) {
    const status = normalizeStatus(meta.status ?? claimStatusToAuthStatus(row.ClaimStatus));
    const patient = context.patient ? mapPatientToApi(context.patient) : null;
    const insuranceCompany = buildInsuranceCompanyView(context.insuranceCompany);
    const service = buildServiceView(context.service);

    return {
      _id: row.ClaimNum.toString(),
      id: row.ClaimNum.toString(),
      authorizationNumber: row.PriorAuthorizationNumber ?? row.PreAuthString ?? '',
      patientRefId: row.PatNum?.toString() ?? null,
      insuranceCompanyRefId: meta.insuranceCompanyId ?? null,
      serviceRefId: meta.serviceId ?? null,
      patientId: patient ?? row.PatNum?.toString() ?? null,
      patient,
      insuranceCompanyId: insuranceCompany ?? meta.insuranceCompanyId ?? null,
      insuranceCompany,
      serviceId: service ?? meta.serviceId ?? null,
      service,
      requestedDate: row.DateService ?? null,
      approvedDate: meta.approvedDate ? new Date(meta.approvedDate) : null,
      expirationDate: meta.expirationDate ? new Date(meta.expirationDate) : null,
      status,
      unitsAuthorized: meta.unitsAuthorized ?? null,
      unitsUsed: meta.unitsUsed ?? 0,
      notes: meta.notes ?? row.ClaimNote ?? null,
      requestedBy: meta.requestedBy ?? null,
      createdAt: row.SecDateEntry ?? row.DateService ?? null,
      updatedAt: row.SecDateTEdit ?? row.DateService ?? null,
      denialReason: status === 'denied' ? (meta.notes ?? row.ReasonUnderPaid ?? null) : null,
    };
  }

  private async generateAuthorizationNumber(): Promise<string> {
    const recent = await prisma.claim.findMany({
      where: {
        ClaimType: 'PreAuth',
        PreAuthString: { startsWith: 'AUTH' },
      },
      orderBy: { ClaimNum: 'desc' },
      take: 50,
    });

    let maxNumber = 0;
    for (const row of recent) {
      const source = row.PreAuthString ?? row.PriorAuthorizationNumber ?? '';
      const match = source.match(/(\d+)$/);
      const numeric = match?.[1] ? parseInt(match[1], 10) : 0;
      if (numeric > maxNumber) {
        maxNumber = numeric;
      }
    }

    return `AUTH${String(maxNumber + 1).padStart(6, '0')}`;
  }

  async getAllAuthorizations(page = 1, limit = 10, filters: AuthorizationFilters = {}) {
    const where: any = { ClaimType: 'PreAuth' };

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

    const insuranceIds = Array.from(
      new Set(
        rows
          .map((row) => parseJson<AuthMeta>(row.Narrative).insuranceCompanyId)
          .filter((value): value is string => Boolean(value))
      )
    );

    const serviceIds = Array.from(
      new Set(
        rows
          .map((row) => parseJson<AuthMeta>(row.Narrative).serviceId)
          .filter((value): value is string => Boolean(value))
      )
    );

    const insuranceCompanies = insuranceIds.length
      ? await prisma.carrier.findMany({
          where: {
            CarrierNum: {
              in: insuranceIds
                .map((id) => toBigInt(id))
                .filter((id): id is bigint => id !== null),
            },
          },
        })
      : [];

    const services = serviceIds.length
      ? await prisma.procedurecode.findMany({
          where: {
            CodeNum: {
              in: serviceIds
                .map((id) => toBigInt(id))
                .filter((id): id is bigint => id !== null),
            },
          },
        })
      : [];

    const insuranceById = new Map(insuranceCompanies.map((item) => [item.CarrierNum.toString(), item]));
    const servicesById = new Map(
      services
        .filter((item) => item.CodeNum !== null)
        .map((item) => [item.CodeNum!.toString(), item])
    );

    let authorizations = rows.map((row) => {
      const meta = parseJson<AuthMeta>(row.Narrative);
      const insuranceCompany = meta.insuranceCompanyId
        ? insuranceById.get(meta.insuranceCompanyId)
        : undefined;
      const service = meta.serviceId ? servicesById.get(meta.serviceId) : undefined;
      return this.buildAuthorization(row, meta, {
        patient: row.patient,
        insuranceCompany,
        service,
      });
    });

    if (filters.status) {
      const targetStatus = normalizeStatus(filters.status);
      authorizations = authorizations.filter((item) => normalizeStatus(item.status) === targetStatus);
    }

    if (filters.insuranceCompanyId) {
      authorizations = authorizations.filter(
        (item) =>
          item.insuranceCompanyRefId === filters.insuranceCompanyId ||
          item.insuranceCompany?._id === filters.insuranceCompanyId
      );
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      authorizations = authorizations.filter((item) => {
        const patientName = `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim();
        return [
          item.authorizationNumber,
          item.status,
          item.notes,
          item.insuranceCompany?.name,
          item.service?.name,
          patientName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
    }

    const total = authorizations.length;
    const skip = (page - 1) * limit;
    const paged = authorizations.slice(skip, skip + limit);

    return {
      authorizations: paged,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAuthorizationById(authorizationId: string) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
      include: { patient: true },
    });

    if (!auth || auth.ClaimType !== 'PreAuth') {
      throw new NotFoundError('Authorization not found');
    }

    const meta = parseJson<AuthMeta>(auth.Narrative);
    const insuranceCompany = meta.insuranceCompanyId
      ? await prisma.carrier.findUnique({ where: { CarrierNum: BigInt(meta.insuranceCompanyId) } })
      : null;
    const service = meta.serviceId
      ? await prisma.procedurecode.findUnique({ where: { CodeNum: BigInt(meta.serviceId) } })
      : null;

    return this.buildAuthorization(auth, meta, {
      patient: auth.patient,
      insuranceCompany,
      service,
    });
  }

  async createAuthorization(data: {
    patientId: string;
    insuranceCompanyId?: string;
    serviceId?: string;
    authorizationNumber?: string;
    requestedDate?: Date;
    approvedDate?: Date;
    expirationDate?: Date;
    status?: AuthorizationStatus;
    unitsAuthorized?: number;
    unitsUsed?: number;
    notes?: string;
    requestedBy?: string;
  }) {
    const authorizationNumber = data.authorizationNumber || (await this.generateAuthorizationNumber());

    const existing = await prisma.claim.findFirst({
      where: {
        ClaimType: 'PreAuth',
        OR: [{ PriorAuthorizationNumber: authorizationNumber }, { PreAuthString: authorizationNumber }],
      },
    });
    if (existing) {
      throw new ConflictError('Authorization number already exists');
    }

    const status = normalizeStatus(data.status);
    const claimNum = await getNextId('claim', 'ClaimNum');

    const meta: AuthMeta = {
      unitsAuthorized: data.unitsAuthorized,
      unitsUsed: data.unitsUsed ?? 0,
      status,
      notes: data.notes,
      requestedBy: data.requestedBy,
      approvedDate: data.approvedDate ? data.approvedDate.toISOString() : undefined,
      expirationDate: data.expirationDate ? data.expirationDate.toISOString() : undefined,
      serviceId: data.serviceId,
      insuranceCompanyId: data.insuranceCompanyId,
    };

    const auth = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: BigInt(data.patientId),
        ClaimType: 'PreAuth',
        ClaimStatus: authStatusToClaimStatus(status),
        DateService: data.requestedDate ?? new Date(),
        DateReceived: status === 'approved' ? (data.approvedDate ?? new Date()) : null,
        PriorAuthorizationNumber: authorizationNumber,
        PreAuthString: authorizationNumber,
        ClaimNote: data.notes ?? null,
        Narrative: buildJson(meta),
      },
      include: { patient: true },
    });

    await this.createStatusHistoryEntry(auth.ClaimNum.toString(), status, data.notes, data.requestedBy);

    const insuranceCompany = data.insuranceCompanyId
      ? await prisma.carrier.findUnique({ where: { CarrierNum: BigInt(data.insuranceCompanyId) } })
      : null;
    const service = data.serviceId
      ? await prisma.procedurecode.findUnique({ where: { CodeNum: BigInt(data.serviceId) } })
      : null;

    return this.buildAuthorization(auth, meta, {
      patient: auth.patient,
      insuranceCompany,
      service,
    });
  }

  async updateAuthorization(
    authorizationId: string,
    updates: Partial<{
      approvedDate: Date;
      expirationDate: Date;
      status: AuthorizationStatus;
      unitsAuthorized: number;
      unitsUsed: number;
      notes: string;
      insuranceCompanyId: string;
      serviceId: string;
      requestedBy: string;
    }>
  ) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
      include: { patient: true },
    });

    if (!auth || auth.ClaimType !== 'PreAuth') {
      throw new NotFoundError('Authorization not found');
    }

    const meta = parseJson<AuthMeta>(auth.Narrative);
    const previousStatus = normalizeStatus(meta.status ?? claimStatusToAuthStatus(auth.ClaimStatus));
    const nextStatus = updates.status ? normalizeStatus(updates.status) : previousStatus;

    const nextMeta: AuthMeta = {
      ...meta,
      unitsAuthorized: updates.unitsAuthorized ?? meta.unitsAuthorized,
      unitsUsed: updates.unitsUsed ?? meta.unitsUsed,
      status: nextStatus,
      notes: updates.notes ?? meta.notes,
      approvedDate: updates.approvedDate ? updates.approvedDate.toISOString() : meta.approvedDate,
      expirationDate: updates.expirationDate ? updates.expirationDate.toISOString() : meta.expirationDate,
      insuranceCompanyId: updates.insuranceCompanyId ?? meta.insuranceCompanyId,
      serviceId: updates.serviceId ?? meta.serviceId,
      requestedBy: updates.requestedBy ?? meta.requestedBy,
    };

    const updated = await prisma.claim.update({
      where: { ClaimNum: auth.ClaimNum },
      data: {
        ClaimStatus: authStatusToClaimStatus(nextStatus),
        DateReceived: nextStatus === 'approved'
          ? (updates.approvedDate ?? (nextMeta.approvedDate ? new Date(nextMeta.approvedDate) : new Date()))
          : auth.DateReceived,
        ClaimNote: updates.notes ?? auth.ClaimNote,
        Narrative: buildJson(nextMeta),
      },
      include: { patient: true },
    });

    if (previousStatus !== nextStatus) {
      await this.createStatusHistoryEntry(
        authorizationId,
        nextStatus,
        updates.notes ?? `Status changed from ${previousStatus} to ${nextStatus}`,
        updates.requestedBy
      );
    }

    const insuranceCompany = nextMeta.insuranceCompanyId
      ? await prisma.carrier.findUnique({ where: { CarrierNum: BigInt(nextMeta.insuranceCompanyId) } })
      : null;
    const service = nextMeta.serviceId
      ? await prisma.procedurecode.findUnique({ where: { CodeNum: BigInt(nextMeta.serviceId) } })
      : null;

    return this.buildAuthorization(updated, nextMeta, {
      patient: updated.patient,
      insuranceCompany,
      service,
    });
  }

  async getAuthorizationStatusHistory(authorizationId: string) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
    });

    if (!auth || auth.ClaimType !== 'PreAuth') {
      throw new NotFoundError('Authorization not found');
    }

    const history = await prisma.claimtracking.findMany({
      where: {
        ClaimNum: BigInt(authorizationId),
      },
      orderBy: { DateTimeEntry: 'asc' },
      include: { userod: true },
    });

    return history.map((item) => {
      const statusMatch = (item.Note || '').match(/status\s*(?:changed\s*to)?\s*([a-z_]+)/i);
      const inferredStatus = statusMatch ? normalizeStatus(statusMatch[1]) : undefined;
      return {
        _id: item.ClaimTrackingNum.toString(),
        status: inferredStatus ?? 'pending',
        note: item.Note ?? null,
        timestamp: item.DateTimeEntry ?? null,
        changedBy: item.userod
          ? {
              _id: item.userod.UserNum.toString(),
              firstName: item.userod.UserName ?? '',
              lastName: '',
            }
          : null,
      };
    });
  }

  async getPrintableAuthorizationForm(authorizationId: string) {
    const authorization = await this.getAuthorizationById(authorizationId);

    const patientName = authorization.patient
      ? `${authorization.patient.firstName || ''} ${authorization.patient.lastName || ''}`.trim()
      : 'Unknown Patient';

    const lines = [
      'INSURANCE AUTHORIZATION FORM',
      '============================',
      `Authorization #: ${authorization.authorizationNumber || '-'}`,
      `Status: ${authorization.status || '-'}`,
      '',
      `Patient: ${patientName || '-'}`,
      `Insurance Company: ${authorization.insuranceCompany?.name || '-'}`,
      `Service: ${authorization.service?.name || '-'}`,
      `CPT Code: ${authorization.service?.cptCode || '-'}`,
      '',
      `Requested Date: ${authorization.requestedDate ? new Date(authorization.requestedDate).toISOString().slice(0, 10) : '-'}`,
      `Approved Date: ${authorization.approvedDate ? new Date(authorization.approvedDate).toISOString().slice(0, 10) : '-'}`,
      `Expiration Date: ${authorization.expirationDate ? new Date(authorization.expirationDate).toISOString().slice(0, 10) : '-'}`,
      '',
      `Units Authorized: ${authorization.unitsAuthorized ?? '-'}`,
      `Units Used: ${authorization.unitsUsed ?? 0}`,
      '',
      `Notes: ${authorization.notes || '-'}`,
      '',
      `Generated At: ${new Date().toISOString()}`,
    ];

    return lines.join('\n');
  }

  async deleteAuthorization(authorizationId: string) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
    });

    if (!auth || auth.ClaimType !== 'PreAuth') {
      throw new NotFoundError('Authorization not found');
    }

    await prisma.claim.delete({ where: { ClaimNum: auth.ClaimNum } });
    return { message: 'Authorization deleted successfully' };
  }
}

export const authorizationService = new AuthorizationService();
