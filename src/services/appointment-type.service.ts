import { AppointmentTypeModel } from '../models/appointment-type.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

export class AppointmentTypeService {
  /**
   * Get all appointment types with pagination and search
   */
  async getAllAppointmentTypes(page = 1, limit = 10, search?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      const decodedSearch = decodeURIComponent(search.replace(/\+/g, ' '));
      query.$or = [
        { name: { $regex: decodedSearch, $options: 'i' } },
        { description: { $regex: decodedSearch, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const [appointmentTypes, total] = await Promise.all([
      AppointmentTypeModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AppointmentTypeModel.countDocuments(query),
    ]);

    return {
      appointmentTypes,
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
    const appointmentType = await AppointmentTypeModel.findById(appointmentTypeId).lean();

    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    return appointmentType;
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
    const existing = await AppointmentTypeModel.findOne({ name: data.name }).lean();
    if (existing) {
      throw new ConflictError('Appointment type with this name already exists');
    }

    // Create appointment type
    const appointmentType = await AppointmentTypeModel.create({
      name: data.name,
      description: data.description,
      defaultDuration: data.defaultDuration,
      defaultPrice: data.defaultPrice,
      colorCode: data.colorCode,
      requiresAuthorization: data.requiresAuthorization || false,
      bufferBefore: data.bufferBefore || 0,
      bufferAfter: data.bufferAfter || 0,
      isActive: true,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'appointment_types',
      String(appointmentType._id),
      undefined,
      appointmentType.toObject(),
      undefined,
      undefined,
      'low'
    );

    return appointmentType;
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
    const appointmentType = await AppointmentTypeModel.findById(appointmentTypeId);
    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    // Check if name is already in use by another appointment type
    if (updates.name && updates.name !== appointmentType.name) {
      const existing = await AppointmentTypeModel.findOne({
        name: updates.name,
        _id: { $ne: appointmentTypeId },
      }).lean();
      if (existing) {
        throw new ConflictError('Appointment type with this name already exists');
      }
    }

    const oldData = appointmentType.toObject();

    // Update fields
    Object.assign(appointmentType, updates);

    await appointmentType.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'appointment_types',
      appointmentTypeId,
      oldData,
      appointmentType.toObject(),
      undefined,
      undefined,
      'low'
    );

    return appointmentType;
  }

  /**
   * Delete appointment type (hard delete)
   */
  async deleteAppointmentType(appointmentTypeId: string, deletedBy: string) {
    const appointmentType = await AppointmentTypeModel.findById(appointmentTypeId);
    if (!appointmentType) {
      throw new NotFoundError('Appointment type not found');
    }

    const oldData = appointmentType.toObject();

    // Hard delete - remove from database
    await AppointmentTypeModel.deleteOne({ _id: appointmentTypeId });

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
