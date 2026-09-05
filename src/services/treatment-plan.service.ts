import { prisma } from '../config/db';
import { NotFoundError, UnprocessableEntityError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { claimService } from './claim.service';
import { PatientInsuranceService } from './patient-insurance.service';
import { invoiceService } from './invoice.service';

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
        p.charge = Number(String(feeStr).replace(/[^0-9.-]+/g, ""));
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

    return {
      treatmentPlans: rows.map((plan) => {
        const meta = parseJson<PlanMeta>(plan.Note);
        return {
          _id: plan.TreatPlanNum.toString(),
          patientId: plan.PatNum?.toString() ?? null,
          title: plan.Heading ?? '',
          notes: plan.Note ?? null,
          status: meta.status ?? null,
          totalAmount: meta.totalAmount ?? null,
          insurancePortion: meta.insurancePortion ?? null,
          patientPortion: meta.patientPortion ?? null,
          items: meta.items ?? [],
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
    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: meta.status ?? null,
      totalAmount: meta.totalAmount ?? null,
      insurancePortion: meta.insurancePortion ?? null,
      patientPortion: meta.patientPortion ?? null,
      items: meta.items ?? [],
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

    const payload: PlanMeta = {
      status: data.status,
      totalAmount: enrichedItems.length > 0 ? calcTotal : data.totalAmount,
      insurancePortion: insPortion,
      patientPortion: ptPortion,
      items: enrichedItems,
    };

    const plan = await prisma.treatplan.create({
      data: {
        TreatPlanNum: nextId,
        PatNum: BigInt(data.patientId),
        DateTP: new Date(),
        Heading: data.title,
        Note: buildJson(payload),
        TPStatus: 0,
      },
    });

    return {
      _id: plan.TreatPlanNum.toString(),
      patientId: plan.PatNum?.toString() ?? null,
      title: plan.Heading ?? '',
      notes: plan.Note ?? null,
      status: payload.status ?? null,
      totalAmount: payload.totalAmount ?? null,
      insurancePortion: payload.insurancePortion ?? null,
      patientPortion: payload.patientPortion ?? null,
      items: payload.items ?? [],
      createdAt: plan.DateTP ?? null,
    };
  }

  async updateTreatmentPlan(planId: string, updates: Partial<{ title: string; notes: string; status: string; totalAmount: number; items: any[] }>) {
    const plan = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Treatment plan not found');
    }

    const meta = parseJson<PlanMeta>(plan.Note);
    
    let nextItems = updates.items ?? meta.items ?? [];
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

    const nextMeta: PlanMeta = {
      ...meta,
      status: updates.status ?? meta.status,
      totalAmount: updates.items ? calcTotal : (updates.totalAmount ?? meta.totalAmount),
      insurancePortion: insPortion,
      patientPortion: ptPortion,
      items: nextItems,
    };

    const updated = await prisma.treatplan.update({
      where: { TreatPlanNum: plan.TreatPlanNum },
      data: {
        Heading: updates.title ?? undefined,
        Note: buildJson(nextMeta),
      },
    });

    return {
      _id: updated.TreatPlanNum.toString(),
      patientId: updated.PatNum?.toString() ?? null,
      title: updated.Heading ?? '',
      notes: updated.Note ?? null,
      status: nextMeta.status ?? null,
      totalAmount: nextMeta.totalAmount ?? null,
      insurancePortion: nextMeta.insurancePortion ?? null,
      patientPortion: nextMeta.patientPortion ?? null,
      items: nextMeta.items ?? [],
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

    const meta = parseJson<PlanMeta>(plan.Note);
    const nextMeta: PlanMeta = {
      ...meta,
      items: items,
    };

    const updated = await prisma.treatplan.update({
      where: { TreatPlanNum: plan.TreatPlanNum },
      data: {
        Note: buildJson(nextMeta),
      },
    });

    return {
      _id: updated.TreatPlanNum.toString(),
      patientId: updated.PatNum?.toString() ?? null,
      title: updated.Heading ?? '',
      notes: updated.Note ?? null,
      status: nextMeta.status ?? null,
      totalAmount: nextMeta.totalAmount ?? null,
      insurancePortion: nextMeta.insurancePortion ?? null,
      patientPortion: nextMeta.patientPortion ?? null,
      items: nextMeta.items ?? [],
      createdAt: updated.DateTP ?? null,
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
      items: meta.items ?? [],
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

    const primaryInsurance = insurances.find(ins => ins.insuranceType === 'Primary') || insurances[0];
    
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
