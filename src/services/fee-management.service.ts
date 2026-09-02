import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { mapServiceToApi } from '../utils/opendental-mappers.util';
import { getNextId } from '../utils/opendental-ids.util';
import { feeGuideAuditService } from './fee-guide-audit.service';

export class FeeManagementService {
  async getFeeSchedules() {
    const schedules = await prisma.feesched.findMany({
      orderBy: { FeeSchedNum: 'asc' },
    });
    return schedules.map((sched) => ({
      _id: sched.FeeSchedNum.toString(),
      description: sched.Description ?? '',
      feeSchedType: sched.FeeSchedType,
      isHidden: Boolean(sched.IsHidden),
      isGlobal: Boolean(sched.IsGlobal),
    }));
  }

  async getProcedureCodes(params: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      const search = params.search.trim();
      const exactCategory = await prisma.definition.findFirst({
        where: { Category: 1, ItemName: { equals: search, mode: 'insensitive' } },
      });

      if (exactCategory) {
        where.ProcCat = exactCategory.DefNum;
      } else {
        where.OR = [
          { ProcCode: { contains: search, mode: 'insensitive' } },
          { Descript: { contains: search, mode: 'insensitive' } },
          { definition: { ItemName: { contains: search, mode: 'insensitive' } } },
        ];
      }
    }

    if (params.category) {
      where.definition = {
        ItemName: { equals: params.category, mode: 'insensitive' },
      };
    }

