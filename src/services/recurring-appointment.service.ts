import { RecurringAppointmentModel } from '../models/recurring-appointment.model';
import { AppointmentModel } from '../models/appointment.model';
import { ProviderModel } from '../models/provider.model';
import { PatientModel } from '../models/patient.model';
import { AppointmentTypeModel } from '../models/appointment-type.model';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { appointmentService } from './appointment.service';

export class RecurringAppointmentService {
  /**
   * Get all recurring appointments with pagination
   */
  async getAllRecurringAppointments(page = 1, limit = 10, filters?: {
    patientId?: string;
    providerId?: string;
    isActive?: boolean;
    search?: string;
    startDateFrom?: string;
    startDateTo?: string;
  }) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.patientId) {
      query.patientId = filters.patientId;
    }

    if (filters?.providerId) {
      query.providerId = filters.providerId;
    }

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.startDateFrom || filters?.startDateTo) {
      query.startDate = {};
      if (filters.startDateFrom) {
        query.startDate.$gte = new Date(filters.startDateFrom);
      }
      if (filters.startDateTo) {
        query.startDate.$lte = new Date(filters.startDateTo);
      }
    }

    let patientIds: string[] = [];
    let providerIds: string[] = [];

    if (filters?.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      const [matchingPatients, matchingProviders] = await Promise.all([
        PatientModel.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
          ]
        }).select('_id').lean(),
        ProviderModel.find({}).populate({
          path: 'userId',
          match: {
            $or: [
              { firstName: searchRegex },
              { lastName: searchRegex },
            ]
          },
          select: '_id'
        }).select('_id userId').lean()
      ]);

      patientIds = matchingPatients.map(p => p._id.toString());
      providerIds = matchingProviders
        .filter(p => p.userId)
        .map(p => p._id.toString());

      query.$or = [];
      if (patientIds.length > 0) {
        query.$or.push({ patientId: { $in: patientIds } });
      }
      if (providerIds.length > 0) {
        query.$or.push({ providerId: { $in: providerIds } });
      }
      query.$or.push({ frequency: searchRegex });

      if (query.$or.length === 0) {
        return {
          recurringAppointments: [],
          pagination: { page, limit, total: 0, pages: 0 },
        };
      }
    }

    const [recurringAppointments, total] = await Promise.all([
      RecurringAppointmentModel.find(query)
        .populate('patientId', 'firstName lastName patientCode')
        .populate({
          path: 'providerId',
          select: 'providerCode specialty userId',
          populate: { path: 'userId', select: 'firstName lastName' }
        })
        .populate('appointmentTypeId', 'name defaultDuration')
        .populate('createdBy', 'firstName lastName email')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecurringAppointmentModel.countDocuments(query),
    ]);

    return {
      recurringAppointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get recurring appointment by ID
   */
  async getRecurringAppointmentById(recurringAppointmentId: string) {
    const recurringAppointment = await RecurringAppointmentModel.findById(recurringAppointmentId)
      .populate('patientId')
      .populate('providerId')
      .populate('appointmentTypeId')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!recurringAppointment) {
      throw new NotFoundError('Recurring appointment not found');
    }

    return recurringAppointment;
  }

  /**
   * Create recurring appointment series
   */
  async createRecurringAppointment(
    data: {
      patientId: string;
      providerId: string;
      appointmentTypeId?: string;
      frequency: 'weekly' | 'monthly' | 'quarterly';
      frequencyValue: number;
      startDate: Date;
      endDate?: Date;
      preferredTime: string;
      preferredDayOfWeek?: number;
      totalAppointments?: number;
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

    // Validate preferred time format
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    // Validate day of week if provided
    if (data.preferredDayOfWeek !== undefined && (data.preferredDayOfWeek < 0 || data.preferredDayOfWeek > 6)) {
      throw new BadRequestError('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Calculate totalAppointments from endDate if not provided
    let totalAppointments = data.totalAppointments;
    if (!totalAppointments && data.endDate) {
      // Auto-calculate based on frequency and date range
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (data.frequency === 'weekly') {
        // Calculate number of weeks
        const weeks = Math.ceil(daysDiff / (7 * data.frequencyValue));
        totalAppointments = Math.max(1, weeks);
      } else if (data.frequency === 'monthly') {
        // Approximate months
        const months = Math.ceil(daysDiff / (30 * data.frequencyValue));
        totalAppointments = Math.max(1, months);
      } else if (data.frequency === 'quarterly') {
        // Approximate quarters
        const quarters = Math.ceil(daysDiff / (90 * data.frequencyValue));
        totalAppointments = Math.max(1, quarters);
      }
    }

    // Create recurring appointment
    const recurringAppointment = await RecurringAppointmentModel.create({
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate,
      endDate: data.endDate,
      preferredTime: data.preferredTime,
      preferredDayOfWeek: data.preferredDayOfWeek,
      totalAppointments: totalAppointments,
      appointmentsCreated: 0,
      isActive: true,
      createdBy,
    });

    // Generate appointments if totalAppointments is specified or calculated
    let generatedInfo = null;
    if (totalAppointments) {
      const generateResult = await this.generateAppointments(String(recurringAppointment._id), totalAppointments, createdBy);
      generatedInfo = {
        appointmentsCreated: generateResult.appointments.length,
        skippedCount: generateResult.skippedCount || 0,
      };
    }

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'recurring_appointments',
      String(recurringAppointment._id),
      undefined,
      recurringAppointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    // Return recurring appointment with generation info if appointments were generated
    if (generatedInfo) {
      return {
        recurringAppointment,
        ...generatedInfo,
      };
    }

    return recurringAppointment;
  }

  /**
   * Preview proposed dates/times for a recurring appointment series without creating them
   */
  async previewRecurringAppointments(data: {
    providerId: string;
    appointmentTypeId?: string;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    frequencyValue: number;
    startDate: Date;
    endDate?: Date;
    preferredTime: string;
    preferredDayOfWeek?: number;
    totalAppointments?: number;
  }) {
    // Validate provider exists
    const provider = await ProviderModel.findById(data.providerId).lean();
    if (!provider || !provider.isActive) {
      throw new NotFoundError('Provider not found or inactive');
    }

    // Validate appointment type if provided
    let durationMinutes = 30; // Default
    if (data.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(data.appointmentTypeId).lean();
      if (!appointmentType || !appointmentType.isActive) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
      durationMinutes = Number(appointmentType.defaultDuration) || 30;
    }

    // Validate preferred time format
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    // Calculate total appointments
    let totalAppointments = data.totalAppointments;
    if (!totalAppointments && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (data.frequency === 'weekly') {
        const weeks = Math.ceil(daysDiff / (7 * data.frequencyValue));
        totalAppointments = Math.max(1, weeks);
      } else if (data.frequency === 'monthly') {
        const months = Math.ceil(daysDiff / (30 * data.frequencyValue));
        totalAppointments = Math.max(1, months);
      } else if (data.frequency === 'quarterly') {
        const quarters = Math.ceil(daysDiff / (90 * data.frequencyValue));
        totalAppointments = Math.max(1, quarters);
      }
    }

    if (!totalAppointments) {
      throw new BadRequestError('totalAppointments or endDate is required for preview');
    }

    // Generate preview dates
    const previewAppointments = [];
    let currentDate = new Date(data.startDate);
    const [hours, minutes] = data.preferredTime.split(':').map(Number);
    if (hours !== undefined && minutes !== undefined) {
      currentDate.setHours(hours, minutes, 0, 0);
    }

    // Adjust to preferred day of week if specified
    if (data.preferredDayOfWeek !== undefined) {
      const currentDay = currentDate.getDay();
      const daysToAdd = (data.preferredDayOfWeek - currentDay + 7) % 7;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    }

    // Get existing appointments for conflict detection
    const { AppointmentModel } = await import('../models/appointment.model');

    for (let i = 0; i < totalAppointments; i++) {
      // Check if date exceeds endDate (if set)
      if (data.endDate && currentDate > new Date(data.endDate)) {
        break;
      }

      // Calculate endTime
      const endTimeDate = new Date(currentDate);
      endTimeDate.setMinutes(endTimeDate.getMinutes() + durationMinutes);
      const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;
      const startTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;

      // Check for conflicts
      const appointmentDate = new Date(currentDate);
      appointmentDate.setHours(0, 0, 0, 0);
      
      let hasConflict = false;
      let conflictReason = '';
      let conflictingAppointments = [];
      
      try {
        // Check provider working hours
        const dayOfWeek = appointmentDate.getDay();
        const workingHoursArray = Array.isArray(provider.workingHours) ? provider.workingHours : [];
        const workingHours = workingHoursArray.find((wh: any) => wh.dayOfWeek === dayOfWeek);
        
        if (!workingHours || !workingHours.isAvailable) {
          hasConflict = true;
          conflictReason = 'Provider is not available on this date';
        } else {
          // Check if time is within working hours
          const parseTime = (timeStr: string): number => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (hours === undefined || minutes === undefined) return 0;
            return hours * 60 + minutes;
          };
          
          const startMinutes = parseTime(startTime);
          const endMinutes = parseTime(endTime);
          const workStart = parseTime(workingHours.startTime);
          const workEnd = parseTime(workingHours.endTime);
          
          if (startMinutes < workStart || endMinutes > workEnd) {
            hasConflict = true;
            conflictReason = 'Appointment time is outside provider working hours';
          } else {
            // Check for existing appointment conflicts
            const { AppointmentModel } = await import('../models/appointment.model');
            const startOfDay = new Date(appointmentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(appointmentDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            const existingAppointments = await AppointmentModel.find({
              providerId: data.providerId,
              appointmentDate: {
                $gte: startOfDay,
                $lt: endOfDay,
              },
              status: { $nin: ['cancelled', 'no_show'] },
            })
              .populate('appointmentTypeId', 'bufferBefore bufferAfter')
              .populate('patientId', 'firstName lastName')
              .lean();
            
            // Get buffer times from appointment type if provided
            let bufferBefore = 0;
            let bufferAfter = 0;
            if (data.appointmentTypeId) {
              const appointmentType = await AppointmentTypeModel.findById(data.appointmentTypeId).lean();
              if (appointmentType) {
                bufferBefore = Number(appointmentType.bufferBefore) || 0;
                bufferAfter = Number(appointmentType.bufferAfter) || 0;
              }
            }
            
            const newStart = startMinutes - bufferBefore;
            const newEnd = endMinutes + bufferAfter;
            
            // Check for time overlaps
            for (const apt of existingAppointments) {
              const aptType = apt.appointmentTypeId as any;
              const aptBufferBefore = aptType?.bufferBefore || 0;
              const aptBufferAfter = aptType?.bufferAfter || 0;
              const aptStart = parseTime(String(apt.startTime || '')) - aptBufferBefore;
              const aptEnd = parseTime(String(apt.endTime || '')) + aptBufferAfter;
              
              // Check for overlap
              if (!(newEnd <= aptStart || newStart >= aptEnd)) {
                hasConflict = true;
                conflictingAppointments.push({
                  appointmentCode: apt.appointmentCode,
                  patientName: apt.patientId ? `${(apt.patientId as any).firstName} ${(apt.patientId as any).lastName}` : 'Unknown',
                  startTime: apt.startTime,
                  endTime: apt.endTime,
                });
              }
            }
            
            if (hasConflict && conflictingAppointments.length > 0) {
              conflictReason = `Conflicts with existing appointment(s)`;
            }
          }
        }
      } catch (error) {
        hasConflict = true;
        conflictReason = error instanceof Error ? error.message : 'Conflict detected';
      }

      previewAppointments.push({
        appointmentNumber: i + 1,
        date: new Date(currentDate),
        startTime,
        endTime,
        durationMinutes,
        hasConflict,
        conflictReason: hasConflict ? conflictReason : undefined,
        conflictingAppointments: hasConflict && conflictingAppointments.length > 0 ? conflictingAppointments : undefined,
      });

      // Calculate next date
      if (data.frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7 * data.frequencyValue);
      } else if (data.frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + data.frequencyValue);
      } else if (data.frequency === 'quarterly') {
        currentDate.setMonth(currentDate.getMonth() + 3 * data.frequencyValue);
      }

      // Adjust to preferredDayOfWeek if specified
      if (data.preferredDayOfWeek !== undefined) {
        const currentDay = currentDate.getDay();
        const daysToAdd = (data.preferredDayOfWeek - currentDay + 7) % 7;
        currentDate.setDate(currentDate.getDate() + daysToAdd);
      }
    }

    return {
      previewAppointments,
      totalCount: previewAppointments.length,
      conflictCount: previewAppointments.filter(apt => apt.hasConflict).length,
      availableCount: previewAppointments.filter(apt => !apt.hasConflict).length,
    };
  }

  /**
   * Generate appointments from recurring appointment series
   */
  async generateAppointments(
    recurringAppointmentId: string,
    count: number,
    createdBy: string
  ) {
    const recurringAppointment = await RecurringAppointmentModel.findById(recurringAppointmentId);
    if (!recurringAppointment) {
      throw new NotFoundError('Recurring appointment not found');
    }

    if (!recurringAppointment.isActive) {
      throw new BadRequestError('Recurring appointment series is not active');
    }

    const appointmentsToCreate = Math.min(
      count,
      recurringAppointment.totalAppointments
        ? Number(recurringAppointment.totalAppointments) - Number(recurringAppointment.appointmentsCreated)
        : count
    );

    if (appointmentsToCreate <= 0) {
      throw new BadRequestError('No more appointments can be created for this series');
    }

    // According to documentation: "If conflict → skip and log"
    // Generate appointments, skipping conflicts and continuing
    const appointments = [];
    const skippedAppointments = [];
    let currentDate = new Date(recurringAppointment.startDate as any);
    const preferredTimeStr = String(recurringAppointment.preferredTime || '');
    const [hours, minutes] = preferredTimeStr.split(':').map(Number);
    if (hours !== undefined && minutes !== undefined) {
      currentDate.setHours(hours, minutes, 0, 0);
    }

    // Adjust to preferred day of week if specified
    if (recurringAppointment.preferredDayOfWeek !== undefined && recurringAppointment.preferredDayOfWeek !== null) {
      const currentDay = currentDate.getDay();
      const preferredDay = Number(recurringAppointment.preferredDayOfWeek);
      const daysToAdd = (preferredDay - currentDay + 7) % 7;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    }

    // Get appointment type duration
    let durationMinutes = 30; // Default
    if (recurringAppointment.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(
        String(recurringAppointment.appointmentTypeId)
      ).lean();
      if (appointmentType) {
        durationMinutes = Number(appointmentType.defaultDuration) || 30;
      }
    }

    // Generate appointments according to documentation algorithm
    for (let i = 0; i < appointmentsToCreate; i++) {
      // Check if date exceeds endDate (if set) → break
      const endDate = recurringAppointment.endDate ? new Date(recurringAppointment.endDate as any) : null;
      if (endDate && currentDate > endDate) {
        break;
      }

      // Check if totalAppointments limit reached → break
      if (recurringAppointment.totalAppointments && 
          Number(recurringAppointment.appointmentsCreated) + appointments.length >= Number(recurringAppointment.totalAppointments)) {
        break;
      }

      // Calculate endTime (startTime + duration)
      const endTimeDate = new Date(currentDate);
      endTimeDate.setMinutes(endTimeDate.getMinutes() + durationMinutes);
      const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;
      const startTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;

      // Create appointmentDate as date-only (time set to 00:00:00)
      // This matches how regular appointments are stored
      const appointmentDate = new Date(currentDate);
      appointmentDate.setHours(0, 0, 0, 0);

      try {
        // Check for conflicts with existing appointments
        // createAppointment will throw error if conflict exists
        const appointmentPayload: any = {
          patientId: String(recurringAppointment.patientId),
          providerId: String(recurringAppointment.providerId),
          appointmentDate: appointmentDate,
          startTime,
          endTime,
          durationMinutes,
        };
        if (recurringAppointment.appointmentTypeId) {
          appointmentPayload.appointmentTypeId = String(recurringAppointment.appointmentTypeId);
        }
        const appointment = await appointmentService.createAppointment(
          appointmentPayload,
          createdBy
        );

        // Set parent appointment ID for recurring series
        await AppointmentModel.findByIdAndUpdate(
          appointment._id,
          { parentAppointmentId: recurringAppointmentId }
        );

        // If no conflict → create appointment
        appointments.push(appointment);
      } catch (error) {
        // If conflict → skip and log (according to documentation)
        skippedAppointments.push({
          date: new Date(currentDate),
          startTime,
          reason: error instanceof Error ? error.message : 'Unknown conflict',
        });
        // Log the skipped appointment (using 'updated' action since 'skipped' is not a valid action)
        await logActivity(
          createdBy,
          'updated',
          'recurring_appointments',
          recurringAppointmentId,
          undefined,
          {
            skippedDate: currentDate,
            skippedTime: startTime,
            reason: error instanceof Error ? error.message : 'Conflict detected',
          },
          undefined,
          undefined,
          'low'
        );
      }

      // Calculate next date:
      // - Weekly: add (7 * frequencyValue) days
      // - Monthly: add (frequencyValue) months
      // - Quarterly: add (3 * frequencyValue) months
      const frequency = String(recurringAppointment.frequency || '');
      const frequencyValue = Number(recurringAppointment.frequencyValue) || 1;
      if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7 * frequencyValue);
      } else if (frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + frequencyValue);
      } else if (frequency === 'quarterly') {
        currentDate.setMonth(currentDate.getMonth() + 3 * frequencyValue);
      }

      // Adjust to preferredDayOfWeek if specified
      if (recurringAppointment.preferredDayOfWeek !== undefined && recurringAppointment.preferredDayOfWeek !== null) {
        const currentDay = currentDate.getDay();
        const preferredDay = Number(recurringAppointment.preferredDayOfWeek);
        const daysToAdd = (preferredDay - currentDay + 7) % 7;
        currentDate.setDate(currentDate.getDate() + daysToAdd);
      }
    }

    // Update appointmentsCreated count
    (recurringAppointment as any).appointmentsCreated = Number(recurringAppointment.appointmentsCreated) + appointments.length;
    await recurringAppointment.save();

    // Return appointments with skipped count for information
    return {
      appointments,
      skippedCount: skippedAppointments.length,
      skippedAppointments: skippedAppointments.length > 0 ? skippedAppointments : undefined,
    };
  }

  /**
   * Update recurring appointment
   */
  async updateRecurringAppointment(
    recurringAppointmentId: string,
    updates: {
      appointmentTypeId?: string;
      frequency?: 'weekly' | 'monthly' | 'quarterly';
      frequencyValue?: number;
      startDate?: Date;
      endDate?: Date;
      preferredTime?: string;
      preferredDayOfWeek?: number;
      totalAppointments?: number;
      isActive?: boolean;
    },
    updatedBy: string
  ) {
    const recurringAppointment = await RecurringAppointmentModel.findById(recurringAppointmentId);
    if (!recurringAppointment) {
      throw new NotFoundError('Recurring appointment not found');
    }

    // Validate preferred time format if provided
    if (updates.preferredTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    // Validate day of week if provided
    if (updates.preferredDayOfWeek !== undefined && (updates.preferredDayOfWeek < 0 || updates.preferredDayOfWeek > 6)) {
      throw new BadRequestError('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    const oldData = recurringAppointment.toObject();

    // Update fields
    Object.assign(recurringAppointment, updates);

    await recurringAppointment.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'recurring_appointments',
      recurringAppointmentId,
      oldData,
      recurringAppointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return recurringAppointment;
  }

  /**
   * Delete recurring appointment and all associated actual appointments
   */
  async deleteRecurringAppointment(recurringAppointmentId: string, deletedBy: string) {
    const recurringAppointment = await RecurringAppointmentModel.findById(recurringAppointmentId);
    if (!recurringAppointment) {
      throw new NotFoundError('Recurring appointment not found');
    }

    const oldData = recurringAppointment.toObject();

    // Find and delete all associated actual appointments
    const associatedAppointments = await AppointmentModel.find({
      parentAppointmentId: recurringAppointmentId,
    }).lean();

    const deletedAppointmentIds = associatedAppointments.map(apt => apt._id);
    
    if (deletedAppointmentIds.length > 0) {
      await AppointmentModel.deleteMany({
        parentAppointmentId: recurringAppointmentId,
      });

      // Log deletion of associated appointments
      await logActivity(
        deletedBy,
        'deleted',
        'appointments',
        recurringAppointmentId,
        { deletedAppointmentIds, count: deletedAppointmentIds.length },
        undefined,
        undefined,
        undefined,
        'medium'
      );
    }

    // Hard delete recurring appointment
    await RecurringAppointmentModel.deleteOne({ _id: recurringAppointmentId });

    // Log activity
    await logActivity(
      deletedBy,
      'deleted',
      'recurring_appointments',
      recurringAppointmentId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { 
      message: 'Recurring appointment deleted successfully',
      deletedAppointmentsCount: deletedAppointmentIds.length,
    };
  }

  /**
   * Create recurring appointment with conflict resolution
   * Allows user to specify custom dates/times for conflicted slots or skip them
   */
  async createRecurringAppointmentWithResolution(
    data: {
      patientId: string;
      providerId: string;
      appointmentTypeId?: string;
      frequency: 'weekly' | 'monthly' | 'quarterly';
      frequencyValue: number;
      startDate: Date;
      endDate?: Date;
      preferredTime: string;
      preferredDayOfWeek?: number;
      totalAppointments?: number;
      appointmentOverrides?: Array<{
        appointmentNumber: number;
        skip?: boolean;
        customDate?: string;
        customStartTime?: string;
        customEndTime?: string;
      }>;
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
    let durationMinutes = 30;
    if (data.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(data.appointmentTypeId).lean();
      if (!appointmentType || !appointmentType.isActive) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
      durationMinutes = Number(appointmentType.defaultDuration) || 30;
    }

    // Validate preferred time format
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    // Calculate totalAppointments from endDate if not provided
    let totalAppointments = data.totalAppointments;
    if (!totalAppointments && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (data.frequency === 'weekly') {
        totalAppointments = Math.max(1, Math.ceil(daysDiff / (7 * data.frequencyValue)));
      } else if (data.frequency === 'monthly') {
        totalAppointments = Math.max(1, Math.ceil(daysDiff / (30 * data.frequencyValue)));
      } else if (data.frequency === 'quarterly') {
        totalAppointments = Math.max(1, Math.ceil(daysDiff / (90 * data.frequencyValue)));
      }
    }

    // Create recurring appointment record
    const recurringAppointment = await RecurringAppointmentModel.create({
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate,
      endDate: data.endDate,
      preferredTime: data.preferredTime,
      preferredDayOfWeek: data.preferredDayOfWeek,
      totalAppointments: totalAppointments,
      appointmentsCreated: 0,
      isActive: true,
      createdBy,
    });

    // Generate appointments with conflict resolution
    const appointments = [];
    const skippedAppointments = [];
    let currentDate = new Date(data.startDate);
    const [hours, minutes] = data.preferredTime.split(':').map(Number);
    if (hours !== undefined && minutes !== undefined) {
      currentDate.setHours(hours, minutes, 0, 0);
    }

    // Adjust to preferred day of week if specified
    if (data.preferredDayOfWeek !== undefined) {
      const currentDay = currentDate.getDay();
      const daysToAdd = (data.preferredDayOfWeek - currentDay + 7) % 7;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    }

    // Build override map for quick lookup
    const overrideMap = new Map<number, any>();
    if (data.appointmentOverrides && data.appointmentOverrides.length > 0) {
      for (const override of data.appointmentOverrides) {
        overrideMap.set(override.appointmentNumber, override);
      }
    }

    for (let i = 0; i < (totalAppointments || 0); i++) {
      const appointmentNumber = i + 1;
      const override = overrideMap.get(appointmentNumber);

      // Check if this appointment should be skipped
      if (override?.skip) {
        skippedAppointments.push({
          appointmentNumber,
          date: new Date(currentDate),
          reason: 'Skipped by user',
        });
        // Still advance to next date
        this.advanceDate(currentDate, data.frequency, data.frequencyValue, data.preferredDayOfWeek);
        continue;
      }

      // Check if date exceeds endDate
      if (data.endDate && currentDate > new Date(data.endDate)) {
        break;
      }

      // Use custom date/time if provided, otherwise use calculated
      let appointmentDate: Date;
      let startTime: string;
      let endTime: string;

      if (override?.customDate) {
        appointmentDate = new Date(override.customDate);
        appointmentDate.setHours(0, 0, 0, 0);
      } else {
        appointmentDate = new Date(currentDate);
        appointmentDate.setHours(0, 0, 0, 0);
      }

      if (override?.customStartTime) {
        startTime = override.customStartTime;
      } else {
        startTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;
      }

      if (override?.customEndTime) {
        endTime = override.customEndTime;
      } else {
        const endTimeDate = new Date(currentDate);
        endTimeDate.setMinutes(endTimeDate.getMinutes() + durationMinutes);
        endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;
      }

      try {
        const appointmentPayload: any = {
          patientId: data.patientId,
          providerId: data.providerId,
          appointmentDate,
          startTime,
          endTime,
          durationMinutes,
        };
        if (data.appointmentTypeId) {
          appointmentPayload.appointmentTypeId = data.appointmentTypeId;
        }
        const appointment = await appointmentService.createAppointment(
          appointmentPayload,
          createdBy
        );

        // Link to recurring appointment
        await AppointmentModel.findByIdAndUpdate(
          appointment._id,
          { parentAppointmentId: recurringAppointment._id }
        );

        appointments.push(appointment);
      } catch (error) {
        skippedAppointments.push({
          appointmentNumber,
          date: appointmentDate,
          startTime,
          reason: error instanceof Error ? error.message : 'Unknown conflict',
        });
      }

      // Advance to next date
      this.advanceDate(currentDate, data.frequency, data.frequencyValue, data.preferredDayOfWeek);
    }

    // Update appointments created count
    (recurringAppointment as any).appointmentsCreated = appointments.length;
    await recurringAppointment.save();

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'recurring_appointments',
      String(recurringAppointment._id),
      undefined,
      recurringAppointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return {
      recurringAppointment,
      appointmentsCreated: appointments.length,
      skippedCount: skippedAppointments.length,
      skippedAppointments: skippedAppointments.length > 0 ? skippedAppointments : undefined,
      appointments,
    };
  }

  /**
   * Helper to advance date based on frequency
   */
  private advanceDate(
    currentDate: Date,
    frequency: 'weekly' | 'monthly' | 'quarterly',
    frequencyValue: number,
    preferredDayOfWeek?: number
  ) {
    if (frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7 * frequencyValue);
    } else if (frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + frequencyValue);
    } else if (frequency === 'quarterly') {
      currentDate.setMonth(currentDate.getMonth() + 3 * frequencyValue);
    }

    // Adjust to preferred day of week if specified
    if (preferredDayOfWeek !== undefined) {
      const currentDay = currentDate.getDay();
      const daysToAdd = (preferredDayOfWeek - currentDay + 7) % 7;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    }
  }

  /**
   * Get all actual appointments linked to a recurring appointment
   */
  async getLinkedAppointments(recurringAppointmentId: string) {
    const appointments = await AppointmentModel.find({
      parentAppointmentId: recurringAppointmentId,
    })
      .populate('patientId', 'firstName lastName patientCode')
      .populate({
        path: 'providerId',
        select: 'providerCode specialty userId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .populate('appointmentTypeId', 'name defaultDuration')
      .sort({ appointmentDate: 1 })
      .lean();

    return appointments;
  }
}

export const recurringAppointmentService = new RecurringAppointmentService();
