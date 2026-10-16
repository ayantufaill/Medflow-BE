import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { providerResolutionService } from './provider-resolution.service.js';
import fs from 'node:fs';
import path from 'node:path';

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
  tags?: string[];
  procedureIds?: string[];
  procedures?: any[];
  order?: string;
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
  procedures?: any[];
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
    const procedures = context.procedures ?? (service ? [service] : []);

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
      order: meta.order ?? 'Primary',
      tags: meta.tags ?? [],
      procedureIds: meta.procedureIds ?? [],
      procedures,
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

    const procedureIds = Array.from(
      new Set(
        rows
          .flatMap((row) => parseJson<AuthMeta>(row.Narrative).procedureIds || [])
          .filter((value): value is string => Boolean(value))
      )
    );

    const allServiceAndProcIds = Array.from(new Set([...serviceIds, ...procedureIds]));

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

    const services = allServiceAndProcIds.length
      ? await prisma.procedurecode.findMany({
        where: {
          OR: [
            {
              CodeNum: {
                in: allServiceAndProcIds
                  .map((id) => toBigInt(id))
                  .filter((id): id is bigint => id !== null),
              },
            },
            {
              ProcCode: {
                in: allServiceAndProcIds.map((id) => String(id)),
              },
            },
          ],
        },
      })
      : [];

    const insuranceById = new Map(insuranceCompanies.map((item) => [item.CarrierNum.toString(), item]));
    const servicesByCodeNum = new Map(
      services
        .filter((item) => item.CodeNum !== null)
        .map((item) => [item.CodeNum!.toString(), item])
    );
    const servicesByProcCode = new Map(services.map((item) => [item.ProcCode, item]));

    const resolveServiceOrProc = (idOrCode: string) => {
      return servicesByCodeNum.get(idOrCode) || servicesByProcCode.get(idOrCode);
    };

    let authorizations = rows.map((row) => {
      const meta = parseJson<AuthMeta>(row.Narrative);
      const insuranceCompany = meta.insuranceCompanyId
        ? insuranceById.get(meta.insuranceCompanyId)
        : undefined;
      const service = meta.serviceId ? resolveServiceOrProc(String(meta.serviceId)) : undefined;
      const procedures = meta.procedures || (meta.procedureIds || [])
        .map((pId) => buildServiceView(resolveServiceOrProc(String(pId))))
        .filter(Boolean);

      return this.buildAuthorization(row, meta, {
        patient: row.patient,
        insuranceCompany,
        service,
        procedures: procedures.length > 0 ? procedures : undefined,
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
          ...(item.tags || []),
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
      ? await prisma.procedurecode.findFirst({
        where: {
          OR: [
            ...(toBigInt(meta.serviceId) ? [{ CodeNum: toBigInt(meta.serviceId)! }] : []),
            { ProcCode: String(meta.serviceId) },
          ],
        },
      })
      : null;

    let procedures: any[] = [];
    if (meta.procedures && meta.procedures.length > 0) {
      procedures = meta.procedures;
    } else if (meta.procedureIds && meta.procedureIds.length > 0) {
      const procedureIds = meta.procedureIds
        .map((id) => toBigInt(id))
        .filter((id): id is bigint => id !== null);
      const treatmentPlanProcedures = procedureIds.length > 0
        ? await prisma.proctp.findMany({
          where: {
            ProcTPNum: { in: procedureIds },
            PatNum: auth.PatNum,
          },
          orderBy: { ItemOrder: 'asc' },
        })
        : [];

      if (treatmentPlanProcedures.length > 0) {
        procedures = treatmentPlanProcedures.map((proc) => ({
          _id: proc.ProcTPNum.toString(),
          cptCode: proc.ProcCode ?? null,
          code: proc.ProcCode ?? null,
          name: proc.Descript ?? proc.ProcCode ?? 'Service',
          description: proc.Descript ?? proc.ProcCode ?? 'Service',
          fee: proc.FeeAmt ?? 0,
          tooth: proc.ToothNumTP ?? null,
          surface: proc.Surf ?? null,
        }));
      } else {
        const procRows = await prisma.procedurecode.findMany({
          where: {
            OR: [
              {
                CodeNum: {
                  in: procedureIds,
                },
              },
              {
                ProcCode: {
                  in: meta.procedureIds.map((id) => String(id)),
                },
              },
            ],
          },
        });
        procedures = procRows.map((proc) => buildServiceView(proc)).filter(Boolean);
      }
    }

    return this.buildAuthorization(auth, meta, {
      patient: auth.patient,
      insuranceCompany,
      service,
      procedures: procedures.length > 0 ? procedures : undefined,
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
    tags?: string[];
    procedureIds?: string[];
    procedures?: any[];
    order?: string;
  }) {
    const activePlan = await prisma.patplan.findFirst({
      where: {
        PatNum: BigInt(data.patientId),
        OR: [{ IsPending: 0 }, { IsPending: null }],
      },
      include: {
        inssub: {
          include: { insplan: true },
        },
      },
      orderBy: { Ordinal: 'asc' },
    });
    if (!activePlan) {
      throw new ConflictError('Patient has no insurance coverage on file');
    }
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

    let rawProcIds = data.procedureIds;
    let fullProcedures = undefined;

    if (data.procedures && data.procedures.length > 0) {
      if (typeof data.procedures[0] === 'string') {
        rawProcIds = rawProcIds || data.procedures;
      } else {
        fullProcedures = data.procedures;
        rawProcIds = rawProcIds || data.procedures.map((p: any) => String(p.id || p._id || p.code || p.procedureCode));
      }
    }

    const resolvedProcedureIds = rawProcIds ? rawProcIds.map((id) => String(id)) : undefined;

    // ── Compute Real Financial Totals from proctp or Procedures ─────────────
    let totalClaimFee = 0;
    let totalInsPayEst = 0;
    let totalPatientPortion = 0;
    let itemProvNum: bigint | null = null;
    let clinicNum: bigint | null = null;

    const candidateIds = (resolvedProcedureIds || [])
      .map((id) => toBigInt(id))
      .filter((id): id is bigint => id !== null);

    let proctpMatches: any[] = [];
    if (candidateIds.length > 0) {
      proctpMatches = await prisma.proctp.findMany({
        where: {
          ProcTPNum: { in: candidateIds },
          PatNum: BigInt(data.patientId),
        },
        include: { provider: true },
      });
    }

    if (proctpMatches.length === 0 && fullProcedures && fullProcedures.length > 0) {
      const procCodes = fullProcedures
        .map((p: any) => p.code || p.procedureCode || p.ProcCode)
        .filter(Boolean);
      if (procCodes.length > 0) {
        proctpMatches = await prisma.proctp.findMany({
          where: {
            PatNum: BigInt(data.patientId),
            ProcCode: { in: procCodes },
          },
          orderBy: { ItemOrder: 'asc' },
          include: { provider: true },
        });
      }
    }

    if (proctpMatches.length > 0) {
      totalClaimFee = proctpMatches.reduce((sum, p) => sum + Number(p.FeeAmt || 0), 0);
      totalInsPayEst = proctpMatches.reduce((sum, p) => sum + Number(p.PriInsAmt || 0), 0);
      totalPatientPortion = proctpMatches.reduce((sum, p) => sum + Number(p.PatAmt || 0), 0);
      itemProvNum = proctpMatches.find((p) => p.ProvNum != null)?.ProvNum ?? null;
      clinicNum = proctpMatches.find((p) => p.ClinicNum != null)?.ClinicNum ?? null;
    }
    if (!itemProvNum && fullProcedures && fullProcedures.length > 0) {
      const procWithProv = fullProcedures.find((p: any) => p.providerId || p.provider);
      if (procWithProv) {
        const provStr = String(procWithProv.providerId || procWithProv.provider);
        if (/^\d+$/.test(provStr)) itemProvNum = BigInt(provStr);
      }
    } else if (proctpMatches.length === 0 && fullProcedures && fullProcedures.length > 0) {
      for (const p of fullProcedures) {
        const fee = Number(p.fee ?? p.charge ?? p.amount ?? 0);
        const insEst = Number(p.insAmount ?? p.priInsAmt ?? p.insEst ?? 0);
        const patAmt = Number(p.ptAmount ?? p.patAmt ?? (fee > insEst ? fee - insEst : 0));
        totalClaimFee += fee;
        totalInsPayEst += insEst;
        totalPatientPortion += patAmt;
        if (!itemProvNum && (p.providerId || p.provider)) {
          const provStr = String(p.providerId || p.provider);
          if (/^\d+$/.test(provStr)) itemProvNum = BigInt(provStr);
        }
      }
    }

    // ── Independent Treating vs Billing Provider Resolution ─────────────────
    let treatingProvNum: bigint | null = null;
    let billingProvNum: bigint | null = null;

    try {
      const resolved = await providerResolutionService.resolveClaimProviders({
        patientId: BigInt(data.patientId),
        clinicId: clinicNum,
        itemProvNum,
        allowTreatingAsBilling: true,
      });
      treatingProvNum = resolved.treatingProvNum;
      billingProvNum = resolved.billingProvNum;
    } catch {
      const defaultProv = await prisma.provider.findFirst({ where: { IsHidden: 0 } });
      treatingProvNum = defaultProv?.ProvNum ?? null;
      billingProvNum = defaultProv?.ProvNum ?? null;
    }

    const meta: AuthMeta = {
      unitsAuthorized: data.unitsAuthorized,
      unitsUsed: data.unitsUsed ?? 0,
      status,
      notes: data.notes,
      requestedBy: data.requestedBy,
      approvedDate: data.approvedDate ? data.approvedDate.toISOString() : undefined,
      expirationDate: data.expirationDate ? data.expirationDate.toISOString() : undefined,
      serviceId: data.serviceId ? String(data.serviceId) : undefined,
      insuranceCompanyId: data.insuranceCompanyId ? String(data.insuranceCompanyId) : undefined,
      tags: data.tags ? data.tags.map((t) => String(t)) : [],
      procedureIds: resolvedProcedureIds ?? (data.serviceId ? [String(data.serviceId)] : []),
      procedures: fullProcedures,
      order: data.order ?? 'Primary',
    };

    const auth = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: BigInt(data.patientId),
        PlanNum: activePlan?.inssub?.PlanNum ?? null,
        InsSubNum: activePlan?.InsSubNum ?? null,
        ClaimType: 'PreAuth',
        ClaimStatus: authStatusToClaimStatus(status),
        DateService: data.requestedDate ?? new Date(),
        DateReceived: status === 'approved' ? (data.approvedDate ?? new Date()) : null,
        PriorAuthorizationNumber: authorizationNumber,
        PreAuthString: authorizationNumber,
        ClaimFee: totalClaimFee,
        InsPayEst: totalInsPayEst,
        InsPayAmt: 0,
        DedApplied: totalPatientPortion,
        ClaimNote: data.notes ?? null,
        Narrative: buildJson(meta),
        ProvTreat: treatingProvNum,
        ProvBill: billingProvNum,
      },
      include: { patient: true },
    });

    await this.createStatusHistoryEntry(auth.ClaimNum.toString(), status, data.notes, data.requestedBy);

    const insuranceCompany = data.insuranceCompanyId
      ? await prisma.carrier.findUnique({ where: { CarrierNum: BigInt(data.insuranceCompanyId) } })
      : null;
    const service = data.serviceId
      ? await prisma.procedurecode.findFirst({
        where: {
          OR: [
            ...(toBigInt(data.serviceId) ? [{ CodeNum: toBigInt(data.serviceId)! }] : []),
            { ProcCode: String(data.serviceId) },
          ],
        },
      })
      : null;

    let procedures: any[] = [];
    if (meta.procedures && meta.procedures.length > 0) {
      procedures = meta.procedures;
    } else if (meta.procedureIds && meta.procedureIds.length > 0) {
      const procRows = await prisma.procedurecode.findMany({
        where: {
          OR: [
            {
              CodeNum: {
                in: meta.procedureIds
                  .map((id) => toBigInt(id))
                  .filter((id): id is bigint => id !== null),
              },
            },
            {
              ProcCode: {
                in: meta.procedureIds.map((id) => String(id)),
              },
            },
          ],
        },
      });
      procedures = procRows.map((proc) => buildServiceView(proc)).filter(Boolean);
    }

    return this.buildAuthorization(auth, meta, {
      patient: auth.patient,
      insuranceCompany,
      service,
      procedures: procedures.length > 0 ? procedures : undefined,
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
      tags: string[];
      procedureIds: string[];
      procedures: any[];
      order: string;
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

    let rawProcIds = updates.procedureIds;
    let fullProcedures = meta.procedures;

    if (updates.procedures && updates.procedures.length > 0) {
      if (typeof updates.procedures[0] === 'string') {
        rawProcIds = rawProcIds || updates.procedures;
      } else {
        fullProcedures = updates.procedures;
        rawProcIds = rawProcIds || updates.procedures.map((p: any) => String(p.id || p._id || p.code || p.procedureCode));
      }
    }

    const resolvedProcedureIds = rawProcIds ? rawProcIds.map((id) => String(id)) : undefined;

    const nextMeta: AuthMeta = {
      ...meta,
      unitsAuthorized: updates.unitsAuthorized ?? meta.unitsAuthorized,
      unitsUsed: updates.unitsUsed ?? meta.unitsUsed,
      status: nextStatus,
      notes: updates.notes ?? meta.notes,
      approvedDate: updates.approvedDate ? updates.approvedDate.toISOString() : meta.approvedDate,
      expirationDate: updates.expirationDate ? updates.expirationDate.toISOString() : meta.expirationDate,
      insuranceCompanyId: updates.insuranceCompanyId ? String(updates.insuranceCompanyId) : meta.insuranceCompanyId,
      serviceId: updates.serviceId ? String(updates.serviceId) : meta.serviceId,
      requestedBy: updates.requestedBy ?? meta.requestedBy,
      tags: updates.tags ? updates.tags.map((t) => String(t)) : meta.tags,
      procedureIds: resolvedProcedureIds ?? (meta.procedureIds ? meta.procedureIds.map((id) => String(id)) : undefined),
      procedures: fullProcedures,
      order: updates.order ?? meta.order,
    };

    const claimUpdateData: any = {
      ClaimStatus: authStatusToClaimStatus(nextStatus),
      DateReceived: nextStatus === 'approved'
        ? (updates.approvedDate ?? (nextMeta.approvedDate ? new Date(nextMeta.approvedDate) : new Date()))
        : auth.DateReceived,
      ClaimNote: updates.notes ?? auth.ClaimNote,
      Narrative: buildJson(nextMeta),
    };

    if (updates.procedures || updates.procedureIds) {
      let totalClaimFee = 0;
      let totalInsPayEst = 0;
      let totalPatientPortion = 0;
      let itemProvNum: bigint | null = null;
      let clinicNum: bigint | null = null;

      const candidateIds = (resolvedProcedureIds || [])
        .map((id) => toBigInt(id))
        .filter((id): id is bigint => id !== null);

      let proctpMatches: any[] = [];
      if (candidateIds.length > 0 && auth.PatNum) {
        proctpMatches = await prisma.proctp.findMany({
          where: {
            ProcTPNum: { in: candidateIds },
            PatNum: auth.PatNum,
          },
          include: { provider: true },
        });
      }

      if (proctpMatches.length === 0 && fullProcedures && fullProcedures.length > 0 && auth.PatNum) {
        const procCodes = fullProcedures
          .map((p: any) => p.code || p.procedureCode || p.ProcCode)
          .filter(Boolean);
        if (procCodes.length > 0) {
          proctpMatches = await prisma.proctp.findMany({
            where: {
              PatNum: auth.PatNum,
              ProcCode: { in: procCodes },
            },
            orderBy: { ItemOrder: 'asc' },
            include: { provider: true },
          });
        }
      }

      if (proctpMatches.length > 0) {
        totalClaimFee = proctpMatches.reduce((sum, p) => sum + Number(p.FeeAmt || 0), 0);
        totalInsPayEst = proctpMatches.reduce((sum, p) => sum + Number(p.PriInsAmt || 0), 0);
        totalPatientPortion = proctpMatches.reduce((sum, p) => sum + Number(p.PatAmt || 0), 0);
        itemProvNum = proctpMatches.find((p) => p.ProvNum != null)?.ProvNum ?? null;
        clinicNum = proctpMatches.find((p) => p.ClinicNum != null)?.ClinicNum ?? null;
      }
      if (!itemProvNum && fullProcedures && fullProcedures.length > 0) {
        const procWithProv = fullProcedures.find((p: any) => p.providerId || p.provider);
        if (procWithProv) {
          const provStr = String(procWithProv.providerId || procWithProv.provider);
          if (/^\d+$/.test(provStr)) itemProvNum = BigInt(provStr);
        }
      } else if (proctpMatches.length === 0 && fullProcedures && fullProcedures.length > 0) {
        for (const p of fullProcedures) {
          const fee = Number(p.fee ?? p.charge ?? p.amount ?? 0);
          const insEst = Number(p.insAmount ?? p.priInsAmt ?? p.insEst ?? 0);
          const patAmt = Number(p.ptAmount ?? p.patAmt ?? (fee > insEst ? fee - insEst : 0));
          totalClaimFee += fee;
          totalInsPayEst += insEst;
          totalPatientPortion += patAmt;
          if (!itemProvNum && (p.providerId || p.provider)) {
            const provStr = String(p.providerId || p.provider);
            if (/^\d+$/.test(provStr)) itemProvNum = BigInt(provStr);
          }
        }
      }

      if (totalClaimFee > 0) {
        claimUpdateData.ClaimFee = totalClaimFee;
        claimUpdateData.InsPayEst = totalInsPayEst;
        claimUpdateData.DedApplied = totalPatientPortion;
      }

      if (auth.PatNum) {
        try {
          const resolved = await providerResolutionService.resolveClaimProviders({
            patientId: auth.PatNum,
            clinicId: clinicNum,
            itemProvNum,
            allowTreatingAsBilling: true,
          });
          claimUpdateData.ProvTreat = resolved.treatingProvNum;
          claimUpdateData.ProvBill = resolved.billingProvNum;
        } catch {
          // Keep existing providers if resolution fails
        }
      }
    }

    const updated = await prisma.claim.update({
      where: { ClaimNum: auth.ClaimNum },
      data: claimUpdateData,
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
      ? await prisma.procedurecode.findFirst({
        where: {
          OR: [
            ...(toBigInt(nextMeta.serviceId) ? [{ CodeNum: toBigInt(nextMeta.serviceId)! }] : []),
            { ProcCode: String(nextMeta.serviceId) },
          ],
        },
      })
      : null;

    let procedures: any[] = [];
    if (nextMeta.procedures && nextMeta.procedures.length > 0) {
      procedures = nextMeta.procedures;
    } else if (nextMeta.procedureIds && nextMeta.procedureIds.length > 0) {
      const procRows = await prisma.procedurecode.findMany({
        where: {
          OR: [
            {
              CodeNum: {
                in: nextMeta.procedureIds
                  .map((id) => toBigInt(id))
                  .filter((id): id is bigint => id !== null),
              },
            },
            {
              ProcCode: {
                in: nextMeta.procedureIds.map((id) => String(id)),
              },
            },
          ],
        },
      });
      procedures = procRows.map((proc) => buildServiceView(proc)).filter(Boolean);
    }

    return this.buildAuthorization(updated, nextMeta, {
      patient: updated.patient,
      insuranceCompany,
      service,
      procedures: procedures.length > 0 ? procedures : undefined,
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

  async getPrintableAuthorizationForm(authorizationId: string): Promise<Buffer> {
    return this.generateAdaAuthorizationPdf(authorizationId);
    /*
     * Kept below as a reference for the previous authorization-summary layout.
     * The printable preauthorization now uses the same ADA claim template as
     * regular claim printing.
     */
    /* istanbul ignore next */
    const authorization = await this.getAuthorizationById(authorizationId);

    const patientName = authorization.patient
      ? `${authorization.patient!.firstName || ''} ${authorization.patient!.lastName || ''}`.trim()
      : 'Unknown Patient';

    // Resolve requestedBy from user ID to a human-readable name
    let requestedByName = authorization.requestedBy;
    if (requestedByName && /^\d+$/.test(String(requestedByName))) {
      try {
        const user = await prisma.userod.findUnique({
          where: { UserNum: BigInt(requestedByName as string) },
        });
        if (user) {
          requestedByName = user!.UserName || requestedByName;
        }
      } catch {
        // keep raw value if lookup fails
      }
    }

    // If insuranceCompany is not set, try to resolve from the patient's insurance plan
    let insuranceCompany = authorization.insuranceCompany;
    if (!insuranceCompany && authorization.patientRefId) {
      try {
        const patSub = await prisma.inssub.findFirst({
          where: { Subscriber: BigInt(authorization.patientRefId) },
          include: {
            insplan: {
              include: { carrier: true },
            },
          },
          orderBy: { InsSubNum: 'asc' },
        });
        if (patSub?.insplan?.carrier) {
          insuranceCompany = buildInsuranceCompanyView(patSub!.insplan!.carrier);
        }
      } catch {
        // keep null if lookup fails
      }
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const colors = {
      navy: rgb(0.05, 0.19, 0.34),
      blue: rgb(0.12, 0.38, 0.75),
      text: rgb(0.10, 0.14, 0.20),
      muted: rgb(0.35, 0.40, 0.47),
      border: rgb(0.82, 0.86, 0.91),
      fill: rgb(0.96, 0.97, 0.99),
      white: rgb(1, 1, 1),
    };
    const margin = 48;
    const contentWidth = 516;
    const formatDate = (date: Date | string | null | undefined) => (
      date ? new Date(date).toISOString().slice(0, 10) : '-'
    );
    const drawSection = (title: string, y: number) => {
      page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 24, color: colors.fill });
      page.drawText(title, { x: margin + 10, y: y + 4, size: 10, font: boldFont, color: colors.navy });
      return y - 38;
    };
    const drawField = (label: string, value: unknown, x: number, y: number, width: number) => {
      page.drawText(label.toUpperCase(), { x, y, size: 7.5, font, color: colors.muted });
      page.drawText(String(value || '-'), {
        x, y: y - 14, size: 10.5, font: boldFont, color: colors.text, maxWidth: width,
      });
    };

    page.drawRectangle({ x: 0, y: 710, width: 612, height: 82, color: colors.navy });
    page.drawText('INSURANCE AUTHORIZATION FORM', { x: margin, y: 756, size: 19, font: boldFont, color: colors.white });
    page.drawText('Patient coverage and service authorization record', { x: margin, y: 738, size: 9, font, color: rgb(0.82, 0.89, 0.98) });
    page.drawText('AUTHORIZATION', { x: 402, y: 758, size: 7.5, font, color: rgb(0.75, 0.84, 0.94) });
    page.drawText(String(authorization.authorizationNumber || '-'), { x: 402, y: 742, size: 12, font: boldFont, color: colors.white });
    page.drawRectangle({ x: 402, y: 721, width: 112, height: 17, color: colors.blue });
    page.drawText(String(authorization.status || '-').toUpperCase(), { x: 412, y: 726, size: 8, font: boldFont, color: colors.white });

    let y = drawSection('PATIENT AND INSURANCE', 686);
    drawField('Patient', patientName, margin + 12, y, 230);
    drawField('Insurance company', authorization.insuranceCompany?.name, 318, y, 230);
    y -= 58;
    drawField('Patient ID', authorization.patientRefId, margin + 12, y, 230);
    drawField('Payer ID', authorization.insuranceCompany?.payerId, 318, y, 230);

    y = drawSection('AUTHORIZATION DETAILS', y - 48);
    const mainService = authorization.service || (authorization.procedures && authorization.procedures[0]) || null;
    drawField('Service', mainService?.name || mainService?.description || 'Authorization request', margin + 12, y, 230);
    drawField('CPT code', mainService?.cptCode || mainService?.code || '-', 318, y, 230);
    y -= 58;
    drawField('Requested date', formatDate(authorization.requestedDate), margin + 12, y, 150);
    drawField('Approved date', formatDate(authorization.approvedDate), 222, y, 150);
    drawField('Expiration date', formatDate(authorization.expirationDate), 396, y, 150);

    y = drawSection('SERVICES', y - 48);
    page.drawRectangle({ x: margin, y: y - 22, width: contentWidth, height: 24, color: colors.navy });
    page.drawText('SERVICE', { x: margin + 10, y: y - 14, size: 8, font: boldFont, color: colors.white });
    page.drawText('CPT CODE', { x: 355, y: y - 14, size: 8, font: boldFont, color: colors.white });
    page.drawText('UNITS', { x: 465, y: y - 14, size: 8, font: boldFont, color: colors.white });

    const proceduresToPrint = authorization.procedures?.length ? authorization.procedures : [mainService].filter(Boolean);

    if (proceduresToPrint.length === 0) {
      page.drawRectangle({ x: margin, y: y - 52, width: contentWidth, height: 30, borderColor: colors.border, borderWidth: 1, color: colors.white });
      page.drawText('Authorization request', { x: margin + 10, y: y - 41, size: 9.5, font, color: colors.text, maxWidth: 290 });
      page.drawText('-', { x: 355, y: y - 41, size: 9.5, font, color: colors.text });
      page.drawText(String(authorization.unitsAuthorized ?? '-'), { x: 465, y: y - 41, size: 9.5, font, color: colors.text });
      y -= 88;
    } else {
      let rectY = y - 52;
      for (const proc of proceduresToPrint) {
        page.drawRectangle({ x: margin, y: rectY, width: contentWidth, height: 30, borderColor: colors.border, borderWidth: 1, color: colors.white });
        page.drawText(String(proc?.name || proc?.description || 'Authorization request'), { x: margin + 10, y: rectY + 11, size: 9.5, font, color: colors.text, maxWidth: 290 });
        page.drawText(String(proc?.cptCode || proc?.code || '-'), { x: 355, y: rectY + 11, size: 9.5, font, color: colors.text });
        page.drawText(String(authorization.unitsAuthorized ?? '-'), { x: 465, y: rectY + 11, size: 9.5, font, color: colors.text });
        rectY -= 30;
      }
      y = rectY - 36;
    }
    y = drawSection('NOTES', y);
    page.drawText(String(authorization.notes || 'No notes provided.'), { x: margin + 12, y: y - 8, size: 10, font, color: colors.text, maxWidth: contentWidth - 24 });

    page.drawLine({ start: { x: margin, y: 52 }, end: { x: margin + contentWidth, y: 52 }, thickness: 1, color: colors.border });
    page.drawText('Generated from MedFlow', { x: margin, y: 35, size: 8, font, color: colors.muted });
    page.drawText(`Generated ${new Date().toISOString()}`, { x: 350, y: 35, size: 8, font, color: colors.muted });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private async generateAdaAuthorizationPdf(authorizationId: string): Promise<Buffer> {
    const authorization = await this.getAuthorizationById(authorizationId);
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
      include: {
        patient: true,
        provider_claim_ProvTreatToprovider: true,
        provider_claim_ProvBillToprovider: true,
        insplan_claim_PlanNumToinsplan: { include: { carrier: true } },
      },
    });

    if (!claim) throw new NotFoundError('Authorization not found');

    const sourceTemplatePath = path.join(process.cwd(), 'src/assets/templates/ada-claim-template.pdf');
    const compiledTemplatePath = path.join(process.cwd(), 'dist/assets/templates/ada-claim-template.pdf');
    const templatePath = fs.existsSync(sourceTemplatePath) ? sourceTemplatePath : compiledTemplatePath;
    const templateBytes = await fs.promises.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    while (pdfDoc.getPageCount() > 1) {
      pdfDoc.removePage(pdfDoc.getPageCount() - 1);
    }
    const page = pdfDoc.getPages()[0];
    const drawText = (value: unknown, x: number, y: number, size = 8) => {
      if (value === null || value === undefined || String(value).trim() === '') return;
      page.drawText(String(value), { x, y, size, color: rgb(0, 0, 0) });
    };
    const fillCheckbox = (x: number, y: number) => {
      page.drawRectangle({ x, y, width: 7, height: 7, color: rgb(0, 0, 0) });
    };
    const patient = claim.patient;
    const carrier = claim.insplan_claim_PlanNumToinsplan?.carrier;
    const treating = claim.provider_claim_ProvTreatToprovider;
    const billing = claim.provider_claim_ProvBillToprovider || treating;
    const procedures = Array.isArray(authorization.procedures) ? authorization.procedures : [];
    const procedureCodes = procedures
      .map((procedure: any) => procedure.code || procedure.procedureCode || procedure.cptCode || procedure.ProcCode)
      .filter(Boolean)
      .map(String);
    const procedureIds = procedures
      .map((procedure: any) => procedure.id || procedure._id || procedure.procedureId)
      .filter((id: any) => id !== undefined && id !== null && /^\d+$/.test(String(id)))
      .map((id: any) => BigInt(String(id)));
    const treatmentPlanRows = claim.PatNum && (procedureCodes.length || procedureIds.length)
      ? await prisma.proctp.findMany({
        where: {
          PatNum: claim.PatNum,
          OR: [
            ...(procedureCodes.length ? [{ ProcCode: { in: procedureCodes } }] : []),
            ...(procedureIds.length ? [{ ProcTPNum: { in: procedureIds } }] : []),
          ],
        },
        orderBy: { ItemOrder: 'asc' },
      })
      : [];

    // Insurance and subscriber sections.
    drawText(carrier?.CarrierName, 55, 648, 8);
    drawText(carrier?.Address, 55, 638, 7);
    drawText([carrier?.City, carrier?.State, carrier?.Zip].filter(Boolean).join(', '), 55, 628, 7);
    drawText(authorization.authorizationNumber, 480, 595, 8);

    if (patient) {
      const patientName = `${patient.LName || ''}, ${patient.FName || ''} ${patient.MiddleI || ''}`.trim();
      drawText(patientName, 360, 545, 9);
      drawText(patient.Address, 360, 532, 9);
      drawText(`${patient.City || ''}, ${patient.State || ''} ${patient.Zip || ''}`.trim(), 360, 519, 9);
      if (patient.Birthdate) {
        const dob = new Date(patient.Birthdate);
        drawText(`${String(dob.getMonth() + 1).padStart(2, '0')}/${String(dob.getDate()).padStart(2, '0')}/${dob.getFullYear()}`, 360, 482, 9);
      }
      drawText(patient.PatNum?.toString(), 480, 482, 9);
      if (patient.Gender === 0) fillCheckbox(386, 482);
      if (patient.Gender === 1) fillCheckbox(415, 482);
    }

    // A single provider is intentionally used for both treating and billing.
    const billingName = `${billing?.LName || ''}, ${billing?.FName || ''}`.trim();
    drawText(billingName, 55, 100, 9);
    drawText(billing?.NationalProvID, 45, 40, 9);
    drawText(treating?.NationalProvID || billing?.NationalProvID, 370, 75, 9);
    drawText(treating?.StateLicense || billing?.StateLicense, 520, 75, 9);

    const serviceDate = claim.DateService ? new Date(claim.DateService) : new Date();
    const dateText = `${String(serviceDate.getMonth() + 1).padStart(2, '0')}/${String(serviceDate.getDate()).padStart(2, '0')}/${serviceDate.getFullYear()}`;
    let y = 435;
    let totalFee = 0;
    for (const procedure of procedures.slice(0, 10)) {
      const procedureCode = String(procedure.code || procedure.procedureCode || procedure.cptCode || procedure.ProcCode || '');
      const procedureId = String(procedure.id || procedure._id || procedure.procedureId || '');
      const treatmentPlanRow = treatmentPlanRows.find((row: any) => (
        String(row.ProcCode || '') === procedureCode || String(row.ProcTPNum || '') === procedureId
      ));
      const fee = Number(
        procedure.fee ?? procedure.amount ?? procedure.charge ?? procedure.negRate ?? treatmentPlanRow?.FeeAmt ?? 0
      ) || 0;
      drawText(dateText, 50, y, 8);
      drawText(procedure.tooth || procedure.site || procedure.surf, 160, y, 8);
      drawText(procedure.surface || procedure.Surf, 240, y, 8);
      drawText(procedure.code || procedure.procedureCode || procedure.cptCode, 275, y, 8);
      drawText(procedure.description || procedure.name || procedure.treatment, 380, y, 8);
      drawText(fee.toFixed(2), 560, y, 8);
      totalFee += fee;
      y -= 13.75;
    }
    drawText(totalFee.toFixed(2), 560, 290, 9);

    return Buffer.from(await pdfDoc.save());
  }

  async deleteAuthorization(authorizationId: string) {
    const auth = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(authorizationId) },
    });

    if (!auth || auth.ClaimType !== 'PreAuth') {
      throw new NotFoundError('Authorization not found');
    }

    // Cascade delete any claims that were generated from this authorization
    if (auth.PreAuthString || auth.PriorAuthorizationNumber) {
      const authString = auth.PreAuthString || auth.PriorAuthorizationNumber;
      if (authString) {
        const associatedClaims = await prisma.claim.findMany({
          where: { 
            OR: [
              { PriorAuthorizationNumber: authString },
              { PreAuthString: authString }
            ],
            ClaimNum: { not: auth.ClaimNum } 
          }
        });
        
        for (const associatedClaim of associatedClaims) {
          await prisma.$transaction([
            prisma.claimtracking.deleteMany({ where: { ClaimNum: associatedClaim.ClaimNum } }),
            prisma.claimproc.deleteMany({ where: { ClaimNum: associatedClaim.ClaimNum } }),
            prisma.claimattach.deleteMany({ where: { ClaimNum: associatedClaim.ClaimNum } }),
            prisma.claim.delete({ where: { ClaimNum: associatedClaim.ClaimNum } }),
          ]);
        }
      }
    }

    await prisma.$transaction([
      prisma.claimtracking.deleteMany({ where: { ClaimNum: auth.ClaimNum } }),
      prisma.claimproc.deleteMany({ where: { ClaimNum: auth.ClaimNum } }),
      prisma.claimattach.deleteMany({ where: { ClaimNum: auth.ClaimNum } }),
      prisma.claim.delete({ where: { ClaimNum: auth.ClaimNum } }),
    ]);

    return { message: 'Authorization and associated claims deleted successfully' };
  }
}

export const authorizationService = new AuthorizationService();
