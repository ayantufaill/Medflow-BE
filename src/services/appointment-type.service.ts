import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapAppointmentTypeToApi } from '../utils/opendental-mappers.util';

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
        { AppointmentTypeName: { contains: decodedSearch, mode: 'insensitive' } },
        { Pattern: { contains: decodedSearch, mode: 'insensitive' } },
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

    return {
      appointmentTypes: rows.map(mapAppointmentTypeToApi),
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

    return mapAppointmentTypeToApi(appointmentType);
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
    const colorValue = data.colorCode ? Number.parseInt(data.colorCode, 10) : null;

    // Create appointment type
    const appointmentType = await prisma.appointmenttype.create({
      data: {
        AppointmentTypeNum: nextId,
        AppointmentTypeName: data.name,
        AppointmentTypeColor: Number.isNaN(colorValue) ? null : colorValue,
        RequiredProcCodesNeeded: data.requiresAuthorization ? 1 : 0,
        IsHidden: 0,
      },
    });

    const apiAppointmentType = mapAppointmentTypeToApi(appointmentType);

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
    const colorValue =
      updates.colorCode !== undefined ? Number.parseInt(updates.colorCode, 10) : undefined;

    const updated = await prisma.appointmenttype.update({
      where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
      data: {
        AppointmentTypeName: updates.name ?? undefined,
        AppointmentTypeColor: Number.isNaN(colorValue) ? undefined : colorValue,
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

    const apiAppointmentType = mapAppointmentTypeToApi(updated);

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
