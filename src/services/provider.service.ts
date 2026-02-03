import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapProviderToApi } from '../utils/opendental-mappers.util';


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
  const nextId = await getNextId('provider', 'ProvNum');
  return `PROV${nextId.toString().padStart(3, '0')}`;
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
    const where: any = {};

    if (isActive !== undefined) {
      where.IsHidden = isActive ? 0 : 1;
    }

    if (specialty) {
      where.definition = {
        ItemName: { contains: specialty, mode: 'insensitive' },
      };
    }

    if (search) {
      where.OR = [
        { Abbr: { contains: search, mode: 'insensitive' } },
        { NationalProvID: { contains: search, mode: 'insensitive' } },
        { StateLicense: { contains: search, mode: 'insensitive' } },
        { Suffix: { contains: search, mode: 'insensitive' } },
        { FName: { contains: search, mode: 'insensitive' } },
        { LName: { contains: search, mode: 'insensitive' } },
        { definition: { ItemName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        include: { definition: true },
        orderBy: { Abbr: 'asc' },
        skip,
        take: limit,
      }),
      prisma.provider.count({ where }),
    ]);

    return {
      providers: providers.map((p) =>
        mapProviderToApi(p, {
          specialtyName: p.definition?.ItemName ?? null,
          userId: p.CustomID ?? null,
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

  /**
   * Get provider by ID
   */
  async getProviderById(providerId: string) {
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });

    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    return mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });
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
    // Check if provider already exists for this user
    const existingProvider = await prisma.provider.findFirst({
      where: { CustomID: data.userId },
    });
    if (existingProvider) {
      throw new ConflictError('Provider profile already exists for this user');
    }

    // Check if NPI number is already in use
    const existingNPI = await prisma.provider.findFirst({
      where: { NationalProvID: data.npiNumber },
    });
    if (existingNPI) {
      throw new ConflictError('NPI number already in use');
    }

    // Generate provider code
    const providerCode = await generateProviderCode();

    const specialty = normalizeSpecialtyInput(data.specialty);
    let specialtyDefNum: bigint | null = null;
    if (specialty.length > 0) {
      const existingDefinition = await prisma.definition.findFirst({
        where: { ItemName: specialty[0] },
      });
      if (existingDefinition) {
        specialtyDefNum = existingDefinition.DefNum;
      } else {
        const nextDefNum = await getNextId('definition', 'DefNum');
        const createdDef = await prisma.definition.create({
          data: {
            DefNum: nextDefNum,
            Category: 0,
            ItemName: specialty[0],
            ItemOrder: 0,
            IsHidden: 0,
          },
        });
        specialtyDefNum = createdDef.DefNum;
      }
    }

    const nextId = await getNextId('provider', 'ProvNum');
    const provider = await prisma.provider.create({
      data: {
        ProvNum: nextId,
        Abbr: providerCode,
        NationalProvID: data.npiNumber,
        StateLicense: data.licenseNumber ?? null,
        Specialty: specialtyDefNum,
        Suffix: data.title ?? 'MD',
        IsHidden: 0,
        CustomID: data.userId,
      },
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'providers',
      String(provider.ProvNum),
      undefined,
      mapProviderToApi(provider, {
        specialtyName: specialty[0] ?? null,
        userId: data.userId,
      }),
      undefined,
      undefined,
      'medium'
    );

    return mapProviderToApi(provider, {
      specialtyName: specialty[0] ?? null,
      userId: data.userId,
    });
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
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    // Check if NPI number is already in use by another provider
    if (updates.npiNumber && updates.npiNumber !== provider.NationalProvID) {
      const existingNPI = await prisma.provider.findFirst({
        where: {
          NationalProvID: updates.npiNumber,
          ProvNum: { not: BigInt(providerId) },
        },
      });
      if (existingNPI) {
        throw new ConflictError('NPI number already in use');
      }
    }

    const oldData = mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });

    if (updates.specialty !== undefined) {
      updates.specialty = normalizeSpecialtyInput(updates.specialty);
    }

    let specialtyDefNum: bigint | null | undefined = undefined;
    if (updates.specialty && updates.specialty.length > 0) {
      const existingDefinition = await prisma.definition.findFirst({
        where: { ItemName: updates.specialty[0] },
      });
      if (existingDefinition) {
        specialtyDefNum = existingDefinition.DefNum;
      } else {
        const nextDefNum = await getNextId('definition', 'DefNum');
        const createdDef = await prisma.definition.create({
          data: {
            DefNum: nextDefNum,
            Category: 0,
            ItemName: updates.specialty[0],
            ItemOrder: 0,
            IsHidden: 0,
          },
        });
        specialtyDefNum = createdDef.DefNum;
      }
    }

    const updated = await prisma.provider.update({
      where: { ProvNum: BigInt(providerId) },
      data: {
        NationalProvID: updates.npiNumber ?? undefined,
        StateLicense: updates.licenseNumber ?? undefined,
        Specialty: specialtyDefNum,
        Suffix: updates.title ?? undefined,
        IsHidden: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'providers',
      providerId,
      oldData,
      mapProviderToApi(updated, {
        specialtyName: updates.specialty?.[0] ?? provider.definition?.ItemName ?? null,
        userId: provider.CustomID ?? null,
      }),
      undefined,
      undefined,
      'medium'
    );

    return mapProviderToApi(updated, {
      specialtyName: updates.specialty?.[0] ?? provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });
  }

  /**
   * Activate provider
   */
  async activateProvider(providerId: string, activatedBy: string) {
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });
    await prisma.provider.update({
      where: { ProvNum: BigInt(providerId) },
      data: { IsHidden: 0 },
    });

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

    return { message: 'Provider activated successfully' };
  }

  /**
   * Deactivate provider
   */
  async deactivateProvider(providerId: string, deactivatedBy: string) {
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });
    const updated = await prisma.provider.update({
      where: { ProvNum: BigInt(providerId) },
      data: { IsHidden: 1 },
    });

    await logActivity(
      deactivatedBy,
      'updated',
      'providers',
      providerId,
      oldData,
      mapProviderToApi(updated, {
        specialtyName: provider.definition?.ItemName ?? null,
        userId: provider.CustomID ?? null,
      }),
      undefined,
      undefined,
      'medium'
    );

    return mapProviderToApi(updated, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });
  }

  /**
   * Permanently delete provider
   */
  async deleteProvider(providerId: string, deletedBy: string) {
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
      include: { definition: true },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const oldData = mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
    });

    await prisma.provider.delete({
      where: { ProvNum: BigInt(providerId) },
    });

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
    const providers = await prisma.provider.findMany({
      where: { Specialty: { not: null } },
      include: { definition: true },
    });
    const names = providers
      .map((p) => p.definition?.ItemName)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort();
  }
}

export const providerService = new ProviderService();
