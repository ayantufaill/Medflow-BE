import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';

export class InsuranceCompanyService {
  /**
   * Get all insurance companies with search, pagination, and status filter
   */
  async getAllInsuranceCompanies(options: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const { search, isActive, page = 1, limit = 10 } = options;
    const where: any = {};

    if (isActive !== undefined) {
      where.IsHidden = isActive ? 0 : 1;
    }

    if (search) {
      where.OR = [
        { CarrierName: { contains: search } },
        { ElectID: { contains: search } },
        { Phone: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;
    const [companies, total] = await Promise.all([
      prisma.carrier.findMany({
        where,
        orderBy: { CarrierName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.carrier.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        _id: c.CarrierNum.toString(),
        name: c.CarrierName ?? '',
        payerId: c.ElectID ?? null,
        phone: c.Phone ?? null,
        addressLine1: c.Address ?? null,
        city: c.City ?? null,
        state: c.State ?? null,
        zipCode: c.Zip ?? null,
        email: null,
        isActive: !c.IsHidden,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get insurance company by ID
   */
  async getInsuranceCompanyById(insuranceCompanyId: string) {
    const company = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
    });

    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    return {
      _id: company.CarrierNum.toString(),
      name: company.CarrierName ?? '',
      payerId: company.ElectID ?? null,
      phone: company.Phone ?? null,
      addressLine1: company.Address ?? null,
      city: company.City ?? null,
      state: company.State ?? null,
      zipCode: company.Zip ?? null,
      email: null,
      isActive: !company.IsHidden,
    };
  }

  /**
   * Create insurance company
   */
  async createInsuranceCompany(
    data: {
      name: string;
      payerId?: string;
      phone?: string;
      addressLine1?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      isActive?: boolean;
    },
    createdBy?: string
  ) {
    // Check if company with same name exists
    const existing = await prisma.carrier.findFirst({
      where: { CarrierName: { equals: data.name } },
    });

    if (existing) {
      throw new ConflictError('Insurance company with this name already exists');
    }

    // Check if payer ID is unique (if provided)
    if (data.payerId) {
      const existingPayerId = await prisma.carrier.findFirst({
        where: { ElectID: data.payerId.toUpperCase() },
      });

      if (existingPayerId) {
        throw new ConflictError('Insurance company with this payer ID already exists');
      }
    }

    const nextId = await getNextId('carrier', 'CarrierNum');
    const company = await prisma.carrier.create({
      data: {
        CarrierNum: nextId,
        CarrierName: data.name,
        ElectID: data.payerId?.toUpperCase(),
        Phone: data.phone ?? null,
        Address: data.addressLine1 ?? null,
        City: data.city ?? null,
        State: data.state ?? null,
        Zip: data.zipCode ?? null,
        IsHidden: data.isActive === false ? 1 : 0,
      },
    });

    // Log activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'insurance_companies',
        company.CarrierNum.toString(),
        undefined,
        { name: company.CarrierName },
        undefined,
        undefined,
        'low'
      );
    }

    return {
      _id: company.CarrierNum.toString(),
      name: company.CarrierName ?? '',
      payerId: company.ElectID ?? null,
      phone: company.Phone ?? null,
      addressLine1: company.Address ?? null,
      city: company.City ?? null,
      state: company.State ?? null,
      zipCode: company.Zip ?? null,
      email: null,
      isActive: !company.IsHidden,
    };
  }

  /**
   * Update insurance company
   */
  async updateInsuranceCompany(
    insuranceCompanyId: string,
    updates: {
      name?: string;
      payerId?: string;
      phone?: string;
      addressLine1?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      isActive?: boolean;
    },
    updatedBy?: string
  ) {
    const company = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
    });
    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    // Check name uniqueness if updating name
    if (updates.name && updates.name !== company.CarrierName) {
      const existing = await prisma.carrier.findFirst({
        where: {
          CarrierName: { equals: updates.name },
          CarrierNum: { not: BigInt(insuranceCompanyId) },
        },
      });

      if (existing) {
        throw new ConflictError('Insurance company with this name already exists');
      }
    }

    // Check payer ID uniqueness if updating payer ID
    if (updates.payerId && updates.payerId !== company.ElectID) {
      const existingPayerId = await prisma.carrier.findFirst({
        where: {
          ElectID: updates.payerId.toUpperCase(),
          CarrierNum: { not: BigInt(insuranceCompanyId) },
        },
      });

      if (existingPayerId) {
        throw new ConflictError('Insurance company with this payer ID already exists');
      }
    }

    const oldValues = {
      name: company.CarrierName,
      isActive: !company.IsHidden,
    };

    const updated = await prisma.carrier.update({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
      data: {
        CarrierName: updates.name ?? undefined,
        ElectID: updates.payerId ? updates.payerId.toUpperCase() : undefined,
        Phone: updates.phone ?? undefined,
        Address: updates.addressLine1 ?? undefined,
        City: updates.city ?? undefined,
        State: updates.state ?? undefined,
        Zip: updates.zipCode ?? undefined,
        IsHidden: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    // Log activity
    if (updatedBy) {
      await logActivity(
        updatedBy,
        'updated',
        'insurance_companies',
        insuranceCompanyId,
        oldValues,
        updates,
        undefined,
        undefined,
        'low'
      );
    }

    return {
      _id: updated.CarrierNum.toString(),
      name: updated.CarrierName ?? '',
      payerId: updated.ElectID ?? null,
      phone: updated.Phone ?? null,
      addressLine1: updated.Address ?? null,
      city: updated.City ?? null,
      state: updated.State ?? null,
      zipCode: updated.Zip ?? null,
      email: null,
      isActive: !updated.IsHidden,
    };
  }

  /**
   * Delete insurance company (soft delete)
   */
  async deleteInsuranceCompany(insuranceCompanyId: string, deletedBy?: string) {
    // Find first (so we can log old data before actual deletion)
    const company = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
    });
    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    // Capture old values for activity log
    const oldValues = {
      _id: company.CarrierNum.toString(),
      name: company.CarrierName ?? '',
    };

    // Hard delete
    await prisma.carrier.delete({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
    });

    // Log activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'insurance_companies',
        insuranceCompanyId,
        oldValues,
        null,         // new data = null because record is gone
        undefined,
        undefined,
        'high'
      );
    }

    return { message: 'Insurance company deleted permanently' };
  }

}

export const insuranceCompanyService = new InsuranceCompanyService();
