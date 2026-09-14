import { prisma } from '../config/db.js';
import { NotFoundError, UnprocessableEntityError } from '../utils/error.util.js';
import { getNextId } from '../utils/opendental-ids.util.js';
import { claimService } from './claim.service.js';
import { PatientInsuranceService } from './patient-insurance.service.js';
import { invoiceService } from './invoice.service.js';

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
  items?: any[];
  status?: string;
  totalAmount?: number;
  insurancePortion?: number;
  patientPortion?: number;
};

export class TreatmentPlanService {
  private mapProctpToItem(row: any, idx = 0) {
    const fee = Number(row.FeeAmt || 0);
    const insPortion = Number(row.PriInsAmt || 0);
    const ptPortion = Number(row.PatAmt || 0);
    const providerAbbr = row.provider?.Abbr || (row.ProvNum ? row.ProvNum.toString() : '');

    return {
      id: row.ProcTPNum.toString(),
      _id: row.ProcTPNum.toString(),
      procTPNum: row.ProcTPNum.toString(),
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
    };
  }

  private async enrichItemsWithInsurance(patientId: bigint, items: any[]) {
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

    const enrichedProcedures = await invoiceService.calculateInsuranceEstimates(patientId, flatProcedures);

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
      include: { provider: true },
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
            ? planProctp.map((r, idx) => this.mapProctpToItem(r, idx))
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

  async getTreatmentPlanById(planId: string) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }
    const meta = parseJson<PlanMeta>(plan.Note);

    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true },
    });

    // Fallback: If no proctp rows exist yet, read from Note JSON (compatibility reader)
    const items =
      proctpRows && proctpRows.length > 0
        ? proctpRows.map((r, idx) => this.mapProctpToItem(r, idx))
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
  }) {
    const nextId = await getNextId('treatplan', 'TreatPlanNum');

    const { enrichedItems, insPortion, ptPortion, calcTotal } = await this.enrichItemsWithInsurance(
      BigInt(data.patientId),
      data.items ?? []
    );

    // Plan-level metadata in Note — items are NO LONGER serialized into Note JSON
    const payload: PlanMeta = {
      status: data.status,
      totalAmount: enrichedItems.length > 0 ? calcTotal : data.totalAmount,
      insurancePortion: insPortion,
      patientPortion: ptPortion,
    };

    const planDate = new Date();
    const plan = await prisma.treatplan.create({
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
    if (enrichedItems.length > 0) {
      for (let i = 0; i < enrichedItems.length; i++) {
        const item = enrichedItems[i];
        const procTPNum = await getNextId('proctp', 'ProcTPNum');

        let provNum: bigint | null = null;
        if (item.provider) {
          const prov = await prisma.provider.findFirst({ where: { Abbr: item.provider } });
          if (prov?.ProvNum) provNum = prov.ProvNum;
        }
        if (!provNum && data.patientId) {
          const patient = await prisma.patient.findUnique({ where: { PatNum: BigInt(data.patientId) } });
          if (patient?.PriProv) provNum = patient.PriProv;
        }

        const feeAmt = typeof item.charge === 'number' ? item.charge : (Number(item.fee) || 0);
        const priInsAmt = typeof item.insPortion === 'number' ? item.insPortion : 0;
        const patAmt = typeof item.ptPortion === 'number' ? item.ptPortion : 0;

        const row = await prisma.proctp.create({
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
            Dx: item.icd ?? item.dx ?? null,
            Prognosis: item.status ?? 'P',
            ProvNum: provNum,
            DateTP: planDate,
          },
          include: { provider: true },
        });
        createdProctpRows.push(row);
      }
    }

    const items = createdProctpRows.map((r, idx) => this.mapProctpToItem(r, idx));

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
  }

  async updateTreatmentPlan(
    planId: string,
    updates: Partial<{ title: string; notes: string; status: string; totalAmount: number; items: any[] }>
  ) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    const meta = parseJson<PlanMeta>(plan.Note);

    // Existing proctp rows
    const existingProctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      include: { provider: true },
    });

    let nextItems = updates.items;
    let insPortion = meta.insurancePortion ?? 0;
    let ptPortion = meta.patientPortion ?? 0;
    let calcTotal = updates.totalAmount ?? meta.totalAmount;

    if (updates.items && plan.PatNum) {
      const enrichment = await this.enrichItemsWithInsurance(plan.PatNum, updates.items);
      nextItems = enrichment.enrichedItems;
      insPortion = enrichment.insPortion;
      ptPortion = enrichment.ptPortion;
      calcTotal = enrichment.calcTotal;
    }

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
        const wasCompleted = existingRow && (existingRow.Prognosis === 'C' || existingRow.ProcNumOrig != null);

        if (isNowCompleted && !wasCompleted && plan.PatNum) {
          let codeNum = BigInt(0);
          const codeStr = item.procedureCode || item.code;
          if (codeStr) {
            const pc = await prisma.procedurecode.findFirst({ where: { ProcCode: codeStr } });
            if (pc?.CodeNum) codeNum = pc.CodeNum;
          }

          let provNum = BigInt(0);
          if (item.provider) {
            const prov = await prisma.provider.findFirst({ where: { Abbr: item.provider } });
            if (prov?.ProvNum) provNum = prov.ProvNum;
          }
          if (provNum === BigInt(0)) {
            const patient = await prisma.patient.findUnique({ where: { PatNum: plan.PatNum } });
            if (patient && patient.PriProv) {
              provNum = patient.PriProv;
            } else {
              const fallbackProv = await prisma.provider.findFirst({ where: { IsHidden: 0 } });
              if (fallbackProv?.ProvNum) provNum = fallbackProv.ProvNum;
            }
          }

          const newProcNum = await getNextId('procedurelog', 'ProcNum');
          await prisma.procedurelog.create({
            data: {
              ProcNum: newProcNum,
              PatNum: plan.PatNum,
              ProvNum: provNum,
              CodeNum: codeNum,
              ProcStatus: 2, // Complete
              ProcDate: new Date(),
              ProcFee: Number(item.charge ?? item.fee ?? 0),
              Surf: item.site ?? item.surface ?? '',
              ToothNum: item.tooth ? String(item.tooth) : '',
              OldCode: codeStr ?? '',
              DateTP: plan.DateTP,
            },
          });

          // Restored Link: Capture created ProcNum and link it to proctp.ProcNumOrig!
          procNumOrig = newProcNum;
        }

        const feeAmt = typeof item.charge === 'number' ? item.charge : (Number(item.fee) || 0);
        const priInsAmt = typeof item.insPortion === 'number' ? item.insPortion : 0;
        const patAmt = typeof item.ptPortion === 'number' ? item.ptPortion : 0;

        let provNum: bigint | null = null;
        if (item.provider) {
          const prov = await prisma.provider.findFirst({ where: { Abbr: item.provider } });
          if (prov?.ProvNum) provNum = prov.ProvNum;
        }

        if (existingRow) {
          await prisma.proctp.update({
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
              Dx: item.icd ?? item.dx ?? null,
              Prognosis: item.status ?? existingRow.Prognosis ?? 'P',
              ProvNum: provNum ?? existingRow.ProvNum,
              ProcNumOrig: procNumOrig,
            },
          });
          keepProcTPNums.push(existingRow.ProcTPNum);
        } else {
          const newProcTPNum = await getNextId('proctp', 'ProcTPNum');
          await prisma.proctp.create({
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
              Dx: item.icd ?? item.dx ?? null,
              Prognosis: item.status ?? 'P',
              ProvNum: provNum,
              ProcNumOrig: procNumOrig,
              DateTP: plan.DateTP,
            },
          });
          keepProcTPNums.push(newProcTPNum);
        }
      }

      // Delete removed proctp rows
      const toDelete = existingProctpRows.filter((r) => !keepProcTPNums.includes(r.ProcTPNum));
      if (toDelete.length > 0) {
        await prisma.proctp.deleteMany({
          where: { ProcTPNum: { in: toDelete.map((r) => r.ProcTPNum) } },
        });
      }
    }

    const nextMeta: PlanMeta = {
      ...meta,
      status: updates.status ?? meta.status,
      totalAmount: updates.items ? calcTotal : (updates.totalAmount ?? meta.totalAmount),
      insurancePortion: insPortion,
      patientPortion: ptPortion,
    };

    const updated = await prisma.treatplan.update({
      where: { TreatPlanNum: plan.TreatPlanNum },
      data: {
        Heading: updates.title ?? undefined,
        Note: buildJson(nextMeta),
      },
    });

    const refreshedProctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: plan.TreatPlanNum },
      orderBy: { ItemOrder: 'asc' },
      include: { provider: true },
    });

    const items = refreshedProctpRows.length > 0
      ? refreshedProctpRows.map((r, idx) => this.mapProctpToItem(r, idx))
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
    };
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
      include: { provider: true },
    });

    if (existingProctpRows.length > 0) {
      await prisma.$transaction(async (tx) => {
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
      include: { provider: true },
    });

    const hydratedItems = refreshedProctpRows.length > 0
      ? refreshedProctpRows.map((r, idx) => this.mapProctpToItem(r, idx))
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
      include: { provider: true },
    });

    const items = proctpRows.length > 0
      ? proctpRows.map((r, idx) => this.mapProctpToItem(r, idx))
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

    const acceptedItems = plan.items.filter((item: any) => item.status === 'A' || item.status === 'accepted');

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
      primaryInsurance.insuranceCompanyId._id,
      primaryInsurance.insuranceType || 'Primary',
      userId
    );
  }
}

export const treatmentPlanService = new TreatmentPlanService();
