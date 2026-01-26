import { WaitlistEntryModel } from '../models/waitlist-entry.model';
import { ProviderModel } from '../models/provider.model';
import { PatientModel } from '../models/patient.model';
import { AppointmentTypeModel } from '../models/appointment-type.model';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { appointmentService } from './appointment.service';

export class WaitlistService {
  /**
   * Get all waitlist entries with pagination and filters
   */
  async getAllWaitlistEntries(page = 1, limit = 10, filters?: {
    patientId?: string;
    providerId?: string;
    status?: string;
    priority?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.patientId) {
      query.patientId = filters.patientId;
    }

    if (filters?.providerId) {
      query.providerId = filters.providerId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.priority) {
      query.priority = filters.priority;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      query.preferredDate = {};
      if (filters.dateFrom) {
        query.preferredDate.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.preferredDate.$lte = new Date(filters.dateTo);
      }
    }

    let patientIds: string[] = [];
    let providerIds: string[] = [];

    if (filters?.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      const matchingPatients = await PatientModel.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { patientCode: searchRegex },
        ],
      }).select('_id').lean();
      patientIds = matchingPatients.map((p) => p._id.toString());

      const matchingProviders = await ProviderModel.find({}).populate({
        path: 'userId',
        match: {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
          ],
        },
        select: '_id firstName lastName',
      }).lean();
      providerIds = matchingProviders
        .filter((p) => p.userId)
        .map((p) => p._id.toString());

      if (patientIds.length > 0 || providerIds.length > 0) {
        query.$or = [];
        if (patientIds.length > 0) {
          query.$or.push({ patientId: { $in: patientIds } });
        }
        if (providerIds.length > 0) {
          query.$or.push({ providerId: { $in: providerIds } });
        }
      } else {
        query._id = null;
      }
    }

    const [waitlistEntries, total] = await Promise.all([
      WaitlistEntryModel.find(query)
        .populate('patientId', 'firstName lastName patientCode email phonePrimary')
        .populate({
          path: 'providerId',
          select: 'providerCode specialty userId',
          populate: {
            path: 'userId',
            select: 'firstName lastName',
          },
        })
        .populate('appointmentTypeId', 'name defaultDuration')
        .populate('createdBy', 'firstName lastName email')
        .sort({ priority: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WaitlistEntryModel.countDocuments(query),
    ]);

    return {
      waitlistEntries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get waitlist entry by ID
   */
  async getWaitlistEntryById(waitlistEntryId: string) {
    const waitlistEntry = await WaitlistEntryModel.findById(waitlistEntryId)
      .populate('patientId')
      .populate('providerId')
      .populate('appointmentTypeId')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    return waitlistEntry;
  }

  /**
   * Create waitlist entry
   */
  async createWaitlistEntry(
    data: {
      patientId: string;
      providerId: string;
      appointmentTypeId?: string;
      preferredDate?: Date;
      preferredTimeStart?: string;
      preferredTimeEnd?: string;
      priority?: 'urgent' | 'normal' | 'flexible';
      notes?: string;
    },
    createdBy: string
  ) {
    // Validate patient exists
    const patient = await PatientModel.findById(data.patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Validate provider exists
    const provider = await ProviderModel.findById(data.providerId).lean();
    if (!provider || !provider.isActive) {
      throw new NotFoundError('Provider not found or inactive');
    }

    // Validate appointment type if provided
    if (data.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(data.appointmentTypeId).lean();
      if (!appointmentType || !appointmentType.isActive) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
    }

    // Validate time format if provided
    if (data.preferredTimeStart && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTimeStart)) {
      throw new BadRequestError('Preferred time start must be in HH:MM format');
    }

    if (data.preferredTimeEnd && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTimeEnd)) {
      throw new BadRequestError('Preferred time end must be in HH:MM format');
    }

    // Check for duplicate active waitlist entry (same patient, provider, and status)
    const existingEntry = await WaitlistEntryModel.findOne({
      patientId: data.patientId,
      providerId: data.providerId,
      status: 'active',
    }).lean();

    if (existingEntry) {
      throw new ConflictError('Patient is already on the waitlist for this provider');
    }

    // Create waitlist entry
    const waitlistEntry = await WaitlistEntryModel.create({
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      preferredDate: data.preferredDate,
      preferredTimeStart: data.preferredTimeStart,
      preferredTimeEnd: data.preferredTimeEnd,
      priority: data.priority || 'normal',
      status: 'active',
      notes: data.notes,
      createdBy,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'waitlist',
      String(waitlistEntry._id),
      undefined,
      waitlistEntry.toObject(),
      undefined,
      undefined,
      'low'
    );

    return waitlistEntry;
  }

  /**
   * Update waitlist entry
   */
  async updateWaitlistEntry(
    waitlistEntryId: string,
    updates: {
      appointmentTypeId?: string;
      preferredDate?: Date;
      preferredTimeStart?: string;
      preferredTimeEnd?: string;
      priority?: 'urgent' | 'normal' | 'flexible';
      status?: 'active' | 'called' | 'scheduled' | 'expired';
      notes?: string;
    },
    updatedBy: string
  ) {
    const waitlistEntry = await WaitlistEntryModel.findById(waitlistEntryId);
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    // Validate time format if provided
    if (updates.preferredTimeStart && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.preferredTimeStart)) {
      throw new BadRequestError('Preferred time start must be in HH:MM format');
    }

    if (updates.preferredTimeEnd && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.preferredTimeEnd)) {
      throw new BadRequestError('Preferred time end must be in HH:MM format');
    }

    const oldData = waitlistEntry.toObject();

    // Update fields
    Object.assign(waitlistEntry, updates);

    await waitlistEntry.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'waitlist',
      waitlistEntryId,
      oldData,
      waitlistEntry.toObject(),
      undefined,
      undefined,
      'low'
    );

    return waitlistEntry;
  }

  /**
   * Mark waitlist entry as called
   */
  async markAsCalled(waitlistEntryId: string, calledBy: string) {
    return this.updateWaitlistEntry(waitlistEntryId, { status: 'called' }, calledBy);
  }

  /**
   * Mark waitlist entry as scheduled
   */
  async markAsScheduled(waitlistEntryId: string, scheduledBy: string) {
    return this.updateWaitlistEntry(waitlistEntryId, { status: 'scheduled' }, scheduledBy);
  }

  /**
   * Convert waitlist entry to appointment
   * Creates an appointment from waitlist entry and marks waitlist as scheduled
   */
  async convertToAppointment(
    waitlistEntryId: string,
    appointmentData: {
      appointmentDate: Date;
      startTime: string;
      endTime: string;
      durationMinutes?: number;
      notes?: string;
      roomId?: string;
      chiefComplaint?: string;
    },
    convertedBy: string
  ) {
    const waitlistEntry = await WaitlistEntryModel.findById(waitlistEntryId)
      .populate('patientId')
      .populate('providerId')
      .populate('appointmentTypeId')
      .lean();

    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    if (String(waitlistEntry.status) === 'scheduled') {
      throw new BadRequestError('Waitlist entry is already scheduled');
    }

    // Get appointment type duration if not provided
    let durationMinutes = appointmentData.durationMinutes;
    if (!durationMinutes && waitlistEntry.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(
        String(waitlistEntry.appointmentTypeId)
      ).lean();
      if (appointmentType) {
        durationMinutes = Number(appointmentType.defaultDuration) || 30;
      }
    }
    if (!durationMinutes) {
      durationMinutes = 30; // Default
    }

    // Create appointment from waitlist entry
    const appointmentDataPayload: any = {
      patientId: String((waitlistEntry.patientId as any)?._id || waitlistEntry.patientId),
      providerId: String((waitlistEntry.providerId as any)?._id || waitlistEntry.providerId),
      appointmentDate: appointmentData.appointmentDate,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      durationMinutes,
      notes: appointmentData.notes
        ? `${appointmentData.notes}\n\nCreated from waitlist entry. Original waitlist notes: ${waitlistEntry.notes || 'None'}`
        : `Created from waitlist entry. Original waitlist notes: ${waitlistEntry.notes || 'None'}`,
    };
    
    if (waitlistEntry.appointmentTypeId) {
      appointmentDataPayload.appointmentTypeId = String((waitlistEntry.appointmentTypeId as any)?._id || waitlistEntry.appointmentTypeId);
    }
    if (appointmentData.roomId) {
      appointmentDataPayload.roomId = appointmentData.roomId;
    }
    if (appointmentData.chiefComplaint) {
      appointmentDataPayload.chiefComplaint = appointmentData.chiefComplaint;
    }
    
    const appointment = await appointmentService.createAppointment(
      appointmentDataPayload,
      convertedBy
    );

    // Mark waitlist entry as scheduled
    await this.markAsScheduled(waitlistEntryId, convertedBy);

    return {
      appointment,
      waitlistEntry: await WaitlistEntryModel.findById(waitlistEntryId).lean(),
    };
  }

  /**
   * Delete waitlist entry
   */
  async deleteWaitlistEntry(waitlistEntryId: string, deletedBy: string) {
    const waitlistEntry = await WaitlistEntryModel.findById(waitlistEntryId);
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    const oldData = waitlistEntry.toObject();

    await WaitlistEntryModel.deleteOne({ _id: waitlistEntryId });

    // Log activity
    await logActivity(
      deletedBy,
      'deleted',
      'waitlist',
      waitlistEntryId,
      oldData,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Waitlist entry deleted successfully' };
  }
}

export const waitlistService = new WaitlistService();
