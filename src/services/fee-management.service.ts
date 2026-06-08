import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { mapServiceToApi } from '../utils/opendental-mappers.util';
import { getNextId } from '../utils/opendental-ids.util';

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
        include: { definition: true },
      }),
      prisma.procedurecode.count({ where }),
    ]);

    const mapped = rows.map((row) => ({
      ProcCode: row.ProcCode,
      Descript: row.Descript ?? '',
      Category: row.definition?.ItemName ?? '',
    }));

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
}

export const feeManagementService = new FeeManagementService();
