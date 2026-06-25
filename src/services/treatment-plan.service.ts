import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
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

type PlanMeta = {
  items?: any[];
  status?: string;
  totalAmount?: number;
};

export class TreatmentPlanService {
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
    const payload: PlanMeta = {
      status: data.status,
      totalAmount: data.totalAmount,
      items: data.items ?? [],
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
    const nextMeta: PlanMeta = {
      ...meta,
      status: updates.status ?? meta.status,
      totalAmount: updates.totalAmount ?? meta.totalAmount,
      items: updates.items ?? meta.items,
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
      items: meta.items ?? [],
      createdAt: plan.DateTP ?? null,
    };
  }
}

export const treatmentPlanService = new TreatmentPlanService();
