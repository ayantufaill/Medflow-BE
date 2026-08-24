import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import { prisma } from '../config/db';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { uploadToS3, deleteFromS3 } from '../utils/s3.util';
import { logActivity } from '../utils/activity-logger.util';
import { agingService } from './aging.service';

type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'partially_paid'
  | 'accepted'
  | 'acceptedPaid'
  | 'denied'
  | 'rejected'
  | 'cancelled'
  | 'error'
  | 'validationError'
  | 'inProcess'
  | 'eobUploaded'
  | 'readyForSubmission'
  | 'manualClaim'
  | 'acceptedForProcessing';

type ClaimMeta = {
  invoiceId?: string;
  treatmentPlanId?: string;
  procedures?: any[];
  selectedItems?: any[];
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
  claimFormat?: string;
  isHidden?: boolean;
  providerSignature?: string;
  patientSignature?: string;
  eobs?: { id: string; filename: string; storagePath: string; uploadedAt: string; size: string; url?: string }[];
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
  tab?: string;
  carrierName?: string;
  hasAttachment?: boolean | string;
  claimFormat?: string;
  showHidden?: boolean | string;
  patientName?: string;
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
    case 'acceptedpaid':
      return 'acceptedPaid';
    case 'denied':
      return 'denied';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'error':
      return 'error';
    case 'validationerror':
      return 'validationError';
    case 'inprocess':
      return 'inProcess';
    case 'eobuploaded':
      return 'eobUploaded';
    case 'readyforsubmission':
      return 'readyForSubmission';
    case 'manualclaim':
      return 'manualClaim';
    case 'acceptedforprocessing':
      return 'acceptedForProcessing';
    default:
      return 'draft';
  }
};

const claimStatusToCode = (status?: string | null): string => {
  switch (normalizeClaimStatus(status)) {
    case 'readyForSubmission':
      return 'W';
    case 'submitted':
    case 'inProcess':
    case 'manualClaim':
    case 'acceptedForProcessing':
      return 'S';
    case 'pending':
      return 'P';
    case 'paid':
    case 'accepted':
    case 'acceptedPaid':
    case 'eobUploaded':
      return 'R';
    case 'partial':
    case 'partially_paid':
      return 'T';
    case 'denied':
      return 'D';
    case 'rejected':
    case 'error':
    case 'validationError':
      return 'X';
    case 'cancelled':
      return 'C';
    default:
      return 'H';
  }
};

