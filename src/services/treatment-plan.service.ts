<<<<<<< HEAD
import { prisma, basePrisma, applyTenantContextToTransaction } from '../config/db.js';
=======
import { prisma, withTenantTransaction } from '../config/db.js';
import type { Prisma } from '@prisma/client';
>>>>>>> e3a0544 (feat: implement treatment plan draft persistence with unit tests)
import { NotFoundError, UnprocessableEntityError } from '../utils/error.util.js';
import { getNextId } from '../utils/opendental-ids.util.js';
import { claimService } from './claim.service.js';
import { PatientInsuranceService } from './patient-insurance.service.js';
import { invoiceService } from './invoice.service.js';
import { validateIcd10Assignments } from '../utils/icd10.util';
import { agingService } from './aging.service.js';

const patientInsuranceService = new PatientInsuranceService();

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

type PlanMeta = {
  creationRequestId?: string;
  items?: any[];
  status?: string;
  totalAmount?: number;
  insurancePortion?: number;
  patientPortion?: number;
  preAuthByItemId?: Record<string, { status?: string; preAuthId?: string }>;
  feeDetailsByItemId?: Record<string, { ucrFee?: number | null; noBillInsurance?: boolean; preAuthStatus?: string; preAuthNumber?: string; downgradedCode?: string; deductible?: number; estimateSource?: string; manualOverride?: boolean }>;
};

export class TreatmentPlanService {
  private mapProctpToItem(row: any, idx = 0, meta: PlanMeta = {}) {
    const fee = Number(row.FeeAmt || 0);
    const insPortion = Number(row.PriInsAmt || 0);
    const ptPortion = Number(row.PatAmt || 0);
    const providerAbbr = row.provider?.Abbr || (row.ProvNum ? row.ProvNum.toString() : '');
    const itemId = row.ProcTPNum.toString();
    const preAuthMeta = meta.preAuthByItemId?.[itemId] || {};
    const feeDetails = meta.feeDetailsByItemId?.[itemId] || {};

    return {
      id: itemId,
      _id: itemId,
      procTPNum: itemId,
      procNumOrig: row.ProcNumOrig ? row.ProcNumOrig.toString() : null,
      itemOrder: row.ItemOrder ?? idx + 1,
      priority: row.Priority ? row.Priority.toString() : '- -',
      tooth: row.ToothNumTP || '',
      site: row.Surf || (row.ToothNumTP ? `#${row.ToothNumTP}` : '-'),
      surface: row.Surf || '',
      procedureCode: row.ProcCode || '',
      code: row.ProcCode || '',
      description: row.Descript || '',
      fee: `$${fee.toFixed(2)}`,
      charge: fee,
      insuranceAmount: `$${insPortion.toFixed(2)}`,
      insPortion,
      patientAmount: `$${ptPortion.toFixed(2)}`,
      ptPortion,
      dx: row.Dx || '',
      icd: row.Dx || '',
      prognosis: row.Prognosis || '',
      status: row.ProcNumOrig ? 'C' : (row.Prognosis || 'P'),
      provider: providerAbbr,
      providerId: row.ProvNum ? row.ProvNum.toString() : null,
      dateTP: row.DateTP ?? null,
      clinicId: row.ClinicNum ? row.ClinicNum.toString() : null,
      preAuth: preAuthMeta.status || '-',
      preAuthId: preAuthMeta.preAuthId || null,
      ucrFee: feeDetails.ucrFee ?? null,
      negotiatedRate: fee,
      noBillInsurance: feeDetails.noBillInsurance ?? Boolean(row.procedurelog?.NoBillIns),
      preAuthStatus: feeDetails.preAuthStatus || preAuthMeta.status || '',
      preAuthNumber: feeDetails.preAuthNumber || '',
      downgradedCode: feeDetails.downgradedCode || '',
      deductible: feeDetails.deductible ?? 0,
      estimateSource: feeDetails.estimateSource || (feeDetails.manualOverride ? 'Manual' : 'Auto'),
      feeAllowed: row.FeeAllowed ?? null,
    };
  }

  /**
   * Fold one item's pre-auth fields into the plan's `preAuthByItemId` map.
   *
   * Reconciliation is deliberately partial, because the UI sends back only
   * what the user actually touched: a status alone keeps the stored id, an id
   * alone keeps the stored status, and sending neither — including the API's
   * '-' placeholder for "no status" — removes the entry. Dropping the stored
   * counterpart would lose an approval the payer already issued, while keeping
   * the entry on a clear would let a stale authorisation outlive the value the
   * user removed.
   *
   * `isNew` only matters for the id-only branch: a row that has just been
   * inserted cannot have a previously stored id to inherit.
   */
  private static applyPreAuth(
    map: Record<string, { status?: string; preAuthId?: string }>,
    itemId: string,
    item: any,
    isNew: boolean,
  ) {
    const existing = map[itemId];
    if (item.preAuth && item.preAuth !== '-') {
      map[itemId] = {
        status: String(item.preAuth),
        preAuthId: item.preAuthId
          ? String(item.preAuthId)
          : isNew
            ? undefined
            : existing?.preAuthId,
      };
    } else if (item.preAuthId) {
      map[itemId] = {
        status: existing?.status || 'Requested',
        preAuthId: String(item.preAuthId),
      };
    } else {
      delete map[itemId];
    }
  }

