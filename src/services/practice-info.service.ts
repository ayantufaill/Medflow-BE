import { PracticeInfoModel, type PracticeInfo } from '../models/practice-info.model';
import { NotFoundError, ConflictError } from '../utils/error.util';

export class PracticeInfoService {
  /**
   * Get all practice info records
   */
  async getAllPracticeInfo(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      const searchConditions: any[] = [
        // Basic fields
        { practiceName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { fax: { $regex: search, $options: 'i' } },
        { taxId: { $regex: search, $options: 'i' } },
        { npiNumber: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } },
        { billingContactEmail: { $regex: search, $options: 'i' } },
        { timezone: { $regex: search, $options: 'i' } },
        // Address fields
        { 'address.line1': { $regex: search, $options: 'i' } },
        { 'address.line2': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } },
        { 'address.postalCode': { $regex: search, $options: 'i' } },
      ];

      // Add numeric search if search term is a number
      if (!isNaN(Number(search)) && search.trim() !== '') {
        searchConditions.push({
          appointmentBufferMinutes: Number(search),
        });
      }

      query.$or = searchConditions;
    }

    const [practiceInfo, total] = await Promise.all([
      PracticeInfoModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PracticeInfoModel.countDocuments(query),
    ]);

    return {
      practiceInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get practice info by ID
   */
  async getPracticeInfoById(practiceInfoId: string): Promise<PracticeInfo> {
    const practiceInfo = await PracticeInfoModel.findById(practiceInfoId).lean();
    if (!practiceInfo) {
      throw new NotFoundError('Practice info not found');
    }
    return practiceInfo as any;
  }

  /**
   * Get single practice info (there should typically be only one)
   */
  async getPracticeInfo(): Promise<PracticeInfo | null> {
    const practiceInfo = await PracticeInfoModel.findOne().sort({ createdAt: -1 }).lean();
    return practiceInfo as any;
  }

  /**
   * Create a new practice info
   */
  async createPracticeInfo(
    data: {
      practiceName: string;
      taxId?: string;
      npiNumber?: string;
      phone: string;
      fax?: string;
      email: string;
      website?: string;
      address: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      logoPath?: string;
      businessHours?: Map<string, any> | Record<string, any>;
      timezone?: string;
      appointmentBufferMinutes?: number;
      billingContactEmail?: string;
    },
    updatedBy?: string
  ): Promise<PracticeInfo> {
    // Check if practice info with same taxId already exists (if provided)
    if (data.taxId) {
      const existingByTaxId = await PracticeInfoModel.findOne({ taxId: data.taxId });
      if (existingByTaxId) {
        throw new ConflictError('Practice info with this tax ID already exists');
      }
    }

    // Check if practice info with same NPI number already exists (if provided)
    if (data.npiNumber) {
      const existingByNpi = await PracticeInfoModel.findOne({ npiNumber: data.npiNumber });
      if (existingByNpi) {
        throw new ConflictError('Practice info with this NPI number already exists');
      }
    }

    // Convert Map to object if needed for businessHours
    let businessHours = data.businessHours;
    if (businessHours instanceof Map) {
      businessHours = Object.fromEntries(businessHours);
    }

    const practiceInfo = await PracticeInfoModel.create({
      practiceName: data.practiceName,
      taxId: data.taxId,
      npiNumber: data.npiNumber,
      phone: data.phone,
      fax: data.fax,
      email: data.email.toLowerCase(),
      website: data.website,
      address: data.address,
      logoPath: data.logoPath,
      businessHours: businessHours || {},
      timezone: data.timezone || 'UTC',
      appointmentBufferMinutes: data.appointmentBufferMinutes || 0,
      billingContactEmail: data.billingContactEmail?.toLowerCase(),
      updatedBy: updatedBy,
    });

    return practiceInfo.toObject();
  }

  /**
   * Update practice info
   */
  async updatePracticeInfo(
    practiceInfoId: string,
    updates: {
      practiceName?: string;
      taxId?: string;
      npiNumber?: string;
      phone?: string;
      fax?: string;
      email?: string;
      website?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      logoPath?: string;
      businessHours?: Map<string, any> | Record<string, any>;
      timezone?: string;
      appointmentBufferMinutes?: number;
      billingContactEmail?: string;
    },
    updatedBy?: string
  ): Promise<PracticeInfo> {
    const practiceInfo = await PracticeInfoModel.findById(practiceInfoId);
    if (!practiceInfo) {
      throw new NotFoundError('Practice info not found');
    }

    // Check for conflicts if taxId is being updated
    if (updates.taxId && updates.taxId !== practiceInfo.taxId) {
      const existingByTaxId = await PracticeInfoModel.findOne({ taxId: updates.taxId });
      if (existingByTaxId) {
        throw new ConflictError('Practice info with this tax ID already exists');
      }
    }

    // Check for conflicts if npiNumber is being updated
    if (updates.npiNumber && updates.npiNumber !== practiceInfo.npiNumber) {
      const existingByNpi = await PracticeInfoModel.findOne({ npiNumber: updates.npiNumber });
      if (existingByNpi) {
        throw new ConflictError('Practice info with this NPI number already exists');
      }
    }

    // Convert Map to object if needed for businessHours
    if (updates.businessHours instanceof Map) {
      updates.businessHours = Object.fromEntries(updates.businessHours);
    }

    // Update fields
    if (updates.practiceName !== undefined) practiceInfo.practiceName = updates.practiceName;
    if (updates.taxId !== undefined) practiceInfo.taxId = updates.taxId;
    if (updates.npiNumber !== undefined) practiceInfo.npiNumber = updates.npiNumber;
    if (updates.phone !== undefined) practiceInfo.phone = updates.phone;
    if (updates.fax !== undefined) practiceInfo.fax = updates.fax;
    if (updates.email !== undefined) (practiceInfo as any).email = updates.email.toLowerCase();
    if (updates.website !== undefined) (practiceInfo as any).website = updates.website;
    if (updates.address !== undefined) (practiceInfo as any).address = updates.address as any;
    if (updates.logoPath !== undefined) (practiceInfo as any).logoPath = updates.logoPath;
    if (updates.businessHours !== undefined) (practiceInfo as any).businessHours = updates.businessHours as any;
    if (updates.timezone !== undefined) (practiceInfo as any).timezone = updates.timezone;
    if (updates.appointmentBufferMinutes !== undefined) (practiceInfo as any).appointmentBufferMinutes = updates.appointmentBufferMinutes;
    if (updates.billingContactEmail !== undefined) {
      (practiceInfo as any).billingContactEmail = updates.billingContactEmail?.toLowerCase();
    }
    if (updatedBy !== undefined) (practiceInfo as any).updatedBy = updatedBy;

    await practiceInfo.save();

    return practiceInfo.toObject();
  }

  /**
   * Delete practice info
   */
  async deletePracticeInfo(practiceInfoId: string): Promise<void> {
    const practiceInfo = await PracticeInfoModel.findById(practiceInfoId);
    if (!practiceInfo) {
      throw new NotFoundError('Practice info not found');
    }

    await PracticeInfoModel.deleteOne({ _id: practiceInfoId });
  }
}

export const practiceInfoService = new PracticeInfoService();

