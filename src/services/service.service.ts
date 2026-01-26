import { ServiceModel } from '../models/service.model';
import { ConflictError, NotFoundError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

export class ServiceService {
  async getAllServices(
    page = 1,
    limit = 10,
    filters: {
      search?: string;
      category?: string;
      isActive?: boolean;
      isBillable?: boolean;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.search) {
      const search = filters.search.trim();
      query.$or = [
        { cptCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.isBillable !== undefined) {
      query.isBillable = filters.isBillable;
    }

    const [services, total] = await Promise.all([
      ServiceModel.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ServiceModel.countDocuments(query),
    ]);

    return {
      services,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getServiceById(serviceId: string) {
    const service = await ServiceModel.findById(serviceId).lean();
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    return service;
  }

  async createService(
    data: {
      cptCode: string;
      name: string;
      description?: string;
      defaultPrice: number;
      durationMinutes?: number;
      category?: string;
      requiresAuthorization?: boolean;
      isBillable?: boolean;
      taxRate?: number;
      isActive?: boolean;
    },
    createdBy: string
  ) {
    const normalizedCode = data.cptCode.trim().toUpperCase();
    const existing = await ServiceModel.findOne({ cptCode: normalizedCode }).lean();
    if (existing) {
      throw new ConflictError('Service with this CPT code already exists');
    }

    const service = await ServiceModel.create({
      ...data,
      cptCode: normalizedCode,
    });

    await logActivity(
      createdBy,
      'created',
      'services',
      service.id,
      undefined,
      service.toObject(),
      undefined,
      undefined,
      'low'
    );

    return service;
  }

  async updateService(
    serviceId: string,
    updates: Partial<{
      cptCode: string;
      name: string;
      description: string;
      defaultPrice: number;
      durationMinutes: number;
      category: string;
      requiresAuthorization: boolean;
      isBillable: boolean;
      taxRate: number;
      isActive: boolean;
    }>,
    updatedBy: string
  ) {
    const service = await ServiceModel.findById(serviceId);
    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (updates.cptCode && updates.cptCode.toUpperCase() !== service.cptCode) {
      const existing = await ServiceModel.findOne({
        cptCode: updates.cptCode.toUpperCase(),
        _id: { $ne: serviceId },
      }).lean();
      if (existing) {
        throw new ConflictError('Service with this CPT code already exists');
      }
    }

    const oldData = service.toObject();
    Object.assign(service, updates);
    await service.save();

    await logActivity(
      updatedBy,
      'updated',
      'services',
      serviceId,
      oldData,
      service.toObject(),
      undefined,
      undefined,
      'low'
    );

    return service;
  }

  async deleteService(serviceId: string, deletedBy: string) {
    if (!serviceId || typeof serviceId !== 'string' || serviceId.trim().length === 0) {
      throw new NotFoundError('Invalid service ID provided');
    }
    
    // Trim and normalize the service ID
    const normalizedServiceId = serviceId.trim();
    
    // Try to find service by ID
    let service = await ServiceModel.findById(normalizedServiceId);
    
    // If not found by ID, try to find by _id as string (in case of normalization issues)
    if (!service) {
      service = await ServiceModel.findOne({ _id: normalizedServiceId });
    }
    
    if (!service) {
      // Log for debugging
      console.error(`Service not found with ID: ${normalizedServiceId} (length: ${normalizedServiceId.length})`);
      throw new NotFoundError('Service not found');
    }

    const oldData = service.toObject();

    // Hard delete like Providers
    await ServiceModel.findByIdAndDelete(serviceId);

    await logActivity(
      deletedBy,
      'deleted',
      'services',
      serviceId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Service deleted successfully' };
  }
}

export const serviceService = new ServiceService();
