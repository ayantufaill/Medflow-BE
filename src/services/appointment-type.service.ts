import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapAppointmentTypeToApi } from '../utils/opendental-mappers.util';
import { getAppointmentTypeMeta, setAppointmentTypeMeta, getAppointmentTypesMeta } from '../utils/opendental-auth.util';

const parseColorCodeToInt = (colorCode?: string): number | null => {
  if (!colorCode) return null;
  const normalized = colorCode.trim().replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
};

export class AppointmentTypeService {
  /**
   * Get all appointment types with pagination and search
   */
  async getAllAppointmentTypes(page = 1, limit = 10, search?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      const decodedSearch = decodeURIComponent(search.replace(/\+/g, ' '));
      where.OR = [
        { AppointmentTypeName: { contains: decodedSearch } },
        { Pattern: { contains: decodedSearch } },
      ];
    }

    if (isActive !== undefined) {
      where.IsHidden = isActive ? 0 : 1;
    }

    const [rows, total] = await Promise.all([
      prisma.appointmenttype.findMany({
        where,
        orderBy: { AppointmentTypeName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.appointmenttype.count({ where }),
    ]);

    const appointmentTypeNums = rows.map((r) => r.AppointmentTypeNum);
    const metaMapData = await getAppointmentTypesMeta(appointmentTypeNums);
    const metaMap = {
      get: (id: string) => metaMapData[id] || {}
    };

    return {
      appointmentTypes: rows.map((row) =>
        mapAppointmentTypeToApi(row, {
          description: metaMap.get(row.AppointmentTypeNum.toString())?.description ?? null,
          defaultDuration: metaMap.get(row.AppointmentTypeNum.toString())?.defaultDuration ?? 0,
          defaultPrice: metaMap.get(row.AppointmentTypeNum.toString())?.defaultPrice ?? 0,
          colorCode: metaMap.get(row.AppointmentTypeNum.toString())?.colorCode ?? null,
          bufferBefore: metaMap.get(row.AppointmentTypeNum.toString())?.bufferBefore ?? 0,
          bufferAfter: metaMap.get(row.AppointmentTypeNum.toString())?.bufferAfter ?? 0,
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
   * Get appointment type by ID
   */
  async getAppointmentTypeById(appointmentTypeId: string) {
    const appointmentType = await prisma.appointmenttype.findUnique({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
    });

    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    const meta = await getAppointmentTypeMeta(appointmentType.AppointmentTypeNum);

    return mapAppointmentTypeToApi(appointmentType, {
      description: meta.description ?? null,
      defaultDuration: meta.defaultDuration ?? 0,
      defaultPrice: meta.defaultPrice ?? 0,
      colorCode: meta.colorCode ?? null,
      bufferBefore: meta.bufferBefore ?? 0,
      bufferAfter: meta.bufferAfter ?? 0,
    });
  }

  /**
   * Create new appointment type
   */
  async createAppointmentType(
    data: {
      name: string;
      description?: string;
      defaultDuration: number;
      defaultPrice?: number;
      colorCode?: string;
      requiresAuthorization?: boolean;
      bufferBefore?: number;
      bufferAfter?: number;
      isActive?: boolean;
    },
    createdBy: string
  ) {
    // Check if name already exists
    const existing = await prisma.appointmenttype.findFirst({
      where: { AppointmentTypeName: data.name },
    });
    if (existing) {
      throw new ConflictError('Appointment type with this name already exists');
    }

    const nextId = await getNextId('appointmenttype', 'AppointmentTypeNum');
    const colorValue = parseColorCodeToInt(data.colorCode);

    // Create appointment type
    const appointmentType = await prisma.appointmenttype.create({
      data: {
        AppointmentTypeNum: nextId,
        AppointmentTypeName: data.name,
        AppointmentTypeColor: colorValue,
        RequiredProcCodesNeeded: data.requiresAuthorization ? 1 : 0,
        IsHidden: data.isActive === false ? 1 : 0,
      },
    });

    await setAppointmentTypeMeta(appointmentType.AppointmentTypeNum, {
      description: data.description ?? null,
      defaultDuration: data.defaultDuration ?? 0,
      defaultPrice: data.defaultPrice ?? 0,
      colorCode: data.colorCode ?? null,
      bufferBefore: data.bufferBefore ?? 0,
      bufferAfter: data.bufferAfter ?? 0,
    });

    const apiAppointmentType = mapAppointmentTypeToApi(appointmentType, {
      description: data.description ?? null,
      defaultDuration: data.defaultDuration ?? 0,
      defaultPrice: data.defaultPrice ?? 0,
      colorCode: data.colorCode ?? null,
      bufferBefore: data.bufferBefore ?? 0,
      bufferAfter: data.bufferAfter ?? 0,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'appointment_types',
      apiAppointmentType._id,
      undefined,
      apiAppointmentType,
      undefined,
      undefined,
      'low'
    );

    return apiAppointmentType;
  }

  /**
   * Update appointment type
   */
  async updateAppointmentType(
    appointmentTypeId: string,
    updates: {
      name?: string;
      description?: string;
      defaultDuration?: number;
      defaultPrice?: number;
      colorCode?: string;
      requiresAuthorization?: boolean;
      bufferBefore?: number;
      bufferAfter?: number;
      isActive?: boolean;
    },
    updatedBy: string
  ) {
    const appointmentType = await prisma.appointmenttype.findUnique({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
    });
    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    // Check if name is already in use by another appointment type
    if (updates.name && updates.name !== appointmentType.AppointmentTypeName) {
      const existing = await prisma.appointmenttype.findFirst({
        where: {
          AppointmentTypeName: updates.name,
          AppointmentTypeNum: { not: BigInt(appointmentTypeId) },
        },
      });
      if (existing) {
        throw new ConflictError('Appointment type with this name already exists');
      }
    }

    const oldData = mapAppointmentTypeToApi(appointmentType);
    const currentMeta = await getAppointmentTypeMeta(appointmentType.AppointmentTypeNum);
    const colorValue =
      updates.colorCode !== undefined ? parseColorCodeToInt(updates.colorCode) : undefined;

    const updated = await prisma.appointmenttype.update({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
      data: {
        AppointmentTypeName: updates.name ?? undefined,
        AppointmentTypeColor: colorValue === null ? null : colorValue,
        RequiredProcCodesNeeded:
          updates.requiresAuthorization !== undefined
            ? updates.requiresAuthorization
              ? 1
              : 0
            : undefined,
        IsHidden:
          updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    await setAppointmentTypeMeta(appointmentType.AppointmentTypeNum, {
      description: updates.description ?? currentMeta.description ?? null,
      defaultDuration: updates.defaultDuration ?? currentMeta.defaultDuration ?? 0,
      defaultPrice: updates.defaultPrice ?? currentMeta.defaultPrice ?? 0,
      colorCode: updates.colorCode ?? currentMeta.colorCode ?? null,
      bufferBefore: updates.bufferBefore ?? currentMeta.bufferBefore ?? 0,
      bufferAfter: updates.bufferAfter ?? currentMeta.bufferAfter ?? 0,
    });

    const apiAppointmentType = mapAppointmentTypeToApi(updated, {
      description: updates.description ?? currentMeta.description ?? null,
      defaultDuration: updates.defaultDuration ?? currentMeta.defaultDuration ?? 0,
      defaultPrice: updates.defaultPrice ?? currentMeta.defaultPrice ?? 0,
      colorCode: updates.colorCode ?? currentMeta.colorCode ?? null,
      bufferBefore: updates.bufferBefore ?? currentMeta.bufferBefore ?? 0,
      bufferAfter: updates.bufferAfter ?? currentMeta.bufferAfter ?? 0,
    });

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'appointment_types',
      appointmentTypeId,
      oldData,
      apiAppointmentType,
      undefined,
      undefined,
      'low'
    );

    return apiAppointmentType;
  }

  /**
   * Delete appointment type (hard delete)
   */
  async deleteAppointmentType(appointmentTypeId: string, deletedBy: string) {
    const appointmentType = await prisma.appointmenttype.findUnique({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
    });
    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    const oldData = mapAppointmentTypeToApi(appointmentType);

    // Hard delete - remove from database
    await prisma.appointmenttype.delete({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
    });

    // Log activity
    await logActivity(
      deletedBy,
      'deleted',
      'appointment_types',
      appointmentTypeId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Appointment type deleted successfully' };
  }
}

export const appointmentTypeService = new AppointmentTypeService();
