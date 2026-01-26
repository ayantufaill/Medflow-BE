import { ProviderModel } from '../models/provider.model';
import { UserModel } from '../models/user.model';
import { SpecialtyModel } from '../models/specialty.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';


function normalizeSpecialtyInput(value: unknown): string[] {
  if (!value) return [];

  const raw = Array.isArray(value) ? value : [value];
  const trimmed = raw
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  return Array.from(new Set(trimmed));
}

/**
 * Generate unique provider code (e.g., PROV001, PROV002, etc.)
 */
async function generateProviderCode(): Promise<string> {
  const lastProvider = await ProviderModel.findOne()
    .sort({ providerCode: -1 })
    .select('providerCode')
    .lean();

  if (!lastProvider || !lastProvider.providerCode) {
    return 'PROV001';
  }

  const providerCodeStr = String(lastProvider.providerCode || '');
  const match = providerCodeStr.match(/\d+$/);
  if (!match) {
    return 'PROV001';
  }

  const lastNumber = parseInt(match[0], 10);
  const nextNumber = lastNumber + 1;

  return `PROV${nextNumber.toString().padStart(3, '0')}`;
}

export class ProviderService {
  /**
   * Get all providers with pagination and search
   */
  async getAllProviders(
    page = 1,
    limit = 10,
    search?: string,
    isActive?: boolean,
    specialty?: string
  ) {
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userId',
        },
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const matchConditions: any[] = [];

    if (isActive !== undefined) {
      matchConditions.push({ isActive });
    }

