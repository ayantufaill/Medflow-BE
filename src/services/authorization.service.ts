import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
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

type AuthMeta = {
  unitsAuthorized?: number;
  unitsUsed?: number;
  status?: string;
  notes?: string;
  requestedBy?: string;
  approvedDate?: string;
  expirationDate?: string;
  serviceId?: string;
  insuranceCompanyId?: string;
};

export class AuthorizationService {
  async getAllAuthorizations(page = 1, limit = 10, filters: { patientId?: string; status?: string } = {}) {
    const skip = (page - 1) * limit;
    const where: any = { ClaimType: 'PreAuth' };

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);
    if (filters.status) where.ClaimStatus = filters.status;

    const [rows, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        orderBy: { DateService: 'desc' },
        skip,
        take: limit,
      }),
      prisma.claim.count({ where }),
    ]);

    return {
      authorizations: rows.map((row) => {
        const meta = parseJson<AuthMeta>(row.Narrative);
        return {
          _id: row.ClaimNum.toString(),
          patientId: row.PatNum?.toString() ?? null,
          insuranceCompanyId: meta.insuranceCompanyId ?? null,
          serviceId: meta.serviceId ?? null,
          authorizationNumber: row.PriorAuthorizationNumber ?? row.PreAuthString ?? '',
          requestedDate: row.DateService ?? null,
          approvedDate: meta.approvedDate ? new Date(meta.approvedDate) : null,
          expirationDate: meta.expirationDate ? new Date(meta.expirationDate) : null,
          status: meta.status ?? 'pending',
          unitsAuthorized: meta.unitsAuthorized ?? null,
          unitsUsed: meta.unitsUsed ?? 0,
          notes: meta.notes ?? null,
          requestedBy: meta.requestedBy ?? null,
        };
      }),
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
    });
    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    const meta = parseJson<AuthMeta>(auth.Narrative);
    return {
      _id: auth.ClaimNum.toString(),
      patientId: auth.PatNum?.toString() ?? null,
      insuranceCompanyId: meta.insuranceCompanyId ?? null,
      serviceId: meta.serviceId ?? null,
      authorizationNumber: auth.PriorAuthorizationNumber ?? auth.PreAuthString ?? '',
      requestedDate: auth.DateService ?? null,
      approvedDate: meta.approvedDate ? new Date(meta.approvedDate) : null,
      expirationDate: meta.expirationDate ? new Date(meta.expirationDate) : null,
      status: meta.status ?? 'pending',
      unitsAuthorized: meta.unitsAuthorized ?? null,
      unitsUsed: meta.unitsUsed ?? 0,
      notes: meta.notes ?? null,
      requestedBy: meta.requestedBy ?? null,
    };
  }

  async createAuthorization(data: {
    patientId: string;
    insuranceCompanyId: string;
    serviceId: string;
    authorizationNumber: string;
    requestedDate: Date;
    approvedDate?: Date;
    expirationDate?: Date;
    status?: 'pending' | 'approved' | 'denied' | 'expired';
    unitsAuthorized?: number;
    unitsUsed?: number;
    notes?: string;
    requestedBy?: string;
  }) {
    const existing = await prisma.claim.findFirst({
      where: { PriorAuthorizationNumber: data.authorizationNumber },
    });
    if (existing) {
      throw new ConflictError('Authorization number already exists');
    }

    const claimNum = await getNextId('claim', 'ClaimNum');
    const meta: AuthMeta = {
      unitsAuthorized: data.unitsAuthorized,
      unitsUsed: data.unitsUsed ?? 0,
      status: data.status ?? 'pending',
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
        ClaimStatus: data.status ?? 'P',
        DateService: data.requestedDate,
        PriorAuthorizationNumber: data.authorizationNumber,
        PreAuthString: data.authorizationNumber,
        Narrative: buildJson(meta),
      },
    });

    return auth;
  }

  async updateAuthorization(
    authorizationId: string,
    updates: Partial<{
      approvedDate: Date;
      expirationDate: Date;
      status: 'pending' | 'approved' | 'denied' | 'expired';
      unitsAuthorized: number;
      unitsUsed: number;
      notes: string;
    }>
  ) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
    });
    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    const meta = parseJson<AuthMeta>(auth.Narrative);
    const nextMeta: AuthMeta = {
      ...meta,
      unitsAuthorized: updates.unitsAuthorized ?? meta.unitsAuthorized,
      unitsUsed: updates.unitsUsed ?? meta.unitsUsed,
      status: updates.status ?? meta.status,
      notes: updates.notes ?? meta.notes,
      approvedDate: updates.approvedDate ? updates.approvedDate.toISOString() : meta.approvedDate,
      expirationDate: updates.expirationDate ? updates.expirationDate.toISOString() : meta.expirationDate,
    };

    const updated = await prisma.claim.update({
      where: { ClaimNum: auth.ClaimNum },
      data: {
        Narrative: buildJson(nextMeta),
      },
    });

    return updated;
  }

  async deleteAuthorization(authorizationId: string) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
    });
    if (!auth) {
      throw new NotFoundError('Authorization not found');
    }

    await prisma.claim.delete({ where: { ClaimNum: auth.ClaimNum } });
    return { message: 'Authorization deleted successfully' };
  }
}

export const authorizationService = new AuthorizationService();
