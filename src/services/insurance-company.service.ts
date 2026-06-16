import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';

const INSURANCE_COMPANY_META_FKEY_TYPE = 214;

type InsuranceCompanyMeta = {
  email?: string | null;
  fax?: string | null;
  website?: string | null;
  country?: string | null;
  claimType?: string | null;
  notes?: string | null;
  providersOutOfNetwork?: string[] | null;
};

const parseMeta = (value?: string | null): InsuranceCompanyMeta => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as InsuranceCompanyMeta) : {};
  } catch {
    return {};
  }
};

export class InsuranceCompanyService {
  private resolveEmailValue(input: any): string | undefined {
    if (!input || typeof input !== 'object') return undefined;

    const entries = Object.entries(input as Record<string, unknown>);
    const match = entries.find(([key]) => key.trim().toLowerCase() === 'email');
    if (!match) return undefined;

    const value = match[1];
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private async getMetaMap(carrierNums: bigint[]) {
    if (carrierNums.length === 0) return new Map<string, InsuranceCompanyMeta>();
    const rows = await prisma.userodpref.findMany({
      where: {
        FkeyType: INSURANCE_COMPANY_META_FKEY_TYPE,
        Fkey: { in: carrierNums },
      },
      orderBy: { UserOdPrefNum: 'desc' },
    });

    const map = new Map<string, InsuranceCompanyMeta>();
    for (const row of rows) {
      if (!row.Fkey) continue;
      const key = row.Fkey.toString();
      if (map.has(key)) continue;
      map.set(key, parseMeta(row.ValueString));
    }
    return map;
  }

  private async saveMeta(carrierNum: bigint, meta: InsuranceCompanyMeta) {
    const existing = await prisma.userodpref.findFirst({
      where: {
        FkeyType: INSURANCE_COMPANY_META_FKEY_TYPE,
        Fkey: carrierNum,
      },
      orderBy: { UserOdPrefNum: 'desc' },
    });

    let currentMeta: InsuranceCompanyMeta = {};
    if (existing) {
      currentMeta = parseMeta(existing.ValueString);
    }

    const valueString = JSON.stringify({
      email: meta.email !== undefined ? meta.email : (currentMeta.email ?? null),
      fax: meta.fax !== undefined ? meta.fax : (currentMeta.fax ?? null),
      website: meta.website !== undefined ? meta.website : (currentMeta.website ?? null),
      country: meta.country !== undefined ? meta.country : (currentMeta.country ?? null),
      claimType: meta.claimType !== undefined ? meta.claimType : (currentMeta.claimType ?? null),
      notes: meta.notes !== undefined ? meta.notes : (currentMeta.notes ?? null),
      providersOutOfNetwork: meta.providersOutOfNetwork !== undefined ? meta.providersOutOfNetwork : (currentMeta.providersOutOfNetwork ?? null),
    });

    if (existing) {
      await prisma.userodpref.update({
        where: { UserOdPrefNum: existing.UserOdPrefNum },
        data: { ValueString: valueString },
      });
      return;
    }

    const nextPrefId = await getNextId('userodpref', 'UserOdPrefNum');
    await prisma.userodpref.create({
      data: {
        UserOdPrefNum: nextPrefId,
        FkeyType: INSURANCE_COMPANY_META_FKEY_TYPE,
        Fkey: carrierNum,
        ValueString: valueString,
      },
    });
  }

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
    const metaMap = await this.getMetaMap(companies.map((c) => c.CarrierNum));

    return {
      companies: companies.map((c) => {
        const meta = metaMap.get(c.CarrierNum.toString());
        return {
          _id: c.CarrierNum.toString(),
          name: c.CarrierName ?? '',
          payerId: c.ElectID ?? null,
          phone: c.Phone ?? null,
          addressLine1: c.Address ?? null,
          addressLine2: c.Address2 ?? null,
          city: c.City ?? null,
          state: c.State ?? null,
          zipCode: c.Zip ?? null,
          email: meta?.email ?? c.TIN ?? null,
          fax: meta?.fax ?? null,
          website: meta?.website ?? null,
          country: meta?.country ?? null,
          claimType: meta?.claimType ?? null,
          notes: meta?.notes ?? null,
          providersOutOfNetwork: meta?.providersOutOfNetwork ?? [],
          isActive: !c.IsHidden,
        };
      }),
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
    const metaMap = await this.getMetaMap([company.CarrierNum]);
    const meta = metaMap.get(company.CarrierNum.toString());

    return {
      _id: company.CarrierNum.toString(),
      name: company.CarrierName ?? '',
      payerId: company.ElectID ?? null,
      phone: company.Phone ?? null,
      addressLine1: company.Address ?? null,
      addressLine2: company.Address2 ?? null,
      city: company.City ?? null,
      state: company.State ?? null,
      zipCode: company.Zip ?? null,
      email: meta?.email ?? company.TIN ?? null,
      fax: meta?.fax ?? null,
      website: meta?.website ?? null,
      country: meta?.country ?? null,
      claimType: meta?.claimType ?? null,
      notes: meta?.notes ?? null,
      providersOutOfNetwork: meta?.providersOutOfNetwork ?? [],
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
      addressLine2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      fax?: string;
      website?: string;
      country?: string;
      claimType?: string;
      notes?: string;
      providersOutOfNetwork?: string[];
      isActive?: boolean;
    },
    createdBy?: string
  ) {
    const emailValue = this.resolveEmailValue(data) ?? data.email;
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
        Address2: data.addressLine2 ?? null,
        City: data.city ?? null,
        State: data.state ?? null,
        Zip: data.zipCode ?? null,
        TIN: emailValue ?? null,
        IsHidden: data.isActive === false ? 1 : 0,
      },
    });
    await this.saveMeta(company.CarrierNum, {
      email: emailValue ?? null,
      fax: data.fax ?? null,
      website: data.website ?? null,
      country: data.country ?? null,
      claimType: data.claimType ?? null,
      notes: data.notes ?? null,
      providersOutOfNetwork: data.providersOutOfNetwork ?? null,
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
      addressLine2: company.Address2 ?? null,
      city: company.City ?? null,
      state: company.State ?? null,
      zipCode: company.Zip ?? null,
      email: emailValue ?? company.TIN ?? null,
      fax: data.fax ?? null,
      website: data.website ?? null,
      country: data.country ?? null,
      claimType: data.claimType ?? null,
      notes: data.notes ?? null,
      providersOutOfNetwork: data.providersOutOfNetwork ?? [],
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
      addressLine2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      fax?: string;
      website?: string;
      country?: string;
      claimType?: string;
      notes?: string;
      providersOutOfNetwork?: string[];
      isActive?: boolean;
    },
    updatedBy?: string
  ) {
    const emailValue = this.resolveEmailValue(updates) ?? updates.email;
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
        Address2: updates.addressLine2 ?? undefined,
        City: updates.city ?? undefined,
        State: updates.state ?? undefined,
        Zip: updates.zipCode ?? undefined,
        TIN: emailValue ?? undefined,
        IsHidden: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });
    if (emailValue !== undefined || updates.fax !== undefined || updates.website !== undefined || updates.country !== undefined || updates.claimType !== undefined || updates.notes !== undefined || updates.providersOutOfNetwork !== undefined) {
      await this.saveMeta(updated.CarrierNum, {
        email: emailValue,
        fax: updates.fax,
        website: updates.website,
        country: updates.country,
        claimType: updates.claimType,
        notes: updates.notes,
        providersOutOfNetwork: updates.providersOutOfNetwork,
      });
    }
    const metaMap = await this.getMetaMap([updated.CarrierNum]);
    const updatedMeta = metaMap.get(updated.CarrierNum.toString());

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
      addressLine2: updated.Address2 ?? null,
      city: updated.City ?? null,
      state: updated.State ?? null,
      zipCode: updated.Zip ?? null,
      email: updatedMeta?.email ?? updated.TIN ?? null,
      fax: updatedMeta?.fax ?? null,
      website: updatedMeta?.website ?? null,
      country: updatedMeta?.country ?? null,
      claimType: updatedMeta?.claimType ?? null,
      notes: updatedMeta?.notes ?? null,
      providersOutOfNetwork: updatedMeta?.providersOutOfNetwork ?? [],
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

    // Soft-delete (OpenDental Standard): Mark as hidden to bypass foreign key constraint conflicts
    await prisma.carrier.update({
      where: { CarrierNum: BigInt(insuranceCompanyId) },
      data: {
        IsHidden: 1,
        SecDateTEdit: new Date(),
      },
    });

    // Log activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'insurance_companies',
        insuranceCompanyId,
        oldValues,
        { ...oldValues, isActive: false },
        undefined,
        undefined,
        'high'
      );
    }

    return { message: 'Insurance company deleted' };
  }

}

export const insuranceCompanyService = new InsuranceCompanyService();