    if (specialty) {
      matchConditions.push({ specialty });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      matchConditions.push({
        $or: [
          { providerCode: searchRegex },
          { npiNumber: searchRegex },
          { specialty: searchRegex },
          { licenseNumber: searchRegex },
          { title: searchRegex },
          { 'userId.firstName': searchRegex },
          { 'userId.lastName': searchRegex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$userId.firstName', ' ', '$userId.lastName'] },
                regex: search,
                options: 'i',
              },
            },
          },
        ],
      });
    }

    if (matchConditions.length > 0) {
      pipeline.push({ $match: { $and: matchConditions } });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push(
      { $sort: { providerCode: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          providerCode: 1,
          npiNumber: 1,
          licenseNumber: 1,
          specialty: 1,
          title: 1,
          appointmentBufferMinutes: 1,
          maxDailyAppointments: 1,
          consultationFee: 1,
          isAcceptingNewPatients: 1,
          workingHours: 1,
          telehealthEnabled: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: {
            _id: '$userId._id',
            firstName: '$userId.firstName',
            lastName: '$userId.lastName',
            email: '$userId.email',
          },
        },
      }
    );

    const [providers, countResult] = await Promise.all([
      ProviderModel.aggregate(pipeline),
      ProviderModel.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total || 0;

    return {
      providers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string) {
    const provider = await ProviderModel.findById(providerId)
      .populate('userId', 'firstName lastName email phone')
      .lean();

    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    return provider;
  }

  /**
   * Create new provider
   */
  async createProvider(
    data: {
      userId: string;
      npiNumber: string;
      licenseNumber?: string;
      specialty?: string[] | string;
      title?: string;
      appointmentBufferMinutes?: number;
      maxDailyAppointments?: number;
      consultationFee?: number;
      isAcceptingNewPatients?: boolean;
      workingHours?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isAvailable: boolean;
      }>;
      telehealthEnabled?: boolean;
    },
    createdBy: string
  ) {
    // Validate user exists
    const user = await UserModel.findById(data.userId).lean();
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if provider already exists for this user
    const existingProvider = await ProviderModel.findOne({ userId: data.userId }).lean();
    if (existingProvider) {
      throw new ConflictError('Provider profile already exists for this user');
    }

    // Check if NPI number is already in use
    const existingNPI = await ProviderModel.findOne({ npiNumber: data.npiNumber }).lean();
    if (existingNPI) {
      throw new ConflictError('NPI number already in use');
    }

    // Generate provider code
    const providerCode = await generateProviderCode();

    const specialty = normalizeSpecialtyInput(data.specialty);

    // Validate working hours
    if (data.workingHours) {
      for (const wh of data.workingHours) {
        if (wh.dayOfWeek < 0 || wh.dayOfWeek > 6) {
          throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        }
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(wh.startTime)) {
          throw new Error('Start time must be in HH:MM format');
        }
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(wh.endTime)) {
          throw new Error('End time must be in HH:MM format');
        }
      }
    }

    // Create provider
    const provider = await ProviderModel.create({
      providerCode,
      userId: data.userId,
      npiNumber: data.npiNumber,
      licenseNumber: data.licenseNumber,
      specialty,
      title: data.title || 'MD',
      appointmentBufferMinutes: data.appointmentBufferMinutes || 15,
      maxDailyAppointments: data.maxDailyAppointments,
      consultationFee: data.consultationFee,
      isAcceptingNewPatients: data.isAcceptingNewPatients !== undefined ? data.isAcceptingNewPatients : true,
      workingHours: data.workingHours || [],
      telehealthEnabled: data.telehealthEnabled || false,
      isActive: true,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'providers',
      String(provider._id),
      undefined,
      provider.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return provider;
  }

  /**
   * Update provider
   */
  async updateProvider(
    providerId: string,
    updates: {
      npiNumber?: string;
      licenseNumber?: string;
      specialty?: string[] | string;
      title?: string;
      appointmentBufferMinutes?: number;
      maxDailyAppointments?: number;
      consultationFee?: number;
      isAcceptingNewPatients?: boolean;
      workingHours?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isAvailable: boolean;
      }>;
      telehealthEnabled?: boolean;
      isActive?: boolean;
    },
    updatedBy: string
  ) {
    const provider = await ProviderModel.findById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    // Check if NPI number is already in use by another provider
    if (updates.npiNumber && updates.npiNumber !== provider.npiNumber) {
      const existingNPI = await ProviderModel.findOne({
        npiNumber: updates.npiNumber,
        _id: { $ne: providerId },
      }).lean();
      if (existingNPI) {
        throw new ConflictError('NPI number already in use');
      }
    }

    // Validate working hours if provided
    if (updates.workingHours) {
      for (const wh of updates.workingHours) {
        if (wh.dayOfWeek < 0 || wh.dayOfWeek > 6) {
          throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        }
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(wh.startTime)) {
          throw new Error('Start time must be in HH:MM format');
        }
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(wh.endTime)) {
          throw new Error('End time must be in HH:MM format');
        }
      }
    }

    const oldData = provider.toObject();

    if (updates.specialty !== undefined) {
      updates.specialty = normalizeSpecialtyInput(updates.specialty);
    }

    // Update fields
    Object.assign(provider, updates);

    await provider.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'providers',
      providerId,
      oldData,
      provider.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return provider;
  }

  /**
   * Activate provider
   */
  async activateProvider(providerId: string, activatedBy: string) {
    const provider = await ProviderModel.findById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = provider.toObject();

    (provider as any).isActive = true;
    await provider.save();

    await logActivity(
      activatedBy,
      'updated',
      'providers',
      providerId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Provider deleted successfully' };
  }

  /**
   * Deactivate provider
   */
  async deactivateProvider(providerId: string, deactivatedBy: string) {
    const provider = await ProviderModel.findById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = provider.toObject();

    (provider as any).isActive = false;
    await provider.save();

    await logActivity(
      deactivatedBy,
      'updated',
      'providers',
      providerId,
      oldData,
      provider.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return provider;
  }

  /**
   * Permanently delete provider
   */
  async deleteProvider(providerId: string, deletedBy: string) {
    const provider = await ProviderModel.findById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = provider.toObject();

    await ProviderModel.findByIdAndDelete(providerId);

    await logActivity(
      deletedBy,
      'deleted',
      'providers',
      providerId,
      oldData,
      undefined,
      undefined,
      undefined,
      'high'
    );

    return { message: 'Provider permanently deleted' };
  }

  async getSpecialties() {
    const specialties = await SpecialtyModel.find({ isActive: true })
      .sort({ name: 1 })
      .select('name')
      .lean();
    return specialties.map((s) => s.name);
  }
}

export const providerService = new ProviderService();