  private async enrichItemsWithInsurance(patientId: bigint, items: any[], db?: Prisma.TransactionClient) {
    if (!items || items.length === 0) {
      return { enrichedItems: items, insPortion: 0, ptPortion: 0, calcTotal: 0 };
    }

    const isVisits = Array.isArray(items[0].procedures);

    let flatProcedures: any[] = [];
    if (isVisits) {
      for (const visit of items) {
        if (Array.isArray(visit.procedures)) {
          flatProcedures.push(...visit.procedures);
        }
      }
    } else {
      flatProcedures = items;
    }

    if (flatProcedures.length === 0) {
      return { enrichedItems: items, insPortion: 0, ptPortion: 0, calcTotal: 0 };
    }

    for (const p of flatProcedures) {
      if (p.charge === undefined) {
        const feeStr = p.fee ?? p.patientAmount ?? p.unitPrice ?? p.totalPrice ?? '0';
        p.charge = Number(String(feeStr).replace(/[^0-9.-]+/g, ''));
      }
    }

    const enrichedProcedures = await invoiceService.calculateInsuranceEstimates(patientId, flatProcedures, { db });

    let insPortion = 0;
    let ptPortion = 0;
    let calcTotal = 0;

    for (const item of enrichedProcedures) {
      calcTotal += Number(item.charge || 0);
      insPortion += Number(item.insPortion || 0);
      ptPortion += Number(item.ptPortion || 0);

      item.insuranceAmount = `$${Number(item.insPortion || 0).toFixed(2)}`;
      item.patientAmount = `$${Number(item.ptPortion || 0).toFixed(2)}`;
      item.fee = `$${Number(item.charge || 0).toFixed(2)}`;
    }

    return { enrichedItems: isVisits ? items : enrichedProcedures, insPortion, ptPortion, calcTotal };
  }

