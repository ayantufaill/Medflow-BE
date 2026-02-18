import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapProviderToApi } from '../utils/opendental-mappers.util';
import { getProviderMeta, mapUser, setProviderMeta } from '../utils/opendental-auth.util';

const PROVIDER_SPECIALTY_CATEGORY = 0;

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

async function findOrCreateSpecialtyDefinition(name: string): Promise<bigint> {
  const existingDefinition = await prisma.definition.findFirst({
    where: {
      Category: PROVIDER_SPECIALTY_CATEGORY,
      ItemName: name,
    },
  });

  if (existingDefinition) {
    return existingDefinition.DefNum;
  }

  const nextDefNum = await getNextId('definition', 'DefNum');
  const createdDef = await prisma.definition.create({
    data: {
      DefNum: nextDefNum,
      Category: PROVIDER_SPECIALTY_CATEGORY,
      ItemName: name,
      ItemOrder: 0,
      IsHidden: 0,
    },
  });

  return createdDef.DefNum;
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

    const userIds = Array.from(
      new Set(
        providers
          .map((p) => p.CustomID)
          .filter((id): id is string => Boolean(id))
      )
    );

    const linkedUsers = userIds.length
      ? await prisma.userod.findMany({
          where: { UserNum: { in: userIds.map((id) => BigInt(id)) } },
        })
      : [];

    const linkedUsersMap = new Map(
      await Promise.all(
        linkedUsers.map(async (user) => {
          const mappedUser = await mapUser(user);
          return [
            user.UserNum.toString(),
            {
              _id: mappedUser._id,
              firstName: mappedUser.firstName,
              lastName: mappedUser.lastName,
              email: mappedUser.email || null,
            },
          ] as const;
        })
      )
    );

    const providerMetaMap = new Map(
      await Promise.all(
        providers.map(async (provider) => [provider.ProvNum.toString(), await getProviderMeta(provider.ProvNum)] as const)
      )
    );

    return {
      providers: providers.map((p) =>
        mapProviderToApi(p, {
          specialtyName: p.definition?.ItemName ?? null,
          userId: p.CustomID ?? null,
          user: p.CustomID ? linkedUsersMap.get(p.CustomID) ?? null : null,
          appointmentBufferMinutes: providerMetaMap.get(p.ProvNum.toString())?.appointmentBufferMinutes ?? 0,
          workingHours: providerMetaMap.get(p.ProvNum.toString())?.workingHours ?? [],
          maxDailyAppointments: providerMetaMap.get(p.ProvNum.toString())?.maxDailyAppointments ?? null,
          consultationFee: providerMetaMap.get(p.ProvNum.toString())?.consultationFee ?? null,
          isAcceptingNewPatients: providerMetaMap.get(p.ProvNum.toString())?.isAcceptingNewPatients ?? true,
          telehealthEnabled: providerMetaMap.get(p.ProvNum.toString())?.telehealthEnabled ?? false,
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

    let linkedUser: { _id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null = null;
    if (provider.CustomID) {
      const user = await prisma.userod.findUnique({
        where: { UserNum: BigInt(provider.CustomID) },
      });

      if (user) {
        const mappedUser = await mapUser(user);
        linkedUser = {
          _id: mappedUser._id,
          firstName: mappedUser.firstName,
          lastName: mappedUser.lastName,
          email: mappedUser.email || null,
        };
      }
    }

    const providerMeta = await getProviderMeta(provider.ProvNum);

    return mapProviderToApi(provider, {
      specialtyName: provider.definition?.ItemName ?? null,
      userId: provider.CustomID ?? null,
      user: linkedUser,
      appointmentBufferMinutes: providerMeta.appointmentBufferMinutes ?? 0,
      workingHours: providerMeta.workingHours ?? [],
      maxDailyAppointments: providerMeta.maxDailyAppointments ?? null,
      consultationFee: providerMeta.consultationFee ?? null,
      isAcceptingNewPatients: providerMeta.isAcceptingNewPatients ?? true,
      telehealthEnabled: providerMeta.telehealthEnabled ?? false,
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

    const linkedUser = await prisma.userod.findUnique({
      where: { UserNum: BigInt(data.userId) },
    });

    const mappedLinkedUser = linkedUser ? await mapUser(linkedUser) : null;
    const providerFirstName =
      mappedLinkedUser?.firstName?.trim() ||
      linkedUser?.UserName?.split('@')[0]?.trim() ||
      'Provider';
    const providerLastName = mappedLinkedUser?.lastName?.trim() || '';

    // Generate provider code
    const providerCode = await generateProviderCode();

    const specialty = normalizeSpecialtyInput(data.specialty);
    let specialtyDefNum: bigint | null = null;
    if (specialty.length > 0) {
      const primarySpecialty = specialty[0];
      if (primarySpecialty) {
        specialtyDefNum = await findOrCreateSpecialtyDefinition(primarySpecialty);
      }
    }

    const nextId = await getNextId('provider', 'ProvNum');
    const provider = await prisma.provider.create({
      data: {
        ProvNum: nextId,
        Abbr: providerCode,
        FName: providerFirstName,
        LName: providerLastName,
        NationalProvID: data.npiNumber,
        StateLicense: data.licenseNumber ?? null,
        Specialty: specialtyDefNum,
        Suffix: data.title ?? 'MD',
        IsHidden: 0,
        CustomID: data.userId,
      },
    });

    await setProviderMeta(provider.ProvNum, {
      appointmentBufferMinutes: data.appointmentBufferMinutes ?? 0,
      maxDailyAppointments: data.maxDailyAppointments ?? null,
      consultationFee: data.consultationFee ?? null,
      isAcceptingNewPatients: data.isAcceptingNewPatients ?? true,
      telehealthEnabled: data.telehealthEnabled ?? false,
      workingHours: data.workingHours ?? [],
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
      appointmentBufferMinutes: data.appointmentBufferMinutes ?? 0,
      workingHours: data.workingHours ?? [],
      maxDailyAppointments: data.maxDailyAppointments ?? null,
      consultationFee: data.consultationFee ?? null,
      isAcceptingNewPatients: data.isAcceptingNewPatients ?? true,
      telehealthEnabled: data.telehealthEnabled ?? false,
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

    const currentMeta = await getProviderMeta(provider.ProvNum);

    if (updates.specialty !== undefined) {
      updates.specialty = normalizeSpecialtyInput(updates.specialty);
    }

    let specialtyDefNum: bigint | null | undefined = undefined;
    if (updates.specialty && updates.specialty.length > 0) {
      const primarySpecialty = updates.specialty[0];
      if (primarySpecialty) {
        specialtyDefNum = await findOrCreateSpecialtyDefinition(primarySpecialty);
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

    await setProviderMeta(provider.ProvNum, {
      appointmentBufferMinutes: updates.appointmentBufferMinutes ?? currentMeta.appointmentBufferMinutes ?? 0,
      maxDailyAppointments: updates.maxDailyAppointments ?? currentMeta.maxDailyAppointments ?? null,
      consultationFee: updates.consultationFee ?? currentMeta.consultationFee ?? null,
      isAcceptingNewPatients: updates.isAcceptingNewPatients ?? currentMeta.isAcceptingNewPatients ?? true,
      telehealthEnabled: updates.telehealthEnabled ?? currentMeta.telehealthEnabled ?? false,
      workingHours: updates.workingHours ?? currentMeta.workingHours ?? [],
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
      appointmentBufferMinutes: updates.appointmentBufferMinutes ?? currentMeta.appointmentBufferMinutes ?? 0,
      workingHours: updates.workingHours ?? currentMeta.workingHours ?? [],
      maxDailyAppointments: updates.maxDailyAppointments ?? currentMeta.maxDailyAppointments ?? null,
      consultationFee: updates.consultationFee ?? currentMeta.consultationFee ?? null,
      isAcceptingNewPatients: updates.isAcceptingNewPatients ?? currentMeta.isAcceptingNewPatients ?? true,
      telehealthEnabled: updates.telehealthEnabled ?? currentMeta.telehealthEnabled ?? false,
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
    const definitions = await prisma.definition.findMany({
      where: {
        Category: PROVIDER_SPECIALTY_CATEGORY,
        IsHidden: 0,
        ItemName: { not: null },
      },
      select: {
        ItemName: true,
      },
      orderBy: {
        ItemName: 'asc',
      },
    });

    const names = definitions
      .map((d) => d.ItemName?.trim())
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names)).sort();
  }
}

export const providerService = new ProviderService();