    const defaultSched = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });
    const feeSchedNum = defaultSched?.FeeSchedNum || BigInt(53);

    const [rows, total] = await Promise.all([
      prisma.procedurecode.findMany({
        where,
        orderBy: { ProcCode: 'asc' },
        skip,
        take: limit,
        include: { 
          definition: true,
          fee: {
            where: { FeeSched: feeSchedNum },
            take: 1
          }
        },
      }),
      prisma.procedurecode.count({ where }),
    ]);

    const mapped = rows.map((row) => {
      const feeAmount = row.fee?.[0]?.Amount ?? null;
      return {
        ProcCode: row.ProcCode,
        Descript: row.Descript ?? '',
        Category: row.definition?.ItemName ?? '',
        fee: feeAmount !== null ? Number(feeAmount) : 0,
      };
    });

    return {
      total,
      page,
      limit,
      data: mapped,
    };
  }

  async getProcedureFees(procCode: string) {
    const code = await prisma.procedurecode.findFirst({
      where: { ProcCode: procCode },
    });
    if (!code) {
      throw new NotFoundError('Procedure code not found');
    }

    const fees = await prisma.fee.findMany({
      where: { CodeNum: code.CodeNum },
    });

    return fees.map((f) => ({
      _id: f.FeeNum.toString(),
      feeSchedNum: f.FeeSched?.toString() ?? '',
      amount: Number(f.Amount) || 0,
    }));
  }

  async updateProcedureFees(procCode: string, fees: Array<{ feeSchedNum: string; amount: number }>) {
    const code = await prisma.procedurecode.findFirst({
      where: { ProcCode: procCode },
    });
    if (!code) {
      throw new NotFoundError('Procedure code not found');
    }

    const results = [];
    for (const item of fees) {
      const feeSchedBigInt = BigInt(item.feeSchedNum);
      const existingFee = await prisma.fee.findFirst({
        where: { CodeNum: code.CodeNum, FeeSched: feeSchedBigInt },
      });

      if (existingFee) {
        const updated = await prisma.fee.update({
          where: { FeeNum: existingFee.FeeNum },
          data: { Amount: item.amount },
        });
        results.push(updated);
      } else {
        const nextId = await getNextId('fee', 'FeeNum');
        const created = await prisma.fee.create({
          data: {
            FeeNum: nextId,
            CodeNum: code.CodeNum,
            FeeSched: feeSchedBigInt,
            Amount: item.amount,
            UseDefaultFee: 0,
            UseDefaultCov: 0,
          },
        });
        results.push(created);
      }
    }

    return results.map((f) => ({
      _id: f.FeeNum.toString(),
      feeSchedNum: f.FeeSched?.toString() ?? '',
      amount: Number(f.Amount) || 0,
    }));
  }

  async createFeeSchedule(
    data: { description: string; feeSchedType?: number; isGlobal?: boolean },
    userId?: string | null
  ) {
    const nextId = await getNextId('feesched', 'FeeSchedNum');
    const sched = await prisma.feesched.create({
      data: {
        FeeSchedNum: nextId,
        Description: data.description,
        FeeSchedType: data.feeSchedType ?? 0,
        IsHidden: 0,
        IsGlobal: data.isGlobal ? 1 : 0,
        SecUserNumEntry: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
        SecDateEntry: new Date(),
      },
    });

    await feeGuideAuditService.recordAuditLog({
      feeSchedNum: sched.FeeSchedNum,
      userId,
      action: 'Create',
      diffs: [
        { key: 'description', old: '', new: sched.Description ?? '' },
        { key: 'feeSchedType', old: '', new: sched.FeeSchedType ?? 0 },
        { key: 'isGlobal', old: '', new: Boolean(sched.IsGlobal) },
      ],
    });

    return {
      _id: sched.FeeSchedNum.toString(),
      description: sched.Description ?? '',
      feeSchedType: sched.FeeSchedType,
      isHidden: Boolean(sched.IsHidden),
      isGlobal: Boolean(sched.IsGlobal),
    };
  }

  async updateFeeSchedule(
    id: string,
    updates: Partial<{ description: string; feeSchedType: number; isHidden: boolean; isGlobal: boolean }>,
    userId?: string | null
  ) {
    const feeSchedNum = BigInt(id);
    const existing = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!existing) {
      throw new NotFoundError('Fee schedule not found');
    }

    const updated = await prisma.feesched.update({
      where: { FeeSchedNum: feeSchedNum },
      data: {
        Description: updates.description ?? undefined,
        FeeSchedType: updates.feeSchedType ?? undefined,
        IsHidden: updates.isHidden !== undefined ? (updates.isHidden ? 1 : 0) : undefined,
        IsGlobal: updates.isGlobal !== undefined ? (updates.isGlobal ? 1 : 0) : undefined,
        SecDateTEdit: new Date(),
      },
    });

    const oldState: Record<string, any> = {
      description: existing.Description ?? '',
      feeSchedType: existing.FeeSchedType ?? 0,
      isHidden: Boolean(existing.IsHidden),
      isGlobal: Boolean(existing.IsGlobal),
    };

    const newState: Record<string, any> = {
      description: updated.Description ?? '',
      feeSchedType: updated.FeeSchedType ?? 0,
      isHidden: Boolean(updated.IsHidden),
      isGlobal: Boolean(updated.IsGlobal),
    };

    const diffs = feeGuideAuditService.generateDiff(oldState, newState);
    if (diffs.length > 0) {
      await feeGuideAuditService.recordAuditLog({
        feeSchedNum,
        userId,
        action: 'Update',
        diffs,
      });
    }

    return {
      _id: updated.FeeSchedNum.toString(),
      description: updated.Description ?? '',
      feeSchedType: updated.FeeSchedType,
      isHidden: Boolean(updated.IsHidden),
      isGlobal: Boolean(updated.IsGlobal),
    };
  }

  async deleteFeeSchedule(id: string, userId?: string | null) {
    const feeSchedNum = BigInt(id);
    const existing = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!existing) {
      throw new NotFoundError('Fee schedule not found');
    }

    // Soft delete/hide it
    await prisma.feesched.update({
      where: { FeeSchedNum: feeSchedNum },
      data: { IsHidden: 1, SecDateTEdit: new Date() },
    });

    await feeGuideAuditService.recordAuditLog({
      feeSchedNum,
      userId,
      action: 'Delete',
      diffs: [
        { key: 'isHidden', old: false, new: true },
      ],
    });

    return { success: true };
  }

  async copyFeeSchedule(id: string, description: string, userId?: string | null) {
    const sourceSchedNum = BigInt(id);
    const sourceSched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: sourceSchedNum },
    });
    if (!sourceSched) {
      throw new NotFoundError('Source fee schedule not found');
    }

    const nextId = await getNextId('feesched', 'FeeSchedNum');
    const newSched = await prisma.feesched.create({
      data: {
        FeeSchedNum: nextId,
        Description: description || `${sourceSched.Description} (Copy)`,
        FeeSchedType: sourceSched.FeeSchedType,
        IsHidden: sourceSched.IsHidden,
        IsGlobal: sourceSched.IsGlobal,
        SecUserNumEntry: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
        SecDateEntry: new Date(),
      },
    });

    // Copy all fee entries
    const fees = await prisma.fee.findMany({
      where: { FeeSched: sourceSchedNum },
    });

    for (const f of fees) {
      const nextFeeId = await getNextId('fee', 'FeeNum');
      await prisma.fee.create({
        data: {
          FeeNum: nextFeeId,
          CodeNum: f.CodeNum,
          FeeSched: nextId,
          Amount: f.Amount,
          UseDefaultFee: f.UseDefaultFee,
          UseDefaultCov: f.UseDefaultCov,
        },
      });
    }

    await feeGuideAuditService.recordAuditLog({
      feeSchedNum: newSched.FeeSchedNum,
      userId,
      action: 'Create (Copy)',
      diffs: [
        { key: 'sourceFeeSchedNum', old: '', new: sourceSchedNum.toString() },
        { key: 'description', old: sourceSched.Description ?? '', new: newSched.Description ?? '' },
      ],
    });

    return {
      _id: newSched.FeeSchedNum.toString(),
      description: newSched.Description ?? '',
      feeSchedType: newSched.FeeSchedType,
      isHidden: Boolean(newSched.IsHidden),
      isGlobal: Boolean(newSched.IsGlobal),
    };
  }

  async reestimateTPlans() {
    // 1. Fetch all treatment plan procedure logs (ProcStatus = 1)
    const procLogs = await prisma.procedurelog.findMany({
      where: { ProcStatus: 1 },
      include: {
        patient: true,
      },
    });

    let updatedCount = 0;

    for (const log of procLogs) {
      if (!log.CodeNum) continue;

      // Find the fee schedule: Patient's assigned FeeSched, or default (first active schedule)
      let feeSchedNum = log.patient?.FeeSched;
      if (!feeSchedNum) {
        const defaultSched = await prisma.feesched.findFirst({
          where: { IsHidden: 0 },
          orderBy: { FeeSchedNum: 'asc' },
        });
        feeSchedNum = defaultSched?.FeeSchedNum || null;
      }

      if (!feeSchedNum) continue;

      // Find the fee amount
      const feeRecord = await prisma.fee.findFirst({
        where: {
          CodeNum: log.CodeNum,
          FeeSched: feeSchedNum,
        },
      });

      if (feeRecord) {
        await prisma.procedurelog.update({
          where: { ProcNum: log.ProcNum },
          data: { ProcFee: Number(feeRecord.Amount) || 0 },
        });
        updatedCount++;
      }
    }

    return { updatedCount };
  }

  async clearLockedFees() {
    const result = await prisma.procedurelog.updateMany({
      where: { ProcStatus: 1, IsLocked: 1 },
      data: { IsLocked: 0 },
    });
    return { updatedCount: result.count };
  }

  async resetTPlans(patientIds?: string[]) {
    // 1. If patientIds are provided, convert to BigInts, else find all patients with FeeSched set
    let patNums: bigint[] = [];
    if (patientIds && patientIds.length > 0) {
      patNums = patientIds.map(id => BigInt(id));
    } else {
      const patientsWithManualGuides = await prisma.patient.findMany({
        where: { FeeSched: { not: null } },
        select: { PatNum: true },
      });
      patNums = patientsWithManualGuides.map(p => p.PatNum);
    }

    if (patNums.length === 0) {
      return { updatedPatientsCount: 0, updatedProceduresCount: 0 };
    }

    // 2. Clear manual FeeSched (set to null) for those patients
    await prisma.patient.updateMany({
      where: { PatNum: { in: patNums } },
      data: { FeeSched: null },
    });

    // 3. Re-estimate treatment plan fees for affected patients (now using default fee guides)
    const procLogs = await prisma.procedurelog.findMany({
      where: {
        ProcStatus: 1,
        PatNum: { in: patNums },
      },
      include: {
        patient: true,
      },
    });

    let updatedProceduresCount = 0;
    const defaultSched = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });

    if (defaultSched) {
      for (const log of procLogs) {
        if (!log.CodeNum) continue;

        const feeRecord = await prisma.fee.findFirst({
          where: {
            CodeNum: log.CodeNum,
            FeeSched: defaultSched.FeeSchedNum,
          },
        });

        if (feeRecord) {
          await prisma.procedurelog.update({
            where: { ProcNum: log.ProcNum },
            data: { ProcFee: Number(feeRecord.Amount) || 0 },
          });
          updatedProceduresCount++;
        }
      }
    }

    return {
      updatedPatientsCount: patNums.length,
      updatedProceduresCount,
    };
  }

  async getFeeScheduleById(id: string) {
    const feeSchedNum = BigInt(id);
    const sched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!sched) {
      throw new NotFoundError('Fee schedule not found');
    }
    return {
      _id: sched.FeeSchedNum.toString(),
      description: sched.Description ?? '',
      feeSchedType: sched.FeeSchedType,
      isHidden: Boolean(sched.IsHidden),
      isGlobal: Boolean(sched.IsGlobal),
    };
  }

  async getFeeScheduleFees(
    id: string,
    params: { search?: string; category?: string; page?: number; limit?: number }
  ) {
    const feeSchedNum = BigInt(id);
    const sched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!sched) {
      throw new NotFoundError('Fee schedule not found');
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

     const where: any = {};
    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { ProcCode: { contains: search, mode: 'insensitive' } },
        { Descript: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (params.category) {
      where.definition = {
        ItemName: { equals: params.category, mode: 'insensitive' },
      };
    }

    const [rows, total] = await Promise.all([
      prisma.procedurecode.findMany({
        where,
        orderBy: { ProcCode: 'asc' },
        skip,
        take: limit,
        include: {
          definition: true,
          fee: {
            where: { FeeSched: feeSchedNum },
          },
        },
      }),
      prisma.procedurecode.count({ where }),
    ]);

    const mapped = rows.map((row) => {
      const feeAmount = row.fee[0]?.Amount ?? null;
      return {
        code: row.ProcCode,
        name: row.Descript ?? '',
        category: row.definition?.ItemName ?? '',
        fee: feeAmount !== null ? Number(feeAmount) : null,
      };
    });

    return {
      total,
      page,
      limit,
      data: mapped,
    };
  }

  async updateFeeScheduleFees(
    id: string,
    fees: Array<{ procCode: string; amount: number }>,
    userId?: string | null
  ) {
    const feeSchedNum = BigInt(id);
    const sched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!sched) {
      throw new NotFoundError('Fee schedule not found');
    }

    const results = [];
    const diffs: Array<{ key: string; old: any; new: any }> = [];

    for (const item of fees) {
      const code = await prisma.procedurecode.findFirst({
        where: { ProcCode: item.procCode },
      });
      if (!code) continue;

      const existingFee = await prisma.fee.findFirst({
        where: { CodeNum: code.CodeNum, FeeSched: feeSchedNum },
      });

      const oldAmount = existingFee ? Number(existingFee.Amount) || 0 : 0;
      if (oldAmount !== item.amount) {
        diffs.push({
          key: `${item.procCode} Fee`,
          old: oldAmount,
          new: item.amount,
        });
      }

      if (existingFee) {
        const updated = await prisma.fee.update({
          where: { FeeNum: existingFee.FeeNum },
          data: { Amount: item.amount },
        });
        results.push(updated);
      } else {
        const nextId = await getNextId('fee', 'FeeNum');
        const created = await prisma.fee.create({
          data: {
            FeeNum: nextId,
            CodeNum: code.CodeNum,
            FeeSched: feeSchedNum,
            Amount: item.amount,
            UseDefaultFee: 0,
            UseDefaultCov: 0,
          },
        });
        results.push(created);
      }
    }

    if (diffs.length > 0) {
      await feeGuideAuditService.recordAuditLog({
        feeSchedNum,
        userId,
        action: 'Fee Change',
        diffs,
      });
    }

    return { success: true, count: results.length };
  }

  async getFeeGuideAuditHistory(id?: string) {
    if (id) {
      const feeSchedNum = BigInt(id);
      const sched = await prisma.feesched.findUnique({
        where: { FeeSchedNum: feeSchedNum },
      });
      if (!sched) {
        throw new NotFoundError('Fee schedule not found');
      }
    }
    return feeGuideAuditService.getAuditHistory(id);
  }

  async roundFeeScheduleFees(id: string, toNearest: number) {
    const feeSchedNum = BigInt(id);
    const sched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!sched) {
      throw new NotFoundError('Fee schedule not found');
    }

    const fees = await prisma.fee.findMany({
      where: { FeeSched: feeSchedNum },
    });

    let updatedCount = 0;
    for (const f of fees) {
      if (f.Amount === null || f.Amount === undefined) continue;

      // Rounding logic: round up to nearest (1, 0.1, 0.01)
      const factor = 1 / toNearest;
      const roundedAmount = Math.ceil(f.Amount * factor) / factor;

      await prisma.fee.update({
        where: { FeeNum: f.FeeNum },
        data: { Amount: roundedAmount },
      });
      updatedCount++;
    }

    return { success: true, updatedCount };
  }

  async setProviderFeeSchedule(id: string, providerId: string) {
    const feeSchedNum = BigInt(id);
    const sched = await prisma.feesched.findUnique({
      where: { FeeSchedNum: feeSchedNum },
    });
    if (!sched) {
      throw new NotFoundError('Fee schedule not found');
    }

    const provNum = BigInt(providerId);
    const providerRecord = await prisma.provider.findUnique({
      where: { ProvNum: provNum },
    });
    if (!providerRecord) {
      throw new NotFoundError('Provider not found');
    }

    await prisma.provider.update({
      where: { ProvNum: provNum },
      data: { FeeSched: feeSchedNum },
    });

    return { success: true };
  }
}

export const feeManagementService = new FeeManagementService();
