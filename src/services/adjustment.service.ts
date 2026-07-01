import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';

export class AdjustmentService {
  private mapAdjustmentToApi(row: any) {
    return {
      _id: row.AdjNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      amount: Number(row.AdjAmt) || 0,
      date: row.AdjDate ?? null,
      type: row.AdjType?.toString() ?? null,
      providerId: row.ProvNum?.toString() ?? null,
      notes: row.AdjNote ?? null,
      createdAt: row.DateEntry ?? null,
      updatedAt: row.SecDateTEdit ?? null,
    };
  }

  private async enrichAdjustment(adjustment: any) {
    const patient = adjustment.patientId 
      ? await prisma.patient.findUnique({ where: { PatNum: BigInt(adjustment.patientId) } }) 
      : null;
      
    return {
      ...adjustment,
      patient: patient ? mapPatientToApi(patient) : null,
    };
  }

  async getAllAdjustments(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    if (filters.startDate || filters.endDate) {
      where.AdjDate = {};
      if (filters.startDate) where.AdjDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.AdjDate.lte = new Date(filters.endDate);
    }

    const [rows, total] = await Promise.all([
      prisma.adjustment.findMany({
        where,
        orderBy: { AdjDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adjustment.count({ where }),
    ]);

    const adjustments = await Promise.all(
      rows.map((row) => this.enrichAdjustment(this.mapAdjustmentToApi(row)))
    );

    return {
      adjustments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAdjustmentById(adjustmentId: string) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    return this.enrichAdjustment(this.mapAdjustmentToApi(adjustment));
  }

  async createAdjustment(
    data: {
      patientId: string;
      amount: number;
      date: Date;
      type?: string;
      providerId?: string;
      notes?: string;
    },
    userId: string
  ) {
    if (!data.amount) {
      throw new BadRequestError('Adjustment amount is required');
    }

    const adjNum = await getNextId('adjustment', 'AdjNum');
    
    const adjustment = await prisma.adjustment.create({
      data: {
        AdjNum: adjNum,
        PatNum: BigInt(data.patientId),
        AdjAmt: data.amount,
        AdjDate: data.date,
        AdjType: data.type ? BigInt(data.type) : undefined,
        ProvNum: data.providerId ? BigInt(data.providerId) : undefined,
        AdjNote: data.notes,
        DateEntry: new Date(),
        SecUserNumEntry: BigInt(userId),
      },
    });

    await logActivity(userId, 'created', 'adjustments', adjustment.AdjNum.toString(), undefined, adjustment);

    return this.enrichAdjustment(this.mapAdjustmentToApi(adjustment));
  }

  async updateAdjustment(
    adjustmentId: string,
    updates: Partial<{
      amount: number;
      date: Date;
      type: string;
      providerId: string;
      notes: string;
    }>,
    userId: string
  ) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    const updated = await prisma.adjustment.update({
      where: { AdjNum: adjustment.AdjNum },
      data: {
        AdjAmt: updates.amount ?? undefined,
        AdjDate: updates.date ?? undefined,
        AdjType: updates.type ? BigInt(updates.type) : undefined,
        ProvNum: updates.providerId ? BigInt(updates.providerId) : undefined,
        AdjNote: updates.notes ?? undefined,
      },
    });

    await logActivity(userId, 'updated', 'adjustments', adjustmentId, adjustment, updated);

    return this.enrichAdjustment(this.mapAdjustmentToApi(updated));
  }

  async deleteAdjustment(adjustmentId: string, userId: string) {
    const adjustment = await prisma.adjustment.findUnique({
      where: { AdjNum: BigInt(adjustmentId) },
    });
    if (!adjustment) {
      throw new NotFoundError('Adjustment not found');
    }

    await prisma.adjustment.delete({ where: { AdjNum: adjustment.AdjNum } });
    await logActivity(userId, 'deleted', 'adjustments', adjustmentId, adjustment, undefined);

    return { message: 'Adjustment deleted successfully' };
  }

  async getAdjustmentsByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllAdjustments(page, limit, { patientId });
  }
}

export const adjustmentService = new AdjustmentService();