  async getAllTreatmentPlans(page = 1, limit = 10, patientId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (patientId) where.PatNum = BigInt(patientId);

    const [rows, total] = await Promise.all([
      prisma.treatplan.findMany({
        where,
        orderBy: { DateTP: 'desc' },
        skip,
        take: limit,
      }),
      prisma.treatplan.count({ where }),
    ]);

    const planIds = rows.map((plan) => plan.TreatPlanNum);
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: { in: planIds } },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true, procedurelog: true },
    });

    const proctpByPlan = new Map<string, any[]>();
    for (const item of proctpRows) {
      const key = item.TreatPlanNum ? item.TreatPlanNum.toString() : '';
      if (!proctpByPlan.has(key)) {
        proctpByPlan.set(key, []);
      }
      proctpByPlan.get(key)!.push(item);
    }

    return {
      treatmentPlans: rows.map((plan) => {
        const meta = parseJson<PlanMeta>(plan.Note);
        const planProctp = proctpByPlan.get(plan.TreatPlanNum.toString());
        // Fallback: If no proctp rows exist yet, read from Note JSON (compatibility reader)
        const items =
          planProctp && planProctp.length > 0
            ? planProctp.map((r, idx) => this.mapProctpToItem(r, idx, meta))
            : meta.items ?? [];

        return {
          _id: plan.TreatPlanNum.toString(),
          patientId: plan.PatNum?.toString() ?? null,
          title: plan.Heading ?? '',
          notes: plan.Note ?? null,
          status: meta.status ?? null,
          totalAmount: meta.totalAmount ?? null,
          insurancePortion: meta.insurancePortion ?? null,
          patientPortion: meta.patientPortion ?? null,
          items,
          createdAt: plan.DateTP ?? null,
        };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getTreatmentPlanById(planId: string, db: Prisma.TransactionClient = prisma) {
    const plan = await db.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }
    const meta = parseJson<PlanMeta>(plan.Note);

    const proctpRows = await db.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true, procedurelog: true },
    });

    // Fallback: If no proctp rows exist yet, read from Note JSON (compatibility reader)
    const items =
      proctpRows && proctpRows.length > 0
        ? proctpRows.map((r, idx) => this.mapProctpToItem(r, idx, meta))
        : meta.items ?? [];

    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: meta.status ?? null,
      totalAmount: meta.totalAmount ?? null,
      insurancePortion: meta.insurancePortion ?? null,
      patientPortion: meta.patientPortion ?? null,
      items,
      createdAt: plan.DateTP ?? null,
    };
  }

  async createTreatmentPlan(data: {
    patientId: string;
    title: string;
    notes?: string;
    status?: string;
    totalAmount?: number;
    items?: any[];
    creationRequestId?: string;
  }) {
    return withTenantTransaction(async (tx) => {
    if (data.creationRequestId) {
      // A lost response must not create a second draft on retry. Serialize the
      // same patient/request key; tenant RLS still scopes the lookup and writes.
      const key = `treatment-plan:${data.patientId}:${data.creationRequestId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const candidates = await tx.treatplan.findMany({
        where: { PatNum: BigInt(data.patientId), Note: { contains: data.creationRequestId } },
      });
      const existing = candidates.find(plan => parseJson<PlanMeta>(plan.Note).creationRequestId === data.creationRequestId);
      if (existing) return this.getTreatmentPlanById(existing.TreatPlanNum.toString(), tx);
    }
    data = { ...data, items: await validateIcd10Assignments(data.items ?? [], [], tx) };
    const nextId = await getNextId('treatplan', 'TreatPlanNum', tx);

    const { enrichedItems, insPortion, ptPortion, calcTotal } = await this.enrichItemsWithInsurance(
      BigInt(data.patientId),
      data.items ?? [], tx
    );

    // Plan-level metadata in Note — items are NO LONGER serialized into Note JSON
    const payload: PlanMeta = {
      creationRequestId: data.creationRequestId,
      status: data.status,
      totalAmount: enrichedItems.length > 0 ? calcTotal : data.totalAmount,
      insurancePortion: insPortion,
      patientPortion: ptPortion,
    };

    const planDate = new Date();
    const plan = await tx.treatplan.create({
      data: {
        TreatPlanNum: nextId,
        PatNum: BigInt(data.patientId),
        DateTP: planDate,
        Heading: data.title,
        Note: buildJson(payload),
        TPStatus: 0,
      },
    });

    // Insert relational proctp rows
    const createdProctpRows = [];

    // Pre-auth is keyed by ProcTPNum, which only exists once the rows below are
    // inserted — so the map cannot be part of the Note written above, and is
    // written back once the ids are known. Without this a plan created WITH
    // pre-auth would silently lose it and come back reading '-' on every item.
    const preAuthByItemId: Record<string, { status?: string; preAuthId?: string }> = {};

    if (enrichedItems.length > 0) {
      for (let i = 0; i < enrichedItems.length; i++) {
        const item = enrichedItems[i];
        const procTPNum = await getNextId('proctp', 'ProcTPNum', tx);

        let provNum: bigint | null = null;
        const provInput = item.providerId || item.provider;
        if (provInput) {
          if (/^\d+$/.test(String(provInput))) {
            provNum = BigInt(String(provInput));
          } else {
            const prov = await tx.provider.findFirst({ where: { Abbr: String(provInput) } });
            if (prov?.ProvNum) provNum = prov.ProvNum;
          }
        }
        if (!provNum && data.patientId) {
          const patient = await tx.patient.findUnique({ where: { PatNum: BigInt(data.patientId) } });
          if (patient?.PriProv) provNum = patient.PriProv;
        }

        const parseAmt = (val: any) => typeof val === 'number' ? val : Number(String(val || 0).replace(/[^0-9.-]+/g, '')) || 0;
        const feeAmt = parseAmt(item.charge ?? item.fee);
        const priInsAmt = parseAmt(item.insPortion ?? item.insuranceAmount);
        const patAmt = parseAmt(item.ptPortion ?? item.patientAmount);

        const row = await tx.proctp.create({
          data: {
            ProcTPNum: procTPNum,
            TreatPlanNum: plan.TreatPlanNum,
            PatNum: plan.PatNum,
            ItemOrder: i + 1,
            ToothNumTP: item.tooth ? String(item.tooth) : null,
            Surf: item.site ?? item.surface ?? null,
            ProcCode: item.procedureCode ?? item.code ?? null,
            Descript: item.description ?? item.name ?? null,
            FeeAmt: feeAmt,
            PriInsAmt: priInsAmt,
            PatAmt: patAmt,
            Dx: item.icd,
            Prognosis: item.status ?? 'P',
            ProvNum: provNum,
            DateTP: planDate,
          },
          include: { provider: true, procedurelog: true },
        });
        createdProctpRows.push(row);
        TreatmentPlanService.applyPreAuth(preAuthByItemId, procTPNum.toString(), item, true);
      }
    }

    if (Object.keys(preAuthByItemId).length > 0) {
      payload.preAuthByItemId = preAuthByItemId;
      await tx.treatplan.update({
        where: { TreatPlanNum: plan.TreatPlanNum },
        data: { Note: buildJson(payload) },
      });
    }

    const items = createdProctpRows.map((r, idx) => this.mapProctpToItem(r, idx, payload));

    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: payload.status ?? null,
      totalAmount: payload.totalAmount ?? null,
      insurancePortion: payload.insurancePortion ?? null,
      patientPortion: payload.patientPortion ?? null,
      items,
      createdAt: plan.DateTP ?? null,
    };
    });
  }

  async updateItemFees(planId: string, itemId: string, fees: {
    ucrFee: number | null; negotiatedRate: number; insuranceEstimate: number;
    patientEstimate: number; deductible: number; noBillInsurance: boolean;
    preAuthStatus: string; preAuthNumber: string; downgradedCode: string;
  }, automatic = false) {
    const values = [fees.negotiatedRate, fees.insuranceEstimate, fees.patientEstimate, fees.deductible];
    if (values.some((value) => !Number.isFinite(value) || value < 0)
      || (fees.ucrFee !== null && (!Number.isFinite(fees.ucrFee) || fees.ucrFee < 0))
      || fees.insuranceEstimate + fees.patientEstimate > fees.negotiatedRate + 0.01
      || (fees.noBillInsurance && fees.insuranceEstimate !== 0)) {
      throw new UnprocessableEntityError('Invalid procedure fee or estimate amounts');
    }
    const planNum = BigInt(planId);
    const procTPNum = BigInt(itemId);
    const result = await withTenantTransaction(async (tx) => {
      const plan = await tx.treatplan.findUnique({ where: { TreatPlanNum: planNum } });
      if (!plan) throw new NotFoundError('Treatment plan not found');
      const row = await tx.proctp.findFirst({ where: { ProcTPNum: procTPNum, TreatPlanNum: planNum } });
      if (!row) throw new NotFoundError('Treatment plan procedure not found');
      const meta = parseJson<PlanMeta>(plan.Note);
      const details = { ...(meta.feeDetailsByItemId || {}) };
      const preAuthByItemId = { ...(meta.preAuthByItemId || {}) };
      if (fees.preAuthStatus) {
        preAuthByItemId[itemId] = { ...preAuthByItemId[itemId], status: fees.preAuthStatus };
      } else {
        delete preAuthByItemId[itemId];
      }
      details[itemId] = {
        ucrFee: fees.ucrFee,
        noBillInsurance: fees.noBillInsurance,
        preAuthStatus: fees.preAuthStatus,
        preAuthNumber: fees.preAuthNumber,
        downgradedCode: fees.downgradedCode,
        deductible: fees.deductible,
        estimateSource: automatic ? 'Auto' : 'Manual',
        manualOverride: !automatic,
      };
      await tx.proctp.update({
        where: { ProcTPNum: procTPNum },
        data: {
          FeeAmt: fees.negotiatedRate,
          PriInsAmt: fees.noBillInsurance ? 0 : fees.insuranceEstimate,
          PatAmt: fees.patientEstimate,
        },
      });
      const rows = await tx.proctp.findMany({ where: { TreatPlanNum: planNum }, include: { provider: true, procedurelog: true }, orderBy: { ItemOrder: 'asc' } });
      const nextMeta = {
        ...meta,
        feeDetailsByItemId: details,
        preAuthByItemId,
        totalAmount: rows.reduce((sum, item) => sum + Number(item.FeeAmt || 0), 0),
        insurancePortion: rows.reduce((sum, item) => sum + Number(item.PriInsAmt || 0), 0),
        patientPortion: rows.reduce((sum, item) => sum + Number(item.PatAmt || 0), 0),
      };
      await tx.treatplan.update({ where: { TreatPlanNum: planNum }, data: { Note: buildJson(nextMeta) } });
      return { rows, meta: nextMeta };
    });
    return {
      items: result.rows.map((row, index) => this.mapProctpToItem(row, index, result.meta)),
      totalAmount: result.meta.totalAmount,
      insurancePortion: result.meta.insurancePortion,
      patientPortion: result.meta.patientPortion,
    };
  }

  async reestimateItemFees(planId: string, itemId: string) {
    const plan = await prisma.treatplan.findUnique({ where: { TreatPlanNum: BigInt(planId) } });
    if (!plan?.PatNum) throw new NotFoundError('Treatment plan not found');
    const row = await prisma.proctp.findFirst({ where: { ProcTPNum: BigInt(itemId), TreatPlanNum: plan.TreatPlanNum } });
    if (!row) throw new NotFoundError('Treatment plan procedure not found');
    const calculated = await invoiceService.calculateInsuranceEstimates(plan.PatNum, [{
      procedureCode: row.ProcCode,
      code: row.ProcCode,
      charge: Number(row.FeeAmt || 0),
    }]);
    const insuranceEstimate = Number(calculated[0]?.insPortion || 0);
    const patientEstimate = Number(calculated[0]?.ptPortion || 0);
    const meta = parseJson<PlanMeta>(plan.Note);
    const previous = meta.feeDetailsByItemId?.[itemId];
    return this.updateItemFees(planId, itemId, {
      ucrFee: previous?.ucrFee ?? null,
      negotiatedRate: Number(row.FeeAmt || 0),
      insuranceEstimate,
      patientEstimate,
      deductible: Number(calculated[0]?.deductibleApplied || 0),
      noBillInsurance: false,
      preAuthStatus: previous?.preAuthStatus || '',
      preAuthNumber: previous?.preAuthNumber || '',
      downgradedCode: previous?.downgradedCode || '',
    }, true);
  }

  async updateTreatmentPlan(
    planId: string,
    updates: Partial<{ title: string; notes: string; status: string; totalAmount: number; items: any[] }>,
    createdBy?: string,
  ) {
<<<<<<< HEAD
    // Base client on purpose: the RLS extension would run every tx.* call on
    // its own connection, which then waits on the FOR UPDATE lock below
    // forever. applyTenantContextToTransaction sets the tenant context here.
    const result = await basePrisma.$transaction(async (tx) => {
=======
    const result = await withTenantTransaction(async (tx) => {
>>>>>>> e3a0544 (feat: implement treatment plan draft persistence with unit tests)
      const newlyCompletedProcNums: bigint[] = [];
      const manualProcNums: bigint[] = [];
    // Serialize edits of the same plan so concurrent retries see the committed link.
    await tx.$queryRaw`SELECT "TreatPlanNum" FROM "treatplan" WHERE "TreatPlanNum" = ${BigInt(planId)} FOR UPDATE`;
    const plan = await tx.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    const meta = parseJson<PlanMeta>(plan.Note);

    // Existing proctp rows
    const existingProctpRows = await tx.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      include: { provider: true, procedurelog: true },
    });

    if (updates.items) {
      updates = { ...updates, items: await validateIcd10Assignments(updates.items, existingProctpRows.map(row => ({ id: row.ProcTPNum.toString(), icd: row.Dx })), tx) };
    }
    let nextItems = updates.items;
    let insPortion = meta.insurancePortion ?? 0;
    let ptPortion = meta.patientPortion ?? 0;
    let calcTotal = updates.totalAmount ?? meta.totalAmount;

    if (updates.items && plan.PatNum) {
      const enrichment = await this.enrichItemsWithInsurance(plan.PatNum, updates.items, tx);
      nextItems = enrichment.enrichedItems;
      insPortion = enrichment.insPortion;
      ptPortion = enrichment.ptPortion;
      calcTotal = enrichment.calcTotal;
      for (const item of nextItems || []) {
        const itemId = String(item.id || item._id || item.procTPNum || '');
        if (!meta.feeDetailsByItemId?.[itemId]?.manualOverride) continue;
        const saved = existingProctpRows.find((row) => row.ProcTPNum.toString() === itemId);
        if (!saved) continue;
        item.insPortion = Number(saved.PriInsAmt || 0);
        item.ptPortion = Number(saved.PatAmt || 0);
        item.insuranceAmount = `$${item.insPortion.toFixed(2)}`;
        item.patientAmount = `$${item.ptPortion.toFixed(2)}`;
      }
      insPortion = (nextItems || []).reduce((sum, item) => sum + Number(item.insPortion || 0), 0);
      ptPortion = (nextItems || []).reduce((sum, item) => sum + Number(item.ptPortion || 0), 0);
    }

    const preAuthByItemId = { ...(meta.preAuthByItemId || {}) };

    // Process items if provided
    if (nextItems && Array.isArray(nextItems)) {
      const keepProcTPNums: bigint[] = [];

      for (let i = 0; i < nextItems.length; i++) {
        const item = nextItems[i];
        const existingRow = item.id || item._id || item.procTPNum
          ? existingProctpRows.find(
              (r) => r.ProcTPNum.toString() === String(item.id || item._id || item.procTPNum)
            )
          : null;

        // Check if item is being marked complete ('C') and create procedurelog row
        let procNumOrig = existingRow?.ProcNumOrig ?? null;
        const isNowCompleted = item.status === 'C' || item.status === 'Completed';
        const itemStatus = isNowCompleted ? 'C' : item.status;
        const wasCompleted = existingRow && (existingRow.Prognosis === 'C' || (existingRow.ProcNumOrig != null && existingRow.ProcNumOrig !== BigInt(0)));

        if (isNowCompleted && !wasCompleted && plan.PatNum) {
          const patient = await tx.patient.findUnique({ where: { PatNum: plan.PatNum } });
          if (!patient) throw new NotFoundError('Patient not found');
          let codeNum = BigInt(0);
          const codeStr = item.procedureCode || item.code;
          if (codeStr) {
            const pc = await tx.procedurecode.findFirst({ where: { ProcCode: codeStr } });
            if (pc?.CodeNum) codeNum = pc.CodeNum;
          }

          let provNum = BigInt(0);
          if (item.providerId && /^\d+$/.test(String(item.providerId))) {
            provNum = BigInt(String(item.providerId));
          } else if (item.provider) {
            const prov = await tx.provider.findFirst({ where: { Abbr: item.provider } });
            if (prov?.ProvNum) provNum = prov.ProvNum;
          }
          if (provNum === BigInt(0)) {
            if (patient.PriProv) {
              provNum = patient.PriProv;
            } else {
              const fallbackProv = await tx.provider.findFirst({ where: { IsHidden: 0 } });
              if (fallbackProv?.ProvNum) provNum = fallbackProv.ProvNum;
            }
          }

          const newProcNum = await getNextId('procedurelog', 'ProcNum', tx);
          await tx.procedurelog.create({
            data: {
              ProcNum: newProcNum,
              PatNum: plan.PatNum,
              ProvNum: provNum,
              CodeNum: codeNum,
              ProcStatus: 2, // Complete
              ProcDate: new Date(),
              ProcFee: Number(item.charge ?? item.fee ?? 0),
              Surf: (item.site ?? item.surface ?? '').substring(0, 10),
              ToothNum: item.tooth ? String(item.tooth).substring(0, 2) : '',
              OldCode: (codeStr ?? '').substring(0, 15),
              DiagnosticCode: item.icd,
              DateTP: plan.DateTP,
              ClinicNum: existingRow?.ClinicNum ?? (item.clinicId ? BigInt(item.clinicId) : patient.ClinicNum),
              BillingNote: buildJson({
                description: item.description || item.name || '',
                cptCode: codeStr || '', serviceId: codeNum.toString(),
                unitPrice: Number(item.charge ?? item.fee ?? 0), quantity: 1,
                charge: Number(item.charge ?? item.fee ?? 0),
                site: item.site || item.surface || '', provider: item.provider || '',
                ptPortion: Number(item.ptPortion ?? item.patientAmount ?? 0) || 0,
                insPortion: Number(item.insPortion ?? item.insuranceAmount ?? 0) || 0,
                writeoff: Number(item.writeoff ?? Math.max(0,
                  Number(item.charge ?? item.fee ?? 0) - Number(item.insPortion ?? 0) - Number(item.ptPortion ?? 0))),
                completed: true,
              }),
              NoBillIns: item.noBillInsurance ? 1 : null,
            },
          });

          // Restored Link: Capture created ProcNum and link it to proctp.ProcNumOrig!
          procNumOrig = newProcNum;
          newlyCompletedProcNums.push(newProcNum);
          if (meta.feeDetailsByItemId?.[String(item.id || item._id || item.procTPNum || '')]?.manualOverride) manualProcNums.push(newProcNum);
        }

        if (procNumOrig) {
          await tx.procedurelog.update({ where: { ProcNum: procNumOrig }, data: { DiagnosticCode: item.icd } });
        }

        const parseAmt = (val: any) => typeof val === 'number' ? val : Number(String(val || 0).replace(/[^0-9.-]+/g, '')) || 0;
        const feeAmt = parseAmt(item.charge ?? item.fee);
        const priInsAmt = parseAmt(item.insPortion ?? item.insuranceAmount);
        const patAmt = parseAmt(item.ptPortion ?? item.patientAmount);

        let provNum: bigint | null = null;
        const provInput = item.providerId || item.provider;
        if (provInput) {
          if (/^\d+$/.test(String(provInput))) {
            provNum = BigInt(String(provInput));
          } else {
            const prov = await tx.provider.findFirst({ where: { Abbr: String(provInput) } });
            if (prov?.ProvNum) provNum = prov.ProvNum;
          }
        }

        if (existingRow) {
          await tx.proctp.update({
            where: { ProcTPNum: existingRow.ProcTPNum },
            data: {
              ItemOrder: i + 1,
              ToothNumTP: item.tooth ? String(item.tooth) : null,
              Surf: item.site ?? item.surface ?? null,
              ProcCode: item.procedureCode ?? item.code ?? null,
              Descript: item.description ?? item.name ?? null,
              FeeAmt: feeAmt,
              PriInsAmt: priInsAmt,
              PatAmt: patAmt,
              Dx: item.icd,
              Prognosis: itemStatus ?? existingRow.Prognosis ?? 'P',
              ProvNum: provNum ?? existingRow.ProvNum,
              ProcNumOrig: procNumOrig,
            },
          });
          keepProcTPNums.push(existingRow.ProcTPNum);

          const itemId = existingRow.ProcTPNum.toString();
          TreatmentPlanService.applyPreAuth(preAuthByItemId, itemId, item, false);
        } else {
          const newProcTPNum = await getNextId('proctp', 'ProcTPNum', tx);
          await tx.proctp.create({
            data: {
              ProcTPNum: newProcTPNum,
              TreatPlanNum: plan.TreatPlanNum,
              PatNum: plan.PatNum,
              ItemOrder: i + 1,
              ToothNumTP: item.tooth ? String(item.tooth) : null,
              Surf: item.site ?? item.surface ?? null,
              ProcCode: item.procedureCode ?? item.code ?? null,
              Descript: item.description ?? item.name ?? null,
              FeeAmt: feeAmt,
              PriInsAmt: priInsAmt,
              PatAmt: patAmt,
              Dx: item.icd,
              Prognosis: itemStatus ?? 'P',
              ProvNum: provNum,
              ProcNumOrig: procNumOrig,
              DateTP: plan.DateTP,
            },
          });
          keepProcTPNums.push(newProcTPNum);

          const itemId = newProcTPNum.toString();
          TreatmentPlanService.applyPreAuth(preAuthByItemId, itemId, item, true);
        }
      }

      // Delete removed proctp rows
      const toDelete = existingProctpRows.filter((r) => !keepProcTPNums.includes(r.ProcTPNum));
      if (toDelete.length > 0) {
        toDelete.forEach((row) => {
          delete preAuthByItemId[row.ProcTPNum.toString()];
          if (meta.feeDetailsByItemId) delete meta.feeDetailsByItemId[row.ProcTPNum.toString()];
        });
        await tx.proctp.deleteMany({
          where: { ProcTPNum: { in: toDelete.map((r) => r.ProcTPNum) } },
        });
      }
    }

    const { items: _oldItems, ...cleanMeta } = meta as any;
    const nextMeta: PlanMeta = {
      ...cleanMeta,
      status: updates.status ?? meta.status,
      totalAmount: updates.items ? calcTotal : (updates.totalAmount ?? meta.totalAmount),
      insurancePortion: insPortion,
      patientPortion: ptPortion,
      preAuthByItemId,
    };

    const updated = await tx.treatplan.update({
      where: { TreatPlanNum: plan.TreatPlanNum },
      data: {
        Heading: updates.title ?? undefined,
        Note: buildJson(nextMeta),
      },
    });

    const createdInvoice = plan.PatNum && newlyCompletedProcNums.length
      ? await invoiceService.createInvoiceFromCompletedProcedures(
          tx, plan.PatNum, newlyCompletedProcNums, createdBy, planId, manualProcNums,
        )
      : null;

    const refreshedProctpRows = await tx.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true, procedurelog: true },
    });

    const items = refreshedProctpRows.length > 0
      ? refreshedProctpRows.map((r, idx) => this.mapProctpToItem(r, idx, nextMeta))
      : (meta.items ?? []);

    return {
      _id: updated.TreatPlanNum.toString(),
      patientId: updated.PatNum?.toString() ?? null,
      title: updated.Heading ?? '',
      notes: updated.Note ?? null,
      status: nextMeta.status ?? null,
      totalAmount: nextMeta.totalAmount ?? null,
      insurancePortion: nextMeta.insurancePortion ?? null,
      patientPortion: nextMeta.patientPortion ?? null,
      items,
      createdAt: updated.DateTP ?? null,
      createdInvoice,
    };
    }, { maxWait: 10000, timeout: 60000 });
    if (result.createdInvoice && result.patientId) {
      await agingService.updatePatientAging(BigInt(result.patientId)).catch(() => {});
    }
    return result;
  }

  async deleteTreatmentPlan(planId: string) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    // Delete associated proctp items first
    await prisma.proctp.deleteMany({ where: { TreatPlanNum: plan.TreatPlanNum } });
    await prisma.treatplan.delete({ where: { TreatPlanNum: plan.TreatPlanNum } });
    return { message: 'Treatment plan deleted successfully' };
  }

  async reorderTreatmentPlanItems(planId: string, items: any[]) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    const existingProctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      include: { provider: true, procedurelog: true },
    });

    if (existingProctpRows.length > 0) {
      await withTenantTransaction(async (tx) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const match = existingProctpRows.find(
            (r) =>
              (item.id && r.ProcTPNum.toString() === String(item.id)) ||
              (item._id && r.ProcTPNum.toString() === String(item._id)) ||
              ((item.procedureCode && r.ProcCode === item.procedureCode) || (item.code && r.ProcCode === item.code))
          );
          if (match) {
            await tx.proctp.update({
              where: { ProcTPNum: match.ProcTPNum },
              data: { ItemOrder: i + 1 },
            });
          }
        }
      });
    } else {
      const meta = parseJson<PlanMeta>(plan.Note);
      meta.items = items;
      await prisma.treatplan.update({
        where: { TreatPlanNum: plan.TreatPlanNum },
        data: { Note: buildJson(meta) },
      });
    }

    const meta = parseJson<PlanMeta>(plan.Note);
    const refreshedProctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true, procedurelog: true },
    });

    const hydratedItems = refreshedProctpRows.length > 0
      ? refreshedProctpRows.map((r, idx) => this.mapProctpToItem(r, idx, meta))
      : (meta.items ?? items);

    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: meta.status ?? null,
      totalAmount: meta.totalAmount ?? null,
      insurancePortion: meta.insurancePortion ?? null,
      patientPortion: meta.patientPortion ?? null,
      items: hydratedItems,
      createdAt: plan.DateTP ?? null,
    };
  }

  async getTreatmentPlanPrintDetails(planId: string) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
      include: {
        patient_treatplan_PatNumTopatient: true,
      },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    const meta = parseJson<PlanMeta>(plan.Note);
    const pat = plan.patient_treatplan_PatNumTopatient;

    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true, procedurelog: true },
    });

    const items = proctpRows.length > 0
      ? proctpRows.map((r, idx) => this.mapProctpToItem(r, idx, meta))
      : (meta.items ?? []);

    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      patientName: pat ? `${pat.FName} ${pat.LName}` : 'Unknown Patient',
      patientBirthdate: pat?.Birthdate ?? null,
      patientChartNumber: pat?.ChartNumber ?? '',
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: meta.status ?? null,
      totalAmount: meta.totalAmount ?? null,
      insurancePortion: meta.insurancePortion ?? null,
      patientPortion: meta.patientPortion ?? null,
      items,
      createdAt: plan.DateTP ?? null,
    };
  }

  async generateClaimFromTreatmentPlan(planId: string, userId?: string) {
    const plan = await this.getTreatmentPlanById(planId);

    if (!plan.items || plan.items.length === 0) {
      throw new UnprocessableEntityError('Treatment plan has no items');
    }

    const acceptedItems = plan.items.filter((item: any) =>
      !item.noBillInsurance && (item.status === 'A' || item.status === 'accepted')
    );

    if (acceptedItems.length === 0) {
      throw new UnprocessableEntityError('No accepted items in treatment plan');
    }

    if (!plan.patientId) {
      throw new UnprocessableEntityError('Treatment plan is not associated with a patient');
    }

    const insurances = await patientInsuranceService.getPatientInsurances(plan.patientId, true);

    if (insurances.length === 0) {
      throw new NotFoundError('Patient insurance not found');
    }

    const primaryInsurance = insurances.find((ins) => ins.insuranceType === 'Primary') || insurances[0];

    if (!primaryInsurance.insuranceCompanyId) {
      throw new UnprocessableEntityError('Patient primary insurance is missing company details');
    }

    return claimService.createClaimFromTreatmentPlan(
      planId,
      plan.patientId,
      acceptedItems,
      (primaryInsurance.insuranceCompanyId as any)?._id || primaryInsurance.insuranceCompanyId,
      primaryInsurance.insuranceType || 'Primary',
      userId
    );
  }

  async generatePreAuth(planId: string, payload: any, userId?: string) {
    const plan = await this.getTreatmentPlanById(planId);

    if (!plan.patientId) {
      throw new UnprocessableEntityError('Treatment plan is not associated with a patient');
    }

    if (!payload.insurancePlanId && !payload.insuranceCompanyId && !payload.selectedInsuranceId) {
      throw new UnprocessableEntityError('Insurance plan ID or company ID is required');
    }

    const insurances = await patientInsuranceService.getPatientInsurances(plan.patientId, true);
    
    // We try to match by carrier ID/plan ID, else fallback to primary
    let selectedInsurance = insurances.find(
      (ins) => String((ins.insuranceCompanyId as any)?._id || ins.insuranceCompanyId) === String(payload.insuranceCompanyId || payload.insurancePlanId || payload.selectedInsuranceId)
    );

    if (!selectedInsurance) {
      selectedInsurance = insurances.find((ins) => ins.insuranceType === 'Primary') || insurances[0];
    }

    if (!selectedInsurance || !selectedInsurance.insuranceCompanyId) {
      throw new UnprocessableEntityError('Patient insurance is missing company details');
    }

    // Usually PreAuth payload can have specific accepted items.
    let itemsToProcess = payload.items && payload.items.length > 0 
      ? payload.items 
      : plan.items;
    const excludedIds = new Set(plan.items.filter((item: any) => item.noBillInsurance).map((item: any) => String(item.id)));
    itemsToProcess = itemsToProcess.filter((item: any) => !excludedIds.has(String(item.id || item._id || item.procTPNum)));

    if (!itemsToProcess || itemsToProcess.length === 0) {
      throw new UnprocessableEntityError('No items found to generate a PreAuth');
    }

    return claimService.createPreAuthFromTreatmentPlan(
      planId,
      plan.patientId,
      itemsToProcess,
      (selectedInsurance.insuranceCompanyId as any)?._id || selectedInsurance.insuranceCompanyId,
      userId
    );
  }
}

export const treatmentPlanService = new TreatmentPlanService();
