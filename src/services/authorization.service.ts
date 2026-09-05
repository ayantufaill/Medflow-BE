import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
      const procedures = (meta.procedureIds || [])
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
    if (meta.procedureIds && meta.procedureIds.length > 0) {
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
    procedures?: string[];
    order?: string;
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
    const rawProcIds = data.procedureIds || data.procedures;
    const resolvedProcedureIds = rawProcIds ? rawProcIds.map((id) => String(id)) : undefined;

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
      order: data.order ?? 'Primary',
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
    if (meta.procedureIds && meta.procedureIds.length > 0) {
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
      procedures: string[];
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
    const rawProcIds = updates.procedureIds || updates.procedures;
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
      order: updates.order ?? meta.order,
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
    if (nextMeta.procedureIds && nextMeta.procedureIds.length > 0) {
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
    const authorization = await this.getAuthorizationById(authorizationId);

    const patientName = authorization.patient
      ? `${authorization.patient.firstName || ''} ${authorization.patient.lastName || ''}`.trim()
      : 'Unknown Patient';

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
    drawField('Service', authorization.service?.name, margin + 12, y, 230);
    drawField('CPT code', authorization.service?.cptCode, 318, y, 230);
    y -= 58;
    drawField('Requested date', formatDate(authorization.requestedDate), margin + 12, y, 150);
    drawField('Approved date', formatDate(authorization.approvedDate), 222, y, 150);
    drawField('Expiration date', formatDate(authorization.expirationDate), 396, y, 150);
    y -= 58;
    drawField('Units authorized', authorization.unitsAuthorized, margin + 12, y, 150);
    drawField('Units used', authorization.unitsUsed ?? 0, 222, y, 150);
    drawField('Requested by', authorization.requestedBy, 396, y, 150);

    y = drawSection('SERVICES', y - 48);
    page.drawRectangle({ x: margin, y: y - 22, width: contentWidth, height: 24, color: colors.navy });
    page.drawText('SERVICE', { x: margin + 10, y: y - 14, size: 8, font: boldFont, color: colors.white });
    page.drawText('CPT CODE', { x: 355, y: y - 14, size: 8, font: boldFont, color: colors.white });
    page.drawText('UNITS', { x: 465, y: y - 14, size: 8, font: boldFont, color: colors.white });
    page.drawRectangle({ x: margin, y: y - 52, width: contentWidth, height: 30, borderColor: colors.border, borderWidth: 1, color: colors.white });
    page.drawText(String(authorization.service?.name || 'Authorization request'), { x: margin + 10, y: y - 41, size: 9.5, font, color: colors.text, maxWidth: 290 });
    page.drawText(String(authorization.service?.cptCode || '-'), { x: 355, y: y - 41, size: 9.5, font, color: colors.text });
    page.drawText(String(authorization.unitsAuthorized ?? '-'), { x: 465, y: y - 41, size: 9.5, font, color: colors.text });

    y -= 88;
    y = drawSection('NOTES', y);
    page.drawText(String(authorization.notes || 'No notes provided.'), { x: margin + 12, y: y - 8, size: 10, font, color: colors.text, maxWidth: contentWidth - 24 });

    page.drawLine({ start: { x: margin, y: 52 }, end: { x: margin + contentWidth, y: 52 }, thickness: 1, color: colors.border });
    page.drawText('Generated from MedFlow', { x: margin, y: 35, size: 8, font, color: colors.muted });
    page.drawText(`Generated ${new Date().toISOString()}`, { x: 350, y: 35, size: 8, font, color: colors.muted });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
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
