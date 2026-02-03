import { prisma } from '../config/db';
import { ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapServiceToApi } from '../utils/opendental-mappers.util';

const toBigInt = (value: string): bigint | null => (/^\\d+$/.test(value) ? BigInt(value) : null);

export class ServiceService {
  private async getDefaultFeeSchedNum(): Promise<bigint> {
    const existing = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });
    if (existing?.FeeSchedNum) {
      return existing.FeeSchedNum;
    }

    const nextId = await getNextId('feesched', 'FeeSchedNum');
    const created = await prisma.feesched.create({
      data: {
        FeeSchedNum: nextId,
        Description: 'MedFlow Default',
        FeeSchedType: 0,
        IsHidden: 0,
        IsGlobal: 1,
      },
    });
    return created.FeeSchedNum;
  }

  async getAllServices(
    page = 1,
    limit = 10,
    filters: {
      search?: string;
      category?: string;
      isActive?: boolean;
      isBillable?: boolean;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.search) {
      const search = filters.search.trim();
      where.OR = [
        { ProcCode: { contains: search, mode: 'insensitive' } },
        { Descript: { contains: search, mode: 'insensitive' } },
        { AbbrDesc: { contains: search, mode: 'insensitive' } },
        { DefaultNote: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters.category) {
      where.definition = {
        ItemName: { equals: filters.category, mode: 'insensitive' },
      };
    }

    if (filters.isActive !== undefined) {
      where.BypassGlobalLock = filters.isActive ? 0 : 1;
    }

    if (filters.isBillable !== undefined) {
      where.NoBillIns = filters.isBillable ? 0 : 1;
    }

    const feeSchedNum = await this.getDefaultFeeSchedNum();
    const [rows, total] = await Promise.all([
      prisma.procedurecode.findMany({
        where,
        orderBy: { Descript: 'asc' },
        skip,
        take: limit,
        include: { definition: true },
      }),
      prisma.procedurecode.count({ where }),
    ]);

    const codeNums = rows
      .map((row) => row.CodeNum)
      .filter((codeNum): codeNum is bigint => codeNum !== null && codeNum !== undefined);
    const fees = codeNums.length
      ? await prisma.fee.findMany({
          where: {
            FeeSched: feeSchedNum,
            CodeNum: { in: codeNums },
          },
        })
      : [];

    const feeMap = new Map<string, number>();
    fees.forEach((fee) => {
      if (fee.CodeNum !== null && fee.CodeNum !== undefined) {
        feeMap.set(fee.CodeNum.toString(), Number(fee.Amount) || 0);
      }
    });

    return {
      services: rows.map((row) =>
        mapServiceToApi(row, {
          feeAmount: feeMap.get(row.CodeNum?.toString() ?? '') ?? 0,
          categoryName: row.definition?.ItemName ?? null,
        })
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getServiceById(serviceId: string) {
    const feeSchedNum = await this.getDefaultFeeSchedNum();
    const service = await prisma.procedurecode.findFirst({
      where: {
        OR: [
          ...(toBigInt(serviceId) ? [{ CodeNum: toBigInt(serviceId)! }] : []),
          { ProcCode: serviceId },
        ],
      },
      include: { definition: true },
    });
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    const fee = service.CodeNum
      ? await prisma.fee.findFirst({
          where: { CodeNum: service.CodeNum, FeeSched: feeSchedNum },
        })
      : null;

    return mapServiceToApi(service, {
      feeAmount: Number(fee?.Amount) || 0,
      categoryName: service.definition?.ItemName ?? null,
    });
  }

  async createService(
    data: {
      cptCode: string;
      name: string;
      description?: string;
      defaultPrice: number;
      durationMinutes?: number;
      category?: string;
      requiresAuthorization?: boolean;
      isBillable?: boolean;
      taxRate?: number;
      isActive?: boolean;
    },
    createdBy: string
  ) {
    const normalizedCode = data.cptCode.trim().toUpperCase();
    const existing = await prisma.procedurecode.findFirst({
      where: { ProcCode: normalizedCode },
    });
    if (existing) {
      throw new ConflictError('Service with this CPT code already exists');
    }

    const feeSchedNum = await this.getDefaultFeeSchedNum();
    const codeNum = await getNextId('procedurecode', 'CodeNum');
    const procTimeValue =
      data.durationMinutes !== undefined ? String(data.durationMinutes) : undefined;

    let categoryDefNum: bigint | null = null;
    if (data.category) {
      const existingCategory = await prisma.definition.findFirst({
        where: {
          ItemName: data.category,
          Category: 18,
        },
      });
      if (existingCategory?.DefNum) {
        categoryDefNum = existingCategory.DefNum;
      } else {
        const nextDef = await getNextId('definition', 'DefNum');
        const createdDef = await prisma.definition.create({
          data: {
            DefNum: nextDef,
            Category: 18,
            ItemName: data.category,
            ItemValue: '',
            ItemOrder: 0,
            IsHidden: 0,
          },
        });
        categoryDefNum = createdDef.DefNum;
      }
    }

    const service = await prisma.procedurecode.create({
      data: {
        CodeNum: codeNum,
        ProcCode: normalizedCode,
        Descript: data.name,
        AbbrDesc: data.name.substring(0, 50),
        DefaultNote: data.description ?? null,
        ProcTime: procTimeValue,
        ProcCat: categoryDefNum ?? null,
        PreExisting: data.requiresAuthorization ? 1 : 0,
        NoBillIns: data.isBillable === false ? 1 : 0,
        TaxCode: data.taxRate !== undefined ? String(data.taxRate) : null,
        BypassGlobalLock: data.isActive === false ? 1 : 0,
      },
    });

    if (data.defaultPrice !== undefined) {
      const feeNum = await getNextId('fee', 'FeeNum');
      await prisma.fee.create({
        data: {
          FeeNum: feeNum,
          Amount: data.defaultPrice,
          FeeSched: feeSchedNum,
          CodeNum: codeNum,
          UseDefaultFee: 0,
          UseDefaultCov: 0,
        },
      });
    }

    const apiService = mapServiceToApi(service, {
      feeAmount: data.defaultPrice ?? 0,
      categoryName: data.category ?? null,
    });

    await logActivity(
      createdBy,
      'created',
      'services',
      apiService._id,
      undefined,
      apiService,
      undefined,
      undefined,
      'low'
    );

    return apiService;
  }

  async updateService(
    serviceId: string,
    updates: Partial<{
      cptCode: string;
      name: string;
      description: string;
      defaultPrice: number;
      durationMinutes: number;
      category: string;
      requiresAuthorization: boolean;
      isBillable: boolean;
      taxRate: number;
      isActive: boolean;
    }>,
    updatedBy: string
  ) {
    const service = await prisma.procedurecode.findFirst({
      where: {
        OR: [
          ...(toBigInt(serviceId) ? [{ CodeNum: toBigInt(serviceId)! }] : []),
          { ProcCode: serviceId },
        ],
      },
      include: { definition: true },
    });
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (updates.cptCode && updates.cptCode.toUpperCase() !== service.ProcCode) {
      const existing = await prisma.procedurecode.findFirst({
        where: {
          ProcCode: updates.cptCode.toUpperCase(),
        },
      });
      if (existing) {
        throw new ConflictError('Service with this CPT code already exists');
      }
    }

    const feeSchedNum = await this.getDefaultFeeSchedNum();
    const oldData = mapServiceToApi(service, {
      feeAmount: 0,
      categoryName: service.definition?.ItemName ?? null,
    });

    let categoryDefNum: bigint | undefined;
    if (updates.category) {
      const existingCategory = await prisma.definition.findFirst({
        where: {
          ItemName: updates.category,
          Category: 18,
        },
      });
      if (existingCategory?.DefNum) {
        categoryDefNum = existingCategory.DefNum;
      } else {
        const nextDef = await getNextId('definition', 'DefNum');
        const createdDef = await prisma.definition.create({
          data: {
            DefNum: nextDef,
            Category: 18,
            ItemName: updates.category,
            ItemValue: '',
            ItemOrder: 0,
            IsHidden: 0,
          },
        });
        categoryDefNum = createdDef.DefNum;
      }
    }

    const updated = await prisma.procedurecode.update({
      where: { ProcCode: service.ProcCode },
      data: {
        ProcCode: updates.cptCode ? updates.cptCode.toUpperCase() : undefined,
        Descript: updates.name ?? undefined,
        AbbrDesc: updates.name ? updates.name.substring(0, 50) : undefined,
        DefaultNote: updates.description ?? undefined,
        ProcTime:
          updates.durationMinutes !== undefined
            ? String(updates.durationMinutes)
            : undefined,
        ProcCat: categoryDefNum ?? undefined,
        PreExisting:
          updates.requiresAuthorization !== undefined
            ? updates.requiresAuthorization
              ? 1
              : 0
            : undefined,
        NoBillIns:
          updates.isBillable !== undefined ? (updates.isBillable ? 0 : 1) : undefined,
        TaxCode: updates.taxRate !== undefined ? String(updates.taxRate) : undefined,
        BypassGlobalLock:
          updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    if (updates.defaultPrice !== undefined && updated.CodeNum) {
      const existingFee = await prisma.fee.findFirst({
        where: { CodeNum: updated.CodeNum, FeeSched: feeSchedNum },
      });
      if (existingFee) {
        await prisma.fee.update({
          where: { FeeNum: existingFee.FeeNum },
          data: { Amount: updates.defaultPrice },
        });
      } else {
        const feeNum = await getNextId('fee', 'FeeNum');
        await prisma.fee.create({
          data: {
            FeeNum: feeNum,
            Amount: updates.defaultPrice,
            FeeSched: feeSchedNum,
            CodeNum: updated.CodeNum,
            UseDefaultFee: 0,
            UseDefaultCov: 0,
          },
        });
      }
    }

    await logActivity(
      updatedBy,
      'updated',
      'services',
      serviceId,
      oldData,
      mapServiceToApi(updated, {
        feeAmount: updates.defaultPrice ?? 0,
        categoryName: updates.category ?? service.definition?.ItemName ?? null,
      }),
      undefined,
      undefined,
      'low'
    );

    return mapServiceToApi(updated, {
      feeAmount: updates.defaultPrice ?? 0,
      categoryName: updates.category ?? service.definition?.ItemName ?? null,
    });
  }

  async deleteService(serviceId: string, deletedBy: string) {
    if (!serviceId || typeof serviceId !== 'string' || serviceId.trim().length === 0) {
      throw new NotFoundError('Invalid service ID provided');
    }

    const normalizedServiceId = serviceId.trim();
    const service = await prisma.procedurecode.findFirst({
      where: {
        OR: [
          ...(toBigInt(normalizedServiceId) ? [{ CodeNum: toBigInt(normalizedServiceId)! }] : []),
          { ProcCode: normalizedServiceId },
        ],
      },
      include: { definition: true },
    });

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    const oldData = mapServiceToApi(service, {
      feeAmount: 0,
      categoryName: service.definition?.ItemName ?? null,
    });

    if (service.CodeNum) {
      await prisma.fee.deleteMany({ where: { CodeNum: service.CodeNum } });
    }
    await prisma.procedurecode.delete({ where: { ProcCode: service.ProcCode } });

    await logActivity(
      deletedBy,
      'deleted',
      'services',
      serviceId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Service deleted successfully' };
  }
}

export const serviceService = new ServiceService();