const claimCodeToStatus = (code?: string | null): ClaimStatus => {
  switch ((code || '').toUpperCase()) {
    case 'W':
      return 'readyForSubmission';
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
    address: row.Address ?? '',
    address2: row.Address2 ?? '',
    city: row.City ?? '',
    state: row.State ?? '',
    zip: row.Zip ?? '',
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

  private mapClaim(row: any, meta: ClaimMeta, context: { invoice?: any; insurance?: any; procedures?: any[] }) {
    const status = normalizeClaimStatus(meta.status ?? claimCodeToStatus(row.ClaimStatus));
    const patient = row.patient ? mapPatientToApi(row.patient) : null;

    const mapProvider = (prov: any) => {
      if (!prov) return null;
      return {
        _id: prov.ProvNum.toString(),
        firstName: prov.FName || '',
        lastName: prov.LName || '',
        npi: prov.NationalProvID || '',
        tin: prov.SSN || '',
      };
    };

    const billingProvider = row.provider_claim_ProvBillToprovider ? mapProvider(row.provider_claim_ProvBillToprovider) : null;
    const treatingProvider = row.provider_claim_ProvTreatToprovider ? mapProvider(row.provider_claim_ProvTreatToprovider) : null;

    let subscriberDetails = null;
    if (row.inssub_claim_InsSubNumToinssub) {
      const inssub = row.inssub_claim_InsSubNumToinssub;
      const subPatient = inssub.patient;
      const insplan = row.insplan_claim_PlanNumToinsplan;
      subscriberDetails = {
        _id: inssub.InsSubNum.toString(),
        memberId: inssub.SubscriberID || '',
        groupNumber: insplan?.GroupNum || '',
        relationshipToSubscriber: row.PatRelat || 1,
        firstName: subPatient?.FName || subPatient?.firstName || '',
        lastName: subPatient?.LName || subPatient?.lastName || '',
        dateOfBirth: subPatient?.Birthdate || subPatient?.dateOfBirth || null,
        address: subPatient?.Address || subPatient?.address || '',
        city: subPatient?.City || subPatient?.city || '',
        state: subPatient?.State || subPatient?.state || '',
        zip: subPatient?.Zip || subPatient?.zip || '',
        gender: subPatient?.Gender || subPatient?.gender || '',
      };
    }

    return {
      _id: row.ClaimNum.toString(),
      id: row.ClaimNum.toString(),
      claimNumber: row.PreAuthString ?? row.PriorAuthorizationNumber ?? row.ClaimIdentifier ?? `CLM${row.ClaimNum.toString().padStart(6, '0')}`,
      claimCode: row.PreAuthString ?? row.PriorAuthorizationNumber ?? row.ClaimIdentifier ?? `CLM${row.ClaimNum.toString().padStart(6, '0')}`,
      patientRefId: row.PatNum?.toString() ?? null,
      patientId: patient ?? row.PatNum?.toString() ?? null,
      patient,
      subscriberDetails,
      billingProvider,
      treatingProvider,
      invoiceRefId: meta.invoiceId ?? null,
      invoiceId: context.invoice ?? meta.invoiceId ?? null,
      invoice: context.invoice ?? null,
      insuranceCompanyRefId: meta.insuranceCompanyId ?? null,
      insuranceCompanyId: context.insurance ?? meta.insuranceCompanyId ?? null,
      insuranceCompany: context.insurance ?? (row.insplan_claim_PlanNumToinsplan?.carrier ? {
        name: row.insplan_claim_PlanNumToinsplan.carrier.CarrierName,
        payerId: row.insplan_claim_PlanNumToinsplan.carrier.ElectID || '00000',
      } : null),
      insuranceType: meta.insuranceType ?? 'primary',
      status,
      submissionDate: meta.submissionDate ? new Date(meta.submissionDate) : row.DateSent ?? row.DateService ?? null,
      submittedDate: meta.submissionDate ? new Date(meta.submissionDate) : row.DateSent ?? row.DateService ?? null,
      submittedAmount:
        Number(meta.submittedAmount ?? row.InsPayEst ?? meta.claimAmount ?? meta.totalAmount ?? row.ClaimFee) || 0,
      claimAmount: Number(meta.claimAmount ?? meta.totalAmount ?? row.ClaimFee ?? row.InsPayEst) || 0,
      totalAmount: Number(meta.totalAmount ?? meta.claimAmount ?? row.ClaimFee ?? row.InsPayEst) || 0,
      paidAmount: Number(meta.paidAmount ?? row.InsPayAmt) || 0,
      patientResponsibility: Number(meta.patientResponsibility ?? row.DedApplied) || 0,
      insbalance: Number(meta.submittedAmount ?? row.InsPayEst ?? (Number(row.ClaimFee || 0) - Number(meta.patientResponsibility ?? row.DedApplied ?? 0))) || 0,
      patbalance: Number(meta.patientResponsibility ?? row.DedApplied) || 0,
      insuranceBalance: Number(meta.submittedAmount ?? row.InsPayEst ?? (Number(row.ClaimFee || 0) - Number(meta.patientResponsibility ?? row.DedApplied ?? 0))) || 0,
      patientBalance: Number(meta.patientResponsibility ?? row.DedApplied) || 0,
      insurancePortion: Number(meta.submittedAmount ?? row.InsPayEst) || 0,
      patientPortion: Number(meta.patientResponsibility ?? row.DedApplied) || 0,
      denialReason: meta.denialReason ?? row.ReasonUnderPaid ?? null,
      deniedDate: meta.deniedDate ? new Date(meta.deniedDate) : null,
      denialDate: meta.deniedDate ? new Date(meta.deniedDate) : null,
      paidDate: meta.paidDate ? new Date(meta.paidDate) : null,
      policyNumber: meta.policyNumber ?? row.RefNumString ?? null,
      notes: meta.notes ?? row.ClaimNote ?? null,
      createdAt: row.SecDateEntry ?? row.DateService ?? null,
      updatedAt: row.SecDateTEdit ?? row.DateService ?? null,
      procedures: context.procedures ?? [],
      selectedItems: meta.selectedItems || [],
      claimFormat: meta.claimFormat ?? (row.ClaimType === 'Manual' ? 'Paper' : 'E-claim'),
      isHidden: meta.isHidden ?? false,
      providerSignature: meta.providerSignature ?? null,
      patientSignature: meta.patientSignature ?? null,
      eobs: meta.eobs || [],
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

  private async getProceduresForClaims(claimIds: string[]) {
    if (!claimIds.length) return new Map<string, any[]>();

    const claimBigInts = claimIds
      .map((id) => toBigInt(id))
      .filter((id): id is bigint => id !== null);

    const claimProcs = await prisma.claimproc.findMany({
      where: {
        ClaimNum: { in: claimBigInts },
      },
      include: {
        procedurelog: {
          include: {
            procedurecode_procedurelog_CodeNumToprocedurecode: true,
            provider_procedurelog_ProvNumToprovider: true,
          },
        },
      },
    });

    const proceduresByClaimId = new Map<string, any[]>();

    for (const cp of claimProcs) {
      if (!cp.ClaimNum) continue;
      const claimId = cp.ClaimNum.toString();
      if (!proceduresByClaimId.has(claimId)) {
        proceduresByClaimId.set(claimId, []);
      }

      const procLog = cp.procedurelog;
      if (procLog) {
        proceduresByClaimId.get(claimId)!.push({
          id: procLog.ProcNum.toString(),
          _id: procLog.ProcNum.toString(),
          appointmentId: procLog.AptNum?.toString() ?? null,
          patientId: procLog.PatNum?.toString() ?? null,
          codeNum: procLog.CodeNum?.toString() ?? null,
          code: procLog.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? procLog.OldCode ?? null,
          name: procLog.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? procLog.BillingNote ?? 'Procedure',
          description: procLog.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? procLog.BillingNote ?? 'Procedure',
          tooth: procLog.ToothNum ?? null,
          surface: procLog.Surf ?? null,
          status: procLog.ProcStatus ?? null,
          quantity: procLog.UnitQty ?? 1,
          fee: cp.FeeBilled ?? procLog.ProcFee ?? 0,
          providerId: procLog.ProvNum?.toString() ?? null,
          providerName: procLog.provider_procedurelog_ProvNumToprovider ? `${procLog.provider_procedurelog_ProvNumToprovider.FName} ${procLog.provider_procedurelog_ProvNumToprovider.LName}`.trim() : null,
          dateOfService: procLog.ProcDate ?? null,
          placeOfService: procLog.PlaceService ?? null,
          createdAt: procLog.SecDateEntry ?? null,
        });
      }
    }

    return proceduresByClaimId;
  }

  private async attachProceduresToPagedClaims(paged: any[]) {
    if (!paged.length) return;

    const pagedClaimIds = paged.map((c) => c.id);
    const proceduresByClaimId = await this.getProceduresForClaims(pagedClaimIds);

    // Fallback: If claim has no procedures via claimproc, fetch procedures of the associated invoice (Statement)
    const claimsWithoutProcs = paged.filter(
      (c) => (!proceduresByClaimId.has(c.id) || proceduresByClaimId.get(c.id)!.length === 0) && c.invoiceRefId
    );

    if (claimsWithoutProcs.length > 0) {
      const invoiceIds = claimsWithoutProcs
        .map((c) => toBigInt(c.invoiceRefId))
        .filter((id): id is bigint => id !== null);

      if (invoiceIds.length > 0) {
        const invoiceProcs = await prisma.procedurelog.findMany({
          where: {
            StatementNum: { in: invoiceIds },
          },
          include: {
            procedurecode_procedurelog_CodeNumToprocedurecode: true,
            provider_procedurelog_ProvNumToprovider: true,
          },
        });

        const procsByInvoiceId = new Map<string, any[]>();
        for (const proc of invoiceProcs) {
          if (!proc.StatementNum) continue;
          const invId = proc.StatementNum.toString();
          if (!procsByInvoiceId.has(invId)) {
            procsByInvoiceId.set(invId, []);
          }
          procsByInvoiceId.get(invId)!.push({
            id: proc.ProcNum.toString(),
            _id: proc.ProcNum.toString(),
            appointmentId: proc.AptNum?.toString() ?? null,
            patientId: proc.PatNum?.toString() ?? null,
            codeNum: proc.CodeNum?.toString() ?? null,
            code: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? null,
            name: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
            description: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
            tooth: proc.ToothNum ?? null,
            surface: proc.Surf ?? null,
            status: proc.ProcStatus ?? null,
            quantity: proc.UnitQty ?? 1,
            fee: proc.ProcFee ?? 0,
            providerId: proc.ProvNum?.toString() ?? null,
            providerName: proc.provider_procedurelog_ProvNumToprovider ? `${proc.provider_procedurelog_ProvNumToprovider.FName} ${proc.provider_procedurelog_ProvNumToprovider.LName}`.trim() : null,
            dateOfService: proc.ProcDate ?? null,
            placeOfService: proc.PlaceService ?? null,
            createdAt: proc.SecDateEntry ?? null,
          });
        }

        for (const claim of claimsWithoutProcs) {
          const procs = procsByInvoiceId.get(claim.invoiceRefId) ?? [];
          proceduresByClaimId.set(claim.id, procs);
        }
      }
    }

    for (const claim of paged) {
      claim.procedures = proceduresByClaimId.get(claim.id) ?? [];
    }
  }

  private async getClaimRecord(claimId: string) {
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claimId) },
      include: { 
        patient: true,
        provider_claim_ProvTreatToprovider: true,
        provider_claim_ProvBillToprovider: true,
        inssub_claim_InsSubNumToinssub: {
          include: {
            patient: true,
          }
        },
        insplan_claim_PlanNumToinsplan: {
          include: {
            carrier: true,
          },
        },
      },
    });

    if (!claim || claim.ClaimType === 'PreAuth') {
      throw new NotFoundError('Claim not found');
    }

    return claim;
  }

  async getAllClaims(page = 1, limit = 10, filters: ClaimFilters = {}) {
    const where: any = {};
    if (filters.tab && filters.tab.toLowerCase() === 'predetermination') {
      where.ClaimType = 'PreAuth';
    } else {
      where.ClaimType = { not: 'PreAuth' };
    }

    if (filters.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }

    if (filters.status && filters.status !== 'all') {
      const dbStatus = claimStatusToCode(filters.status);
      where.ClaimStatus = dbStatus;
    }

    if (filters.tab) {
      const tab = filters.tab.toLowerCase();
      if (tab === 'unsent') {
        where.ClaimStatus = { in: ['H', 'X', 'D', 'W'] };
      } else if (tab === 'errored') {
        where.ClaimStatus = { in: ['X', 'D'] };
      } else if (tab === 'rejected') {
        where.ClaimStatus = 'X';
      } else if (tab === 'history') {
        where.ClaimStatus = { not: 'H' };
      } else if (tab === 'outstanding') {
        where.ClaimStatus = { in: ['S', 'P', 'R', 'T'] };
      }
    }

    if (filters.search) {
      const searchNum = /^\d+$/.test(filters.search) ? BigInt(filters.search) : null;
      where.OR = [
        { PreAuthString: { contains: filters.search, mode: 'insensitive' } },
        { PriorAuthorizationNumber: { contains: filters.search, mode: 'insensitive' } },
        { ClaimIdentifier: { contains: filters.search, mode: 'insensitive' } },
        ...(searchNum !== null ? [{ ClaimNum: searchNum }] : []),
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.DateService = {};
      if (filters.startDate) where.DateService.gte = new Date(filters.startDate);
      if (filters.endDate) where.DateService.lte = new Date(filters.endDate);
    }

    const rows = await prisma.claim.findMany({
      where,
      include: { 
        patient: true, 
        provider_claim_ProvTreatToprovider: true,
        insplan_claim_PlanNumToinsplan: {
          include: { carrier: true },
        },
      },
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

    if (filters.tab) {
      const tab = filters.tab.toLowerCase();
      if (tab === 'unsent') {
        claims = claims.filter((claim) => ['draft', 'error', 'validationError', 'rejected', 'denied', 'readyForSubmission'].includes(claim.status));
      } else if (tab === 'errored') {
        claims = claims.filter((claim) => ['rejected', 'denied', 'validationError', 'error'].includes(claim.status));
      } else if (tab === 'rejected') {
        claims = claims.filter((claim) => claim.status === 'rejected');
      } else if (tab === 'history') {
        claims = claims.filter((claim) => claim.status !== 'draft');
      } else if (tab === 'outstanding') {
        claims = claims.filter((claim) => ['submitted', 'pending', 'partial', 'partially_paid', 'accepted', 'acceptedPaid', 'acceptedForProcessing', 'inProcess', 'eobUploaded'].includes(claim.status));
      }
    }

    if (filters.carrierName) {
      const carrier = filters.carrierName.toLowerCase();
      claims = claims.filter((claim) =>
        String(claim.insuranceCompany?.name || '').toLowerCase().includes(carrier)
      );
    }

    const hasAttachment = filters.hasAttachment === true || filters.hasAttachment === 'true';
    if (hasAttachment) {
      const documents = await prisma.document.findMany({
        where: {
          Note: { contains: '"claimId":' }
        },
        select: { Note: true }
      });
      const claimIdsWithAttachments = new Set<string>();
      for (const doc of documents) {
        const docMeta = parseJson<Record<string, any>>(doc.Note);
        if (docMeta.claimId) {
          claimIdsWithAttachments.add(String(docMeta.claimId));
        }
      }
      claims = claims.filter((claim) => claimIdsWithAttachments.has(claim.id));
    }

    if (filters.claimFormat) {
      const format = filters.claimFormat.toLowerCase();
      claims = claims.filter((claim) => {
        const currentFormat = (claim.claimFormat || '').toLowerCase();
        console.log(`Filtering claim ${claim.id}: currentFormat='${currentFormat}', format='${format}'`);
        return currentFormat.includes(format) || 
               (format === 'paper' && currentFormat === 'manual') || 
               (format === 'manual' && currentFormat === 'paper');
      });
    }

    const showHidden = filters.showHidden === true || filters.showHidden === 'true';
    if (!showHidden) {
      claims = claims.filter((claim) => !claim.isHidden);
    }

    if (filters.patientName) {
      const patName = filters.patientName.toLowerCase();
      claims = claims.filter((claim) => {
        const fullName = `${claim.patient?.firstName || ''} ${claim.patient?.lastName || ''}`.toLowerCase();
        return fullName.includes(patName);
      });
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      claims = claims.filter((claim) => {
        const claimNum = String(claim.claimNumber || '').toLowerCase();
        const claimCd = String(claim.claimCode || '').toLowerCase();
        
        let sentDtStr = '';
        if (claim.submissionDate) {
          const d = new Date(claim.submissionDate);
          sentDtStr = d.toLocaleDateString().toLowerCase();
        }
        
        return claimNum.includes(search) || claimCd.includes(search) || sentDtStr.includes(search);
      });
    }

    const total = claims.length;
    const skip = (page - 1) * limit;
    const paged = claims.slice(skip, skip + limit);

    await this.attachProceduresToPagedClaims(paged);

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

    const [invoiceById, insuranceById, proceduresByClaimId] = await Promise.all([
      this.buildInvoiceContext(meta.invoiceId ? [meta.invoiceId] : []),
      this.buildInsuranceContext(meta.insuranceCompanyId ? [meta.insuranceCompanyId] : []),
      this.getProceduresForClaims([claimId]),
    ]);

    let procedures = proceduresByClaimId.get(claimId) ?? [];
    if (procedures.length === 0 && meta.invoiceId) {
      const invoiceIdBigInt = toBigInt(meta.invoiceId);
      if (invoiceIdBigInt) {
        const invoiceProcs = await prisma.procedurelog.findMany({
          where: { StatementNum: invoiceIdBigInt },
          include: { 
            procedurecode_procedurelog_CodeNumToprocedurecode: true,
            provider_procedurelog_ProvNumToprovider: true 
          },
        });
        procedures = invoiceProcs.map((proc) => {
          const prov = proc.provider_procedurelog_ProvNumToprovider;
          let providerName = prov ? `${prov.FName ?? ''} ${prov.LName ?? ''}`.trim() : null;
          if (!providerName && proc.BillingNote) {
             try {
                const bn = JSON.parse(proc.BillingNote);
                if (bn.provider) providerName = bn.provider;
             } catch(e) {}
          }
          
          return {
            id: proc.ProcNum.toString(),
            _id: proc.ProcNum.toString(),
            appointmentId: proc.AptNum?.toString() ?? null,
            patientId: proc.PatNum?.toString() ?? null,
            codeNum: proc.CodeNum?.toString() ?? null,
            code: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? null,
            name: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? (proc.BillingNote ? 'Procedure' : 'Procedure'),
            description: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? (proc.BillingNote ? 'Procedure' : 'Procedure'),
            tooth: proc.ToothNum ?? null,
            surface: proc.Surf ?? null,
            status: proc.ProcStatus ?? null,
            quantity: proc.UnitQty ?? 1,
            fee: Number(proc.ProcFee ?? 0),
            providerId: proc.ProvNum?.toString() ?? null,
            providerName: providerName,
            dateOfService: proc.ProcDate ?? null,
            placeOfService: proc.PlaceService ?? null,
            createdAt: proc.SecDateEntry ?? null,
          };
        });
      }
    }

    const claim = this.mapClaim(row, meta, {
      invoice: meta.invoiceId ? invoiceById.get(meta.invoiceId) : null,
      insurance: meta.insuranceCompanyId ? insuranceById.get(meta.insuranceCompanyId) : null,
      procedures,
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

    const invoiceProcs = invoice.PatNum ? await prisma.procedurelog.findMany({
      where: { StatementNum: invoice.StatementNum },
    }) : [];

    let insPayEst = Number(invoice.InsEst || invoiceMeta.insurancePortion || 0);
    let patientResponsibility = Number(invoiceMeta.patientPortion || 0);

    let sumIns = 0;
    let sumPt = 0;
    let hasPortions = false;
    for (const proc of invoiceProcs) {
      if (proc.BillingNote) {
        try {
          const bn = JSON.parse(proc.BillingNote);
          if (bn.insPortion !== undefined || bn.ptPortion !== undefined) {
            sumIns += Number(bn.insPortion || 0);
            sumPt += Number(bn.ptPortion || 0);
            hasPortions = true;
          }
        } catch (e) {}
      }
    }

    if (hasPortions) {
      insPayEst = sumIns;
      patientResponsibility = sumPt;
    } else if (invoice.PatNum && invoiceProcs.length > 0) {
      const { invoiceService } = await import('./invoice.service');
      const simulated = invoiceProcs.map(proc => {
        const meta = parseJson<any>(proc.BillingNote);
        return {
          ...meta,
          ProcFee: proc.ProcFee,
          serviceId: proc.CodeNum?.toString()
        };
      });
      const enriched = await invoiceService.calculateInsuranceEstimates(invoice.PatNum, simulated);
      insPayEst = enriched.reduce((sum: number, item: any) => sum + (Number(item.insPortion) || 0), 0);
      patientResponsibility = enriched.reduce((sum: number, item: any) => sum + (Number(item.ptPortion) || 0), 0);
    }

    if (!patientResponsibility && claimAmount > insPayEst && insPayEst > 0) {
      patientResponsibility = Math.max(0, claimAmount - insPayEst);
    }

    const claimMeta: ClaimMeta = {
      invoiceId,
      insuranceCompanyId: data.insuranceCompanyId ?? invoiceMeta.insuranceCompanyId ?? undefined,
      insuranceType: data.insuranceType ?? 'primary',
      status,
      claimAmount,
      submittedAmount: insPayEst > 0 ? insPayEst : Number(data.submittedAmount ?? claimAmount) || claimAmount,
      totalAmount: claimAmount,
      paidAmount: 0,
      patientResponsibility,
      policyNumber: data.policyNumber,
      notes: data.notes,
    };

    const claimNum = await getNextId('claim', 'ClaimNum');
    
    const patPlan = invoice.PatNum ? await prisma.patplan.findFirst({
      where: { PatNum: invoice.PatNum, Ordinal: 1 },
      include: { inssub: true }
    }) : null;
    
    const treatingProv = invoiceProcs[0]?.ProvNum;
    const patientRow = invoice.PatNum ? await prisma.patient.findUnique({
      where: { PatNum: invoice.PatNum },
    }) : null;
    const billingProv = patientRow?.PriProv || treatingProv;

    const created = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: invoice.PatNum ?? null,
        PlanNum: patPlan?.inssub?.PlanNum ?? null,
        InsSubNum: patPlan?.InsSubNum ?? null,
        ProvTreat: treatingProv ?? null,
        ProvBill: billingProv ?? null,
        ClaimType: data.insuranceType ?? 'Primary',
        ClaimStatus: claimStatusToCode(status),
        DateService: new Date(),
        ClaimFee: claimAmount,
        InsPayEst: insPayEst > 0 ? insPayEst : claimAmount,
        InsPayAmt: 0,
        DedApplied: patientResponsibility,
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

    const invoiceIdBigInt = toBigInt(invoiceId);
    let procedures: any[] = [];
    if (invoiceIdBigInt) {
      const invoiceProcs = await prisma.procedurelog.findMany({
        where: { StatementNum: invoiceIdBigInt },
        include: { 
          procedurecode_procedurelog_CodeNumToprocedurecode: true,
          provider_procedurelog_ProvNumToprovider: true,
        },
      });

      if (invoiceProcs.length > 0) {
        await Promise.all(
          invoiceProcs.map(async (proc) => {
            const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
            let insPortion = 0;
            let ptPortion = 0;
            if (proc.BillingNote) {
              try {
                const bn = JSON.parse(proc.BillingNote);
                insPortion = Number(bn.insPortion || 0);
                ptPortion = Number(bn.ptPortion || 0);
              } catch (e) {}
            }
            await prisma.claimproc.create({
              data: {
                ClaimProcNum: claimProcNum,
                ClaimNum: created.ClaimNum,
                ProcNum: proc.ProcNum,
                PatNum: created.PatNum,
                ProvNum: proc.ProvNum ?? created.ProvTreat,
                PlanNum: created.PlanNum,
                InsSubNum: created.InsSubNum,
                ClinicNum: proc.ClinicNum,
                DateCP: new Date(),
                ProcDate: proc.ProcDate,
                DateEntry: new Date(),
                Status: 0,
                FeeBilled: proc.ProcFee,
                InsPayEst: insPortion,
                DedApplied: ptPortion,
                InsPayAmt: 0,
              }
            });
          })
        );
      }

      procedures = invoiceProcs.map((proc) => ({
        id: proc.ProcNum.toString(),
        _id: proc.ProcNum.toString(),
        appointmentId: proc.AptNum?.toString() ?? null,
        patientId: proc.PatNum?.toString() ?? null,
        codeNum: proc.CodeNum?.toString() ?? null,
        code: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? null,
        name: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
        description: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
        tooth: proc.ToothNum ?? null,
        surface: proc.Surf ?? null,
        status: proc.ProcStatus ?? null,
        quantity: proc.UnitQty ?? 1,
        fee: proc.ProcFee ?? 0,
        providerId: proc.ProvNum?.toString() ?? null,
        providerName: proc.provider_procedurelog_ProvNumToprovider ? `${proc.provider_procedurelog_ProvNumToprovider.FName} ${proc.provider_procedurelog_ProvNumToprovider.LName}`.trim() : null,
        createdAt: proc.SecDateEntry ?? null,
        dateOfService: proc.ProcDate ?? null,
        dos: proc.ProcDate ?? null,
      }));
    }

    if (created.PatNum) {
      await agingService.updatePatientAging(created.PatNum);
    }

    return this.mapClaim(created, claimMeta, {
      invoice: invoiceById.get(invoiceId),
      insurance: claimMeta.insuranceCompanyId ? insuranceById.get(claimMeta.insuranceCompanyId) : null,
      procedures,
    });
  }

  async createClaimFromTreatmentPlan(
    planId: string,
    patientId: string,
    acceptedItems: any[],
    insuranceCompanyId: string,
    insuranceType: string,
    userId?: string
  ) {
    const existing = await prisma.claim.findFirst({
      where: {
        ClaimType: { not: 'PreAuth' },
        Narrative: { contains: `\"treatmentPlanId\":\"${planId}\"` },
      },
    });

    if (existing) {
      throw new ConflictError('Claim already exists for this treatment plan');
    }

    const status: ClaimStatus = 'draft';
    const claimAmount = acceptedItems.reduce((sum, item) => sum + (Number(item.fee) || 0), 0);
    const claimNumber = await this.generateClaimNumber();

    let insPayEst = claimAmount;
    let patientResponsibility = 0;

    if (patientId && /^\d+$/.test(patientId) && acceptedItems.length > 0) {
      try {
        const { invoiceService } = await import('./invoice.service');
        const simulated = acceptedItems.map(item => ({
          ...item,
          charge: item.fee,
          cptCode: item.procedureCode || item.code,
        }));
        const enriched = await invoiceService.calculateInsuranceEstimates(BigInt(patientId), simulated);
        insPayEst = enriched.reduce((sum: number, it: any) => sum + (Number(it.insPortion) || 0), 0);
        patientResponsibility = enriched.reduce((sum: number, it: any) => sum + (Number(it.ptPortion) || 0), 0);
      } catch (err) {
        console.warn('Failed to calculate insurance estimates for treatment plan claim:', err);
      }
    }

    const claimMeta: ClaimMeta = {
      treatmentPlanId: planId,
      insuranceCompanyId,
      insuranceType,
      status,
      claimAmount,
      submittedAmount: insPayEst,
      totalAmount: claimAmount,
      paidAmount: 0,
      patientResponsibility,
      procedures: acceptedItems.map(item => ({
        id: item.id || Math.random().toString(36).substr(2, 9),
        _id: item.id || Math.random().toString(36).substr(2, 9),
        patientId,
        code: item.procedureCode || null,
        name: item.description || item.procedureCode || 'Procedure',
        description: item.description || item.procedureCode || 'Procedure',
        tooth: item.tooth || null,
        surface: item.surface || null,
        status: item.status || 'C',
        quantity: item.quantity || 1,
        fee: item.fee || 0,
        createdAt: new Date(),
      })),
    };

    const claimNum = await getNextId('claim', 'ClaimNum');
    const created = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: BigInt(patientId),
        ClaimType: insuranceType ?? 'Primary',
        ClaimStatus: claimStatusToCode(status),
        DateService: new Date(),
        ClaimFee: claimAmount,
        InsPayEst: insPayEst,
        InsPayAmt: 0,
        DedApplied: patientResponsibility,
        PreAuthString: claimNumber,
        PriorAuthorizationNumber: claimNumber,
        ClaimIdentifier: claimNumber,
        Narrative: buildJson(claimMeta as any),
      },
      include: { patient: true },
    });

    await this.createStatusHistoryEntry(created.ClaimNum.toString(), status, 'Claim created from treatment plan', userId);

    const [insuranceById] = await Promise.all([
      this.buildInsuranceContext(insuranceCompanyId ? [insuranceCompanyId] : []),
    ]);

    return this.mapClaim(created, claimMeta, {
      insurance: insuranceCompanyId ? insuranceById.get(insuranceCompanyId) : null,
      procedures: claimMeta.procedures || [],
    });
  }

  async generateUnsentClaimsForPatient(
    patientId: string,
    insuranceCompanyId: string,
    insuranceType: string,
    userId?: string
  ) {
    const invoices = await prisma.statement.findMany({
      where: {
        PatNum: BigInt(patientId),
      },
    });

    const existingClaims = await prisma.claim.findMany({
      where: {
        PatNum: BigInt(patientId),
        ClaimType: { not: 'PreAuth' },
      },
      select: {
        Narrative: true,
      },
    });

    const claimInvoiceIds = new Set<string>();
    for (const claim of existingClaims) {
      if (claim.Narrative) {
        const meta = parseJson<ClaimMeta>(claim.Narrative);
        if (meta.invoiceId) {
          claimInvoiceIds.add(meta.invoiceId);
        }
      }
    }

    const unbilledInvoices = invoices.filter(
      (inv) => !claimInvoiceIds.has(inv.StatementNum.toString())
    );

    const createdClaims = [];
    for (const inv of unbilledInvoices) {
      try {
        const claim = await this.createClaimFromInvoice(
          inv.StatementNum.toString(),
          {
            insuranceCompanyId,
            insuranceType,
          },
          userId
        );
        createdClaims.push(claim);
      } catch (err) {
        console.error(`Failed to create claim for invoice ${inv.StatementNum}:`, err);
      }
    }

    return createdClaims;
  }


  async updateClaim(
    claimId: string,
    updates: Partial<{
      claimFormat: string;
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
      providerSignature: string;
      patientSignature: string;
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
      claimFormat: (updates.claimFormat as any) ?? currentMeta.claimFormat,
      policyNumber: updates.policyNumber ?? currentMeta.policyNumber,
      providerSignature: updates.providerSignature ?? currentMeta.providerSignature,
      patientSignature: updates.patientSignature ?? currentMeta.patientSignature,
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

    const [invoiceById, insuranceById, proceduresByClaimId] = await Promise.all([
      this.buildInvoiceContext(nextMeta.invoiceId ? [nextMeta.invoiceId] : []),
      this.buildInsuranceContext(nextMeta.insuranceCompanyId ? [nextMeta.insuranceCompanyId] : []),
      this.getProceduresForClaims([claimId]),
    ]);

    let procedures = proceduresByClaimId.get(claimId) ?? [];
    if (procedures.length === 0 && nextMeta.invoiceId) {
      const invoiceIdBigInt = toBigInt(nextMeta.invoiceId);
      if (invoiceIdBigInt) {
        const invoiceProcs = await prisma.procedurelog.findMany({
          where: { StatementNum: invoiceIdBigInt },
          include: { procedurecode_procedurelog_CodeNumToprocedurecode: true },
        });
        procedures = invoiceProcs.map((proc) => ({
          id: proc.ProcNum.toString(),
          _id: proc.ProcNum.toString(),
          appointmentId: proc.AptNum?.toString() ?? null,
          patientId: proc.PatNum?.toString() ?? null,
          codeNum: proc.CodeNum?.toString() ?? null,
          code: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? null,
          name: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
          description: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? proc.BillingNote ?? 'Procedure',
          tooth: proc.ToothNum ?? null,
          surface: proc.Surf ?? null,
          status: proc.ProcStatus ?? null,
          quantity: proc.UnitQty ?? 1,
          fee: proc.ProcFee ?? 0,
          providerId: proc.ProvNum?.toString() ?? null,
          createdAt: proc.SecDateEntry ?? null,
        }));
      }
    }

    return this.mapClaim(updated, nextMeta, {
      invoice: nextMeta.invoiceId ? invoiceById.get(nextMeta.invoiceId) : null,
      insurance: nextMeta.insuranceCompanyId ? insuranceById.get(nextMeta.insuranceCompanyId) : null,
      procedures,
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
    const claim = await this.getClaimRecord(claimId);

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
      await prisma.claimattach.deleteMany({
        where: {
          ClaimNum: claim.ClaimNum,
          ActualFileName: String(meta.storagePath)
        }
      });
      await deleteFromS3(String(meta.storagePath));
    }

    return { message: 'Document removed successfully' };
  }

  async getTabSummary() {
    const allRows = await prisma.claim.findMany({
      include: { patient: true },
    });

    const metas = allRows.map((row) => parseJson<ClaimMeta>(row.Narrative));

    let unsent = 0;
    let errored = 0;
    let rejected = 0;
    let history = 0;
    let outstanding = 0;
    let predetermination = 0;

    allRows.forEach((row, idx) => {
      const meta = metas[idx] || {};
      const status = normalizeClaimStatus(meta.status ?? claimCodeToStatus(row.ClaimStatus));

      if (row.ClaimType === 'PreAuth') {
        predetermination++;
        return;
      }

      if (['draft', 'error', 'validationError', 'rejected', 'denied', 'readyForSubmission'].includes(status)) {
        unsent++;
      }

      if (['rejected', 'denied', 'validationError', 'error'].includes(status)) {
        errored++;
      }

      if (status === 'rejected') {
        rejected++;
      }

      if (['submitted', 'pending', 'partial', 'partially_paid', 'accepted', 'acceptedPaid', 'acceptedForProcessing', 'inProcess', 'eobUploaded'].includes(status)) {
        outstanding++;
      }

      if (['submitted', 'pending', 'paid', 'partial', 'partially_paid', 'accepted', 'acceptedPaid', 'acceptedForProcessing', 'denied', 'rejected', 'cancelled', 'inProcess', 'eobUploaded'].includes(status)) {
        history++;
      }
    });

    // Count real EOB/Dentical report attachments
    const denticalReports = await prisma.eobattach.count();

    // Count real ERA payments (claimpayments)
    const eraReports = await prisma.claimpayment.count();

    return {
      unsent,
      errored,
      rejected,
      history,
      outstanding,
      predetermination,
      denticalReports,
      eraReports,
    };
  }

  async getOutstandingClaims(page = 1, limit = 10, filters: { dateRange?: string; groupBy?: string; search?: string } = {}) {
    const where: any = {
      ClaimType: { not: 'PreAuth' },
    };

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
      new Set(metas.map((meta) => meta.insuranceCompanyId).filter((value): value is string => Boolean(value)))
    );

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext(invoiceIds),
      this.buildInsuranceContext(insuranceIds),
    ]);

    let claims = rows.map((row, index) => {
      const meta = metas[index] ?? {};
      const invoice = meta.invoiceId ? invoiceById.get(meta.invoiceId) : null;
      const insurance = meta.insuranceCompanyId ? insuranceById.get(meta.insuranceCompanyId) : null;

      const mapped = this.mapClaim(row, meta, { invoice, insurance }) as any;

      const sentDate = mapped.submissionDate ? new Date(mapped.submissionDate) : new Date(mapped.createdAt || row.DateService);
      const diffTime = Math.abs(new Date().getTime() - sentDate.getTime());
      const daysSinceSent = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...mapped,
        submittedValue: mapped.submittedAmount,
        subscriber: mapped.patient ? `${mapped.patient.firstName} ${mapped.patient.lastName}` : 'Unknown Subscriber',
        planName: mapped.insuranceCompany ? mapped.insuranceCompany.name : 'Standard Insurance Plan',
        daysSinceSent: daysSinceSent || 5,
      };
    });

    claims = claims.filter(c => ['submitted', 'pending', 'partial', 'partially_paid', 'accepted', 'acceptedPaid', 'acceptedForProcessing', 'inProcess', 'eobUploaded'].includes(c.status));

    if (filters.dateRange) {
      if (filters.dateRange === '0_30') {
        claims = claims.filter(c => c.daysSinceSent <= 30);
      } else if (filters.dateRange === '31_60') {
        claims = claims.filter(c => c.daysSinceSent > 30 && c.daysSinceSent <= 60);
      } else if (filters.dateRange === '61_90') {
        claims = claims.filter(c => c.daysSinceSent > 60 && c.daysSinceSent <= 90);
      } else if (filters.dateRange === '90_plus') {
        claims = claims.filter(c => c.daysSinceSent > 90);
      }
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      claims = claims.filter((claim) => {
        const patientName = `${claim.patient?.firstName || ''} ${claim.patient?.lastName || ''}`.trim();
        return [
          claim.claimNumber,
          claim.claimCode,
          patientName,
          claim.insuranceCompany?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    if (filters.groupBy === 'carrier') {
      claims.sort((a, b) => (a.planName || '').localeCompare(b.planName || ''));
    } else if (filters.groupBy === 'patient') {
      claims.sort((a, b) => (a.subscriber || '').localeCompare(b.subscriber || ''));
    }

    const total = claims.length;
    const skip = (page - 1) * limit;
    const paged = claims.slice(skip, skip + limit);

    await this.attachProceduresToPagedClaims(paged);

    return {
      claims: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getPredeterminations(page = 1, limit = 10, filters: any = {}) {
    const where: any = {
      ClaimType: 'PreAuth',
    };

    if (filters.patientId) {
      where.PatNum = BigInt(filters.patientId);
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
      new Set(metas.map((meta) => meta.insuranceCompanyId).filter((value): value is string => Boolean(value)))
    );

    const [invoiceById, insuranceById] = await Promise.all([
      this.buildInvoiceContext(invoiceIds),
      this.buildInsuranceContext(insuranceIds),
    ]);

    // Fetch providers for rows that have a ProvNum set
    const providerIds = Array.from(
      new Set(rows.map((r) => r.ProvBill?.toString()).filter((v): v is string => Boolean(v)))
    );
    const providers = providerIds.length
      ? await prisma.provider.findMany({
        where: { ProvNum: { in: providerIds.map((id) => BigInt(id)) } },
      })
      : [];
    const providerById = new Map(providers.map((p) => [p.ProvNum.toString(), p]));

    let claims = rows.map((row, index) => {
      const meta = metas[index] ?? {};
      const invoice = meta.invoiceId ? invoiceById.get(meta.invoiceId) : null;
      const insurance = meta.insuranceCompanyId ? insuranceById.get(meta.insuranceCompanyId) : null;

      const mapped = this.mapClaim(row, meta, { invoice, insurance }) as any;

      const prov = row.ProvBill ? providerById.get(row.ProvBill.toString()) : null;
      const treatingProvider = prov
        ? `${prov.LName ?? ''} ${prov.FName ? prov.FName[0] + '.' : ''}`.trim()
        : (mapped.patient ? `${mapped.patient.lastName ?? ''} ${mapped.patient.firstName ? mapped.patient.firstName[0] + '.' : ''}`.trim() : null);

      return {
        ...mapped,
        treatingProvider: treatingProvider || null,
        attachmentColor: mapped.status === 'paid' || mapped.status === 'accepted' ? 'green'
          : mapped.status === 'denied' || mapped.status === 'rejected' ? 'red' : 'yellow',
      };
    });

    if (filters.search) {
      const search = filters.search.toLowerCase();
      claims = claims.filter((claim) => {
        const patientName = `${claim.patient?.firstName || ''} ${claim.patient?.lastName || ''}`.trim();
        return [
          claim.claimNumber,
          claim.claimCode,
          patientName,
          claim.insuranceCompany?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
    }

    const total = claims.length;
    const skip = (page - 1) * limit;
    const paged = claims.slice(skip, skip + limit);

    await this.attachProceduresToPagedClaims(paged);

    return {
      claims: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async batchSubmitClaims(claimIds: string[], submissionType = 'electronic', userId?: string) {
    const results: Array<{ claimId: string; status: string; message: string }> = [];
    let submittedCount = 0;
    let failedCount = 0;

    for (const id of claimIds) {
      try {
        await this.updateClaim(
          id,
          {
            status: 'submitted',
            submissionDate: new Date(),
          },
          userId
        );
        results.push({ claimId: id, status: 'submitted', message: 'OK' });
        submittedCount++;
      } catch (err: any) {
        results.push({ claimId: id, status: 'failed', message: err.message || 'Submission failed' });
        failedCount++;
      }
    }

    return {
      submitted: submittedCount,
      failed: failedCount,
      results,
    };
  }

  async recordBatchPayment(
    data: {
      paymentRef: string;
      carrierId: string;
      paymentDate: string;
      checkAmount: number;
      allocations: Array<{ claimId: string; paidAmount: number; writeOff: number }>;
    },
    userId?: string
  ) {
    const carrier = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(data.carrierId) },
    });
    const carrierName = carrier?.CarrierName ?? 'Unknown Carrier';

    for (const alloc of data.allocations) {
      const claim = await this.getClaimById(alloc.claimId);
      const newPaidAmount = (claim.paidAmount || 0) + alloc.paidAmount;
      const newStatus: ClaimStatus = newPaidAmount >= claim.claimAmount ? 'paid' : 'partial';

      await this.updateClaim(
        alloc.claimId,
        {
          status: newStatus,
          paidAmount: newPaidAmount,
          paidDate: new Date(data.paymentDate),
          notes: `${claim.notes || ''}\n[Batch Payment ${data.paymentRef}] Paid: ${alloc.paidAmount}, Write-off: ${alloc.writeOff}`.trim(),
        },
        userId
      );
    }

    const docNum = await getNextId('document', 'DocNum');
    const paymentMeta = {
      documentType: 'batch_payment',
      paymentRef: data.paymentRef,
      carrierId: data.carrierId,
      carrierName,
      paymentDate: data.paymentDate,
      checkAmount: data.checkAmount,
      allocations: data.allocations,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: null,
        Description: `Batch Payment: ${data.paymentRef}`,
        FileName: null,
        Note: JSON.stringify(paymentMeta),
        DateCreated: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
      },
    });

    return {
      paymentId: docNum.toString(),
      totalAllocated: data.allocations.reduce((sum, item) => sum + item.paidAmount, 0),
      totalWriteOff: data.allocations.reduce((sum, item) => sum + item.writeOff, 0),
      claimsUpdated: data.allocations.length,
    };
  }

  async getBatchPayments(page = 1, limit = 10, filters: any = {}) {
    const rows = await prisma.document.findMany({
      where: {
        Note: { contains: '"documentType":"batch_payment"' },
      },
      orderBy: { DateCreated: 'desc' },
    });

    let payments = rows.map((row) => {
      const meta = parseJson<any>(row.Note);
      const eobs = Array.isArray(meta.eobs) && meta.eobs.length > 0
        ? meta.eobs.map((eob: any, idx: number) => ({
            id: eob.id || `eob-${row.DocNum.toString()}-${idx}`,
            filename: eob.filename || eob.fileName || 'EOB.pdf',
            storagePath: eob.storagePath || '',
            uploadDate: eob.uploadedAt ? new Date(eob.uploadedAt).toISOString().split('T')[0] : (eob.uploadDate || row.DateCreated?.toISOString().split('T')[0] || ''),
            uploadedAt: eob.uploadedAt || row.DateCreated?.toISOString() || '',
            size: eob.size || '124 KB',
          }))
        : (row.FileName ? [{ id: row.DocNum.toString(), filename: row.Description || 'EOB.pdf', uploadDate: row.DateCreated?.toISOString().split('T')[0], size: '124 KB' }] : []);

      return {
        id: row.DocNum.toString(),
        paymentRef: meta.paymentRef ?? '',
        date: meta.paymentDate ?? row.DateCreated?.toISOString().split('T')[0] ?? '',
        paymentDate: meta.paymentDate ?? row.DateCreated?.toISOString().split('T')[0] ?? '',
        status: meta.status ?? 'COMPLETED',
        carrier: meta.carrierName ?? 'Unknown Carrier',
        carrierId: meta.carrierId ?? '',
        patientsText: 'Multiple Patients',
        totalPayments: meta.checkAmount ?? 0,
        checkAmount: meta.checkAmount ?? 0,
        claims: meta.allocations ?? [],
        eobs,
      };
    });

    if (filters.search) {
      const search = filters.search.toLowerCase();
      payments = payments.filter(p => p.paymentRef.toLowerCase().includes(search) || p.carrier.toLowerCase().includes(search));
    }

    const total = payments.length;
    const skip = (page - 1) * limit;
    const paged = payments.slice(skip, skip + limit);

    return {
      payments: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async uploadEOB(paymentId: string, file: Express.Multer.File, description?: string, userId?: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(paymentId) },
    });

    if (!doc) {
      throw new NotFoundError('Batch payment not found');
    }

    const storagePath = await uploadToS3(file, 'claim-documents');
    const meta = parseJson<any>(doc.Note);
    meta.eobs = meta.eobs || [];
    
    const newEob = {
      id: `eob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      filename: file.originalname,
      storagePath,
      uploadedAt: new Date().toISOString(),
      size: `${Math.round(file.size / 1024)} KB`,
    };
    
    meta.eobs.push(newEob);

    await prisma.document.update({
      where: { DocNum: doc.DocNum },
      data: {
        FileName: storagePath,
        Description: file.originalname,
        Note: JSON.stringify(meta),
      },
    });

    return { message: 'EOB uploaded successfully', storagePath, eob: newEob, eobs: meta.eobs };
  }

  async deleteEOB(paymentId: string, eobId: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(paymentId) },
    });

    if (!doc) {
      throw new NotFoundError('Batch payment not found');
    }

    const meta = parseJson<any>(doc.Note);
    if (Array.isArray(meta.eobs)) {
      meta.eobs = meta.eobs.filter((e: any) => e.id !== eobId);
    }

    await prisma.document.update({
      where: { DocNum: doc.DocNum },
      data: {
        Note: JSON.stringify(meta),
      },
    });

    return { message: 'EOB deleted successfully', eobs: meta.eobs || [] };
  }

  async uploadClaimEOB(claimId: string, file: Express.Multer.File, description?: string, userId?: string) {
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claimId) },
    });

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const storagePath = await uploadToS3(file, 'claim-documents');
    const meta = parseJson<ClaimMeta>(claim.Narrative);
    meta.eobs = meta.eobs || [];

    const newEob = {
      id: `eob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      filename: file.originalname,
      storagePath,
      uploadedAt: new Date().toISOString(),
      size: `${Math.round(file.size / 1024)} KB`,
    };

    meta.eobs.push(newEob);

    await prisma.claim.update({
      where: { ClaimNum: claim.ClaimNum },
      data: {
        Narrative: JSON.stringify(meta),
      },
    });

    return { message: 'EOB uploaded successfully', storagePath, eob: newEob, eobs: meta.eobs };
  }

  async deleteClaimEOB(claimId: string, eobId: string) {
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claimId) },
    });

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const meta = parseJson<ClaimMeta>(claim.Narrative);
    if (Array.isArray(meta.eobs)) {
      meta.eobs = meta.eobs.filter((e: any) => e.id !== eobId);
    }

    await prisma.claim.update({
      where: { ClaimNum: claim.ClaimNum },
      data: {
        Narrative: JSON.stringify(meta),
      },
    });

    return { message: 'EOB deleted successfully', eobs: meta.eobs || [] };
  }

  async getDenticalReports() {
    const rows = await prisma.eobattach.findMany({
      orderBy: { DateTCreated: 'desc' },
      take: 50,
    });

    return rows.map((row) => ({
      id: row.EobAttachNum.toString(),
      fileName: row.FileName ?? `eob_report_${row.EobAttachNum}.pdf`,
      reportDate: row.DateTCreated?.toLocaleDateString() ?? '',
      dateCreated: row.DateTCreated?.toLocaleDateString() ?? '',
    }));
  }

  async getEraReports(eraTab = 'active', search?: string, page = 1, limit = 10) {
    // ERA reports map to claimpayment (insurance checks/EFTs) joined to claimproc for per-claim detail
    const claimpayments = await prisma.claimpayment.findMany({
      include: {
        claimproc: {
          include: {
            patient: true,
            claim: true,
          },
          take: 1,
        },
        definition_claimpayment_PayTypeTodefinition: true,
      },
      orderBy: { CheckDate: 'desc' },
      take: 200,
    });

    let reports = claimpayments.map((cp) => {
      const firstProc = cp.claimproc[0];
      const patient = firstProc?.patient;
      const claim = firstProc?.claim;

      const insPayAmt = cp.CheckAmt ?? 0;
      const feeBilled = firstProc?.FeeBilled ?? insPayAmt;
      const writeOff = firstProc?.WriteOff ?? 0;
      const patientResponsibility = feeBilled - insPayAmt - writeOff;
      const payTypeName = cp.definition_claimpayment_PayTypeTodefinition?.ItemName ?? null;

      // Map isPartial: 0=full, 1=partial/voided
      const isVoided = (cp.IsPartial ?? 0) === 2; // treat 2 as voided if set
      const isPaid = insPayAmt > 0;
      const status = isVoided ? 'Voided' : firstProc?.Status === 7 ? 'Denial' : isPaid ? 'Paid' : 'Pending';
      const resolvedEraTab = isVoided ? 'voided' : 'active';

      return {
        id: cp.ClaimPaymentNum.toString(),
        patientId: patient ? `PT-${String(patient.PatNum).padStart(4, '0')}` : null,
        patientName: patient ? `${patient.FName ?? ''} ${patient.LName ?? ''}`.trim() : 'Unknown',
        claimNumber: claim
          ? `#${claim.PreAuthString ?? claim.ClaimIdentifier ?? claim.ClaimNum.toString()}`
          : `#${cp.ClaimPaymentNum}`,
        carrier: cp.CarrierName ?? 'Unknown Carrier',
        status,
        amountSubmitted: feeBilled,
        amountPaid: insPayAmt,
        patientResponsibility: Math.max(0, patientResponsibility),
        writeOff,
        dateReceived: cp.CheckDate?.toLocaleDateString() ?? '',
        paymentType: payTypeName ?? (cp.CheckNum ? 'Check' : 'EFT'),
        eraTab: resolvedEraTab,
      };
    });

    reports = reports.filter((r) => r.eraTab === eraTab);

    if (search) {
      const q = search.toLowerCase();
      reports = reports.filter(
        (r) =>
          r.patientName.toLowerCase().includes(q) ||
          r.carrier.toLowerCase().includes(q) ||
          r.claimNumber.toLowerCase().includes(q)
      );
    }

    const total = reports.length;
    const skip = (page - 1) * limit;
    const paged = reports.slice(skip, skip + limit);

    return {
      reports: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getPendingProcedures() {
    // ProcStatus 1 = Treatment Planned (pending/not yet completed)
    const procs = await prisma.procedurelog.findMany({
      where: { ProcStatus: 1 },
      include: {
        patient: true,
        provider_procedurelog_ProvNumToprovider: true,
      },
      orderBy: { ProcDate: 'desc' },
      take: 100,
    });

    // Group by patient
    const patientMap = new Map<string, { id: string; name: string; procedures: any[] }>();

    for (const proc of procs) {
      const patId = proc.PatNum?.toString() ?? 'unknown';
      const patName = proc.patient
        ? `${proc.patient.FName ?? ''} ${proc.patient.LName ?? ''}`.trim()
        : 'Unknown Patient';
      const provName = proc.provider_procedurelog_ProvNumToprovider
        ? `${proc.provider_procedurelog_ProvNumToprovider.FName ?? ''} ${proc.provider_procedurelog_ProvNumToprovider.LName ?? ''}`.trim()
        : null;

      if (!patientMap.has(patId)) {
        patientMap.set(patId, { id: patId, name: patName, procedures: [] });
      }

      patientMap.get(patId)!.procedures.push({
        id: proc.ProcNum.toString(),  
        dos: proc.ProcDate?.toLocaleDateString() ?? '',
        code: proc.OldCode ?? 'D0000',
        description: proc.Surf ?? '',
        provider: provName,
        fee: proc.ProcFee ?? 0,
      });
    }

    return {
      patients: Array.from(patientMap.values()),
    };
  }

  async generateBatchInvoices(patientIds: string[], deliveryPreference = 'Email & SMS', userId?: string) {
    const results = [];
    for (const patId of patientIds) {
      const statementNum = await getNextId('statement', 'StatementNum');
      await prisma.statement.create({
        data: {
          StatementNum: statementNum,
          PatNum: BigInt(patId),
          ShortGUID: `INV${statementNum.toString()}`,
          BalTotal: 125.00,
          NoteBold: JSON.stringify({ deliveryPreference, generatedAt: new Date().toISOString() }),
        },
      });
      results.push({ patientId: patId, invoiceId: statementNum.toString(), status: 'SUCCESS' });
    }

    return {
      invoicesGenerated: results.length,
      results,
    };
  }

  async getClearinghouseStatus(claimId: string) {
    const claim = await this.getClaimById(claimId);
    let statusCode = 'A2';
    let statusDescription = 'Acknowledged/Accept at payer level.';

    if (claim.status === 'denied') {
      statusCode = 'A3';
      statusDescription = 'Rejected by Clearinghouse: ' + (claim.denialReason || 'Validation error');
    } else if (claim.status === 'draft') {
      statusCode = 'A0';
      statusDescription = 'Draft: Ready for validation.';
    }

    return {
      claimId,
      statusCode,
      statusDescription,
      lastChecked: new Date().toISOString(),
      rawResponse: `ISA*00*          *00*          *ZZ*MEDFLOW        *ZZ*CLEARINGHOUSE  *260522*1430*U*00401*000000001*0*P*>~`,
    };
  }

  async quickStatusUpdate(claimId: string, status: ClaimStatus, note?: string, userId?: string) {
    return this.updateClaim(
      claimId,
      {
        status,
        notes: note,
      },
      userId
    );
  }

  async uncompleteProcedures(procedureIds: string[]) {
    const bigIntIds = procedureIds.map(id => BigInt(id));
    await prisma.procedurelog.updateMany({
      where: {
        ProcNum: { in: bigIntIds },
      },
      data: {
        ProcStatus: 1, // 1 = Treatment Planned
        DateComplete: null,
      },
    });

    return {
      success: true,
      updatedCount: procedureIds.length,
      procedureIds,
    };
  }
  private mapClaimToApi(claim: any) {
  if (!claim) return null;

  return {
    _id: claim.ClaimNum.toString(),
    id: claim.ClaimNum.toString(),
    claimNumber: `CLM${claim.ClaimNum.toString().padStart(6, '0')}`,
    patientId: claim.PatNum?.toString() || null,
    patientName: claim.patient ? `${claim.patient.FName || ''} ${claim.patient.LName || ''}`.trim() : null,
    insuranceId: claim.PlanNum?.toString() || null,
    insuranceName: claim.insplan_claim_PlanNumToinsplan?.GroupName || null,  // ✅ Fixed
    treatingProviderId: claim.ProvTreat?.toString() || null,
    treatingProviderName: claim.provider_claim_ProvTreatToprovider 
      ? `${claim.provider_claim_ProvTreatToprovider.FName || ''} ${claim.provider_claim_ProvTreatToprovider.LName || ''}`.trim() 
      : null,
    billingEntityId: claim.ProvBill?.toString() || null,
    billingEntityName: claim.provider_claim_ProvBillToprovider 
      ? `${claim.provider_claim_ProvBillToprovider.FName || ''} ${claim.provider_claim_ProvBillToprovider.LName || ''}`.trim() 
      : null,
    claimType: claim.ClaimType || 'Manual',
    totalAmount: Number(claim.ClaimFee) || 0,
    status: claim.ClaimStatus || 'W',
    statusDisplay: this.mapClaimStatus(claim.ClaimStatus),
    dateService: claim.DateService || null,
    dateSent: claim.DateSent || null,
    note: claim.Narrative ? JSON.parse(claim.Narrative)?.note || null : null,
    description: claim.Narrative ? JSON.parse(claim.Narrative)?.description || null : null,
    selectedItems: claim.Narrative ? JSON.parse(claim.Narrative)?.selectedItems || [] : [],
    createdAt: claim.SecDateEntry || null,
    createdBy: claim.SecUserNumEntry?.toString() || null,
  };
}

private mapClaimStatus(status: string | null): string {
  const statusMap: Record<string, string> = {
    'W': 'Waiting',
    'S': 'Sent',
    'R': 'Received',
    'P': 'Paid',
    'D': 'Denied',
    'A': 'Approved',
    'V': 'Void',
  };
  return statusMap[status || 'W'] || 'Unknown';
}

  async createManualClaim(
  data: {
    patientId: string;
    insuranceId: string;
    treatingProviderId: string;
    billingEntityId: string;
    claimType: string;
    description?: string;
    note?: string;
    selectedItems: Array<{
      invoiceId: string;
      itemId: string;
      amount: number;
    }>;
  },
  userId: string
) {
  // 1. Verify patient exists
  const patient = await prisma.patient.findUnique({
    where: { PatNum: BigInt(data.patientId) },
  });
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  // 2. Verify insurance exists
  const insurance = await prisma.insplan.findUnique({
    where: { PlanNum: BigInt(data.insuranceId) },
  });
  if (!insurance) {
    throw new NotFoundError('Insurance plan not found');
  }

  // 3. Verify treating provider exists
  const treatingProvider = await prisma.provider.findUnique({
    where: { ProvNum: BigInt(data.treatingProviderId) },
  });
  if (!treatingProvider) {
    throw new NotFoundError('Treating provider not found');
  }

  // 4. Verify billing entity exists
  const billingEntity = await prisma.provider.findUnique({
    where: { ProvNum: BigInt(data.billingEntityId) },
  });
  if (!billingEntity) {
    throw new NotFoundError('Billing entity not found');
  }

  // 5. Calculate total claim amount
  const totalAmount = data.selectedItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  // 6. Get next ClaimNum
  const claimNum = await getNextId('claim', 'ClaimNum');

  // 7. Build claim meta with selected items and note
  const claimMeta = {
    selectedItems: data.selectedItems,
    note: data.note || null,
    description: data.description || null,
    claimType: data.claimType || 'Manual',
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  // 8. Create the claim
  const claim = await prisma.claim.create({
    data: {
      ClaimNum: claimNum,
      PatNum: BigInt(data.patientId),
      PlanNum: BigInt(data.insuranceId),
      ProvTreat: BigInt(data.treatingProviderId),
      ProvBill: BigInt(data.billingEntityId),
      ClaimFee: totalAmount,
      ClaimType: data.claimType || 'Manual',
      ClaimStatus: 'W',
      DateService: new Date(),
      DateSent: new Date(),
      Narrative: JSON.stringify(claimMeta),
      ClinicNum: patient.ClinicNum || null,
      SecUserNumEntry: userId ? BigInt(userId) : null,
      SecDateEntry: new Date(),
    },
  });

  // 9. Log activity
  await logActivity(
    userId,
    'created',
    'claims',
    claim.ClaimNum.toString(),
    undefined,
    { claimNum: claim.ClaimNum, patientId: data.patientId, totalAmount },
    undefined,
    undefined,
    'medium'
  );

  // 10. Return the created claim with correct relations
  const createdClaim = await prisma.claim.findUnique({
    where: { ClaimNum: claim.ClaimNum },
    include: {
      patient: true,
      insplan_claim_PlanNumToinsplan: true,
      provider_claim_ProvTreatToprovider: true,
      provider_claim_ProvBillToprovider: true,
    },
  });

  return this.mapClaimToApi(createdClaim);
}

  async generateAdaClaimPdf(claimId: string): Promise<Buffer> {
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claimId) },
      include: {
        patient: true,
        insplan_claim_PlanNumToinsplan: {
          include: {
            carrier: true,
          },
        },
        claimproc: {
          include: {
            procedurelog: {
              include: {
                procedurecode_procedurelog_CodeNumToprocedurecode: true,
              },
            },
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    const templatePath = path.join(process.cwd(), 'src/assets/templates/ada-claim-template.pdf');
    const templateBytes = await fs.promises.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const drawText = (text: string | null | undefined, x: number, y: number, size = 9) => {
      if (!text) return;
      firstPage.drawText(text, {
        x,
        y,
        size,
        color: rgb(0, 0, 0),
      });
    };

    // Fill Carrier/Insurance Company Info (Box 3 - DENTAL BENEFIT PLAN INFORMATION)
    // Try direct claim -> insplan -> carrier first, then fallback through patient's patplan
    let carrier = claim.insplan_claim_PlanNumToinsplan?.carrier;
    if (!carrier && claim.PatNum) {
      const patPlan = await prisma.patplan.findFirst({
        where: { PatNum: claim.PatNum },
        orderBy: { Ordinal: 'asc' },
        include: {
          inssub: {
            include: {
              insplan: {
                include: {
                  carrier: true,
                },
              },
            },
          },
        },
      });
      carrier = patPlan?.inssub?.insplan?.carrier ?? null;
    }
    if (carrier) {
      drawText(carrier.CarrierName, 55, 648, 8);
      drawText(carrier.Address, 55, 638, 7);
      const cityStateZip = [carrier.City, carrier.State, carrier.Zip].filter(Boolean).join(', ');
      if (cityStateZip) {
        drawText(cityStateZip, 55, 628, 7);
      }
    }

    // Fill Patient Info (Right Column, Box 20-22)
    const patient = claim.patient;
    if (patient) {
      const patName = `${patient.LName || ''}, ${patient.FName || ''} ${patient.MiddleI || ''}`.trim();
      drawText(patName, 360, 545, 9);
      drawText(patient.Address, 360, 532, 9);
      drawText(`${patient.City || ''}, ${patient.State || ''} ${patient.Zip || ''}`, 360, 519, 9);

      if (patient.Birthdate) {
        const dob = new Date(patient.Birthdate);
        const dobStr = `${String(dob.getMonth() + 1).padStart(2, '0')}/${String(dob.getDate()).padStart(2, '0')}/${dob.getFullYear()}`;
        drawText(dobStr, 360, 488, 9); // Box 21
      }

      if (patient.Gender !== null && patient.Gender !== undefined) {
        const genderVal = patient.Gender;
        if (genderVal === 0) {
          drawText('X', 435, 488, 10); // Male checkbox
        } else if (genderVal === 1) {
          drawText('X', 455, 488, 10); // Female checkbox
        }
      }
    }

    // Billing dentist/provider info
    if (claim.ProvTreat) {
      const treatingProv = await prisma.provider.findUnique({
        where: { ProvNum: claim.ProvTreat },
      });
      if (treatingProv) {
        const provName = `${treatingProv.LName || ''}, ${treatingProv.FName || ''}`.trim();
        drawText(provName, 55, 140, 9);
        drawText(treatingProv.NationalProvID || '', 200, 110, 9);
      }
    }

    // Draw procedures
    const procedures = claim.claimproc || [];
    let yPos = 395;
    let totalFee = 0;
    
    // Sort procedures by ProcDate
    const sortedProcs = [...procedures].sort((a, b) => {
      const dateA = a.procedurelog?.ProcDate ? new Date(a.procedurelog.ProcDate).getTime() : 0;
      const dateB = b.procedurelog?.ProcDate ? new Date(b.procedurelog.ProcDate).getTime() : 0;
      return dateA - dateB;
    });

    for (let i = 0; i < Math.min(sortedProcs.length, 10); i++) {
      const proc = sortedProcs[i];
      const log = proc.procedurelog;
      if (log) {
        if (log.ProcDate) {
          const pDate = new Date(log.ProcDate);
          const pDateStr = `${String(pDate.getMonth() + 1).padStart(2, '0')}/${String(pDate.getDate()).padStart(2, '0')}/${pDate.getFullYear()}`;
          drawText(pDateStr, 55, yPos, 8);
        }

        drawText(log.ToothNum || '', 130, yPos, 8);
        drawText(log.Surf || '', 180, yPos, 8);

        const codeObj = log.procedurecode_procedurelog_CodeNumToprocedurecode;
        const codeStr = codeObj?.ProcCode || log.OldCode || '';
        drawText(codeStr, 215, yPos, 8);
        drawText(codeObj?.Descript || '', 270, yPos, 8);

        const fee = log.ProcFee ?? proc.FeeBilled ?? 0;
        drawText(fee.toFixed(2), 490, yPos, 8);
        totalFee += fee;
      }
      yPos -= 20;
    }

    // Total Fee
    const finalFee = claim.ClaimFee ?? totalFee;
    drawText(finalFee.toFixed(2), 490, 178, 9);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async uploadAttachments(
    claimId: string,
    files: Express.Multer.File[],
    userId?: string
  ) {
    const claim = await this.getClaimRecord(claimId);

    const attachments = [];

    for (const file of files) {
      // 1. Upload to S3
      const storagePath = await uploadToS3(file, 'claim-documents');

      // 2. Save to claimattach
      const claimAttachNum = await getNextId('claimattach', 'ClaimAttachNum');
      await prisma.claimattach.create({
        data: {
          ClaimAttachNum: claimAttachNum,
          ClaimNum: claim.ClaimNum,
          DisplayedFileName: file.originalname,
          ActualFileName: storagePath,
          ImageReferenceId: 0,
        },
      });

      // 3. Save to document for compatibility/consistency with document listings
      const docNum = await getNextId('document', 'DocNum');
      const meta = {
        claimId,
        documentType: 'claim_attachment',
        description: null,
        storagePath,
        fileSizeInBytes: file.size,
        mimeType: file.mimetype,
        uploadedBy: userId ?? null,
        checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      };

      const createdDoc = await prisma.document.create({
        data: {
          DocNum: docNum,
          PatNum: claim.PatNum,
          Description: file.originalname,
          FileName: storagePath,
          Note: buildJson(meta),
          DateCreated: new Date(),
          UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
        },
      });

      attachments.push(mapDocument(createdDoc, claimId));
    }

    return attachments;
  }

  /**
   * Moves a procedure from its current claim to a new draft claim.
   */
  async moveProcedureToNewClaim(procId: string, currentClaimId?: string, userId?: string) {
    const procNum = toBigInt(procId);
    if (!procNum) {
      throw new BadRequestError('Invalid procedure ID');
    }

    const procedure = await prisma.procedurelog.findUnique({
      where: { ProcNum: procNum },
      include: {
        procedurecode_procedurelog_CodeNumToprocedurecode: true,
      },
    });

    if (!procedure) {
      throw new NotFoundError('Procedure not found');
    }

    const existingClaimProc = await prisma.claimproc.findFirst({
      where: {
        ProcNum: procNum,
        ...(currentClaimId ? { ClaimNum: toBigInt(currentClaimId) ?? undefined } : {}),
      },
    });

    const oldClaimNum = existingClaimProc?.ClaimNum;

    const patPlan = procedure.PatNum
      ? await prisma.patplan.findFirst({
          where: { PatNum: procedure.PatNum, Ordinal: 1 },
          include: { inssub: true },
        })
      : null;

    const claimNum = await getNextId('claim', 'ClaimNum');
    const claimNumber = `CLM-${claimNum}`;
    const procFee = procedure.ProcFee ?? 0;

    const claimMeta: ClaimMeta = {
      invoiceId: procedure.StatementNum?.toString() ?? undefined,
      procedures: [
        {
          id: procedure.ProcNum.toString(),
          code: procedure.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? procedure.OldCode ?? '',
          name: procedure.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ?? procedure.BillingNote ?? 'Procedure',
          fee: procFee,
        },
      ],
      status: 'draft',
      claimAmount: procFee,
      submittedAmount: procFee,
      totalAmount: procFee,
      notes: oldClaimNum ? `Procedure moved from claim #${oldClaimNum}` : 'Procedure moved to new claim',
    };

    const newClaim = await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: procedure.PatNum ?? null,
        PlanNum: patPlan?.inssub?.PlanNum ?? null,
        InsSubNum: patPlan?.InsSubNum ?? null,
        ProvTreat: procedure.ProvNum ?? null,
        ProvBill: procedure.ProvNum ?? null,
        ClaimType: 'Primary',
        ClaimStatus: claimStatusToCode('draft'),
        DateService: procedure.ProcDate ?? new Date(),
        ClaimFee: procFee,
        InsPayEst: procFee,
        InsPayAmt: 0,
        DedApplied: 0,
        PreAuthString: claimNumber,
        PriorAuthorizationNumber: claimNumber,
        ClaimIdentifier: claimNumber,
        ClaimNote: claimMeta.notes ?? null,
        Narrative: buildJson(claimMeta),
      },
    });

    if (existingClaimProc) {
      await prisma.claimproc.update({
        where: { ClaimProcNum: existingClaimProc.ClaimProcNum },
        data: { ClaimNum: newClaim.ClaimNum },
      });
    } else {
      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      let insPortion = procFee;
      let ptPortion = 0;
      if (procedure.BillingNote) {
        try {
          const bn = JSON.parse(procedure.BillingNote);
          if (bn.insPortion !== undefined) insPortion = Number(bn.insPortion);
          if (bn.ptPortion !== undefined) ptPortion = Number(bn.ptPortion);
        } catch (e) {}
      }
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: claimProcNum,
          ClaimNum: newClaim.ClaimNum,
          ProcNum: procedure.ProcNum,
          PatNum: procedure.PatNum,
          ProvNum: procedure.ProvNum,
          PlanNum: newClaim.PlanNum,
          InsSubNum: newClaim.InsSubNum,
          ClinicNum: procedure.ClinicNum,
          DateCP: new Date(),
          ProcDate: procedure.ProcDate,
          DateEntry: new Date(),
          Status: 0,
          FeeBilled: procFee,
          InsPayEst: insPortion,
          DedApplied: ptPortion,
        },
      });
    }

    if (userId) {
      await this.createStatusHistoryEntry(
        newClaim.ClaimNum.toString(),
        'draft',
        `Claim created by moving procedure #${procId}`,
        userId
      );
    }

    return this.getClaimById(newClaim.ClaimNum.toString());
  }
  async generateSecondaryClaim(primaryClaimId: string, userId?: string) {
    const claimNum = BigInt(primaryClaimId);

    // 1. Fetch Primary Claim
    const primaryClaim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
      include: {
        claimproc: true,
      }
    });

    if (!primaryClaim) {
      throw new NotFoundError('Primary claim not found');
    }

    if (primaryClaim.ClaimType === 'Secondary') {
      throw new BadRequestError('Claim is already a secondary claim');
    }

    // 2. Find Secondary Insurance for Patient
    const patPlans = await prisma.patplan.findMany({
      where: { PatNum: primaryClaim.PatNum },
      orderBy: { Ordinal: 'asc' }
    });

    const secondaryPlan = patPlans.find(p => p.Ordinal === 2);
    if (!secondaryPlan) {
      throw new BadRequestError('Patient does not have secondary insurance');
    }

    // 3. Create Secondary Claim
    const newClaimNum = await getNextId('claim', 'ClaimNum');
    const claimNumber = await this.generateClaimNumber();

    const claimMeta = {
      status: 'draft',
      insuranceType: 'secondary',
      notes: `Secondary claim generated from primary claim ${primaryClaim.ClaimNum}`,
    };

    const secondaryClaim = await prisma.claim.create({
      data: {
        ClaimNum: newClaimNum,
        PatNum: primaryClaim.PatNum,
        DateService: primaryClaim.DateService,
        DateSent: new Date(),
        ClaimStatus: 'W', // Waiting/Draft
        ClaimType: 'Secondary',
        ProvTreat: primaryClaim.ProvTreat,
        ProvBill: primaryClaim.ProvBill,
        ClinicNum: primaryClaim.ClinicNum,
        PlanNum: secondaryPlan.InsSubNum, // assuming InsSubNum is mapping to PlanNum for this simplistic schema or we need to find the plan
        InsSubNum: secondaryPlan.InsSubNum,
        ClaimFee: primaryClaim.ClaimFee,
        PreAuthString: claimNumber,
        PriorAuthorizationNumber: claimNumber,
        ClaimIdentifier: claimNumber,
        Narrative: buildJson(claimMeta),
      }
    });

    // 4. Duplicate claimprocs and mark them as secondary
    for (const cp of primaryClaim.claimproc) {
      const claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ...cp,
          ClaimProcNum: claimProcNum,
          ClaimNum: newClaimNum,
          Status: 0, // Unsent
          InsPayEst: 0, // Recalculate or leave 0 for secondary
          InsPayAmt: 0,
          DateCP: new Date(),
          DateEntry: new Date(),
          Remarks: `Generated from primary claimproc ${cp.ClaimProcNum}`,
        }
      });
    }

    if (userId) {
      await this.createStatusHistoryEntry(
        newClaimNum.toString(),
        'draft',
        `Secondary claim generated from primary claim ${primaryClaimId}`,
        userId
      );
    }

    return this.getClaimById(newClaimNum.toString());
  }
}

export const claimService = new ClaimService();
