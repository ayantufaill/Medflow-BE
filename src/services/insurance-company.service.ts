import { InsuranceCompanyModel } from '../models/insurance-company.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

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
    const query: any = {};

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { payerId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;
    const [companies, total] = await Promise.all([
      InsuranceCompanyModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InsuranceCompanyModel.countDocuments(query),
    ]);

    return {
      companies,
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
    const company = await InsuranceCompanyModel.findById(insuranceCompanyId).lean();

    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    return company;
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
    const existing = await InsuranceCompanyModel.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, 'i') },
    });

    if (existing) {
      throw new ConflictError('Insurance company with this name already exists');
    }

    // Check if payer ID is unique (if provided)
    if (data.payerId) {
      const existingPayerId = await InsuranceCompanyModel.findOne({
        payerId: data.payerId.toUpperCase(),
      });

      if (existingPayerId) {
        throw new ConflictError('Insurance company with this payer ID already exists');
      }
    }

    const company = await InsuranceCompanyModel.create({
      name: data.name,
      payerId: data.payerId?.toUpperCase(),
      phone: data.phone,
      addressLine1: data.addressLine1,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      email: data.email?.toLowerCase(),
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    // Log activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'insurance_companies',
        company._id.toString(),
        undefined,
        { name: company.name },
        undefined,
        undefined,
        'low'
      );
    }

    return company;
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
    const company = await InsuranceCompanyModel.findById(insuranceCompanyId);
    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    // Check name uniqueness if updating name
    if (updates.name && updates.name !== company.name) {
      const existing = await InsuranceCompanyModel.findOne({
        name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
        _id: { $ne: insuranceCompanyId },
      });

      if (existing) {
        throw new ConflictError('Insurance company with this name already exists');
      }
    }

    // Check payer ID uniqueness if updating payer ID
    if (updates.payerId && updates.payerId !== company.payerId) {
      const existingPayerId = await InsuranceCompanyModel.findOne({
        payerId: updates.payerId.toUpperCase(),
        _id: { $ne: insuranceCompanyId },
      });

      if (existingPayerId) {
        throw new ConflictError('Insurance company with this payer ID already exists');
      }
    }

    const oldValues = {
      name: company.name,
      isActive: company.isActive,
    };

    // Update fields
    if (updates.name !== undefined) company.name = updates.name;
    if (updates.payerId !== undefined) company.payerId = updates.payerId.toUpperCase();
    if (updates.phone !== undefined) company.phone = updates.phone;
    if (updates.addressLine1 !== undefined) company.addressLine1 = updates.addressLine1;
    if (updates.city !== undefined) company.city = updates.city;
    if (updates.state !== undefined) company.state = updates.state;
    if (updates.zipCode !== undefined) company.zipCode = updates.zipCode;
    if (updates.email !== undefined) company.email = updates.email?.toLowerCase();
    if (updates.isActive !== undefined) (company as any).isActive = updates.isActive;

    await company.save();

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

    return company;
  }

  /**
   * Delete insurance company (soft delete)
   */
  async deleteInsuranceCompany(insuranceCompanyId: string, deletedBy?: string) {
    // Find first (so we can log old data before actual deletion)
    const company = await InsuranceCompanyModel.findById(insuranceCompanyId);
    if (!company) {
      throw new NotFoundError('Insurance company not found');
    }

    // Capture old values for activity log
    const oldValues = company.toObject();

    // Hard delete
    await InsuranceCompanyModel.findByIdAndDelete(insuranceCompanyId);

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

