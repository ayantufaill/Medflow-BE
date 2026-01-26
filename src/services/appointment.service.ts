import { AppointmentModel } from '../models/appointment.model';
import { ProviderModel } from '../models/provider.model';
import { AppointmentTypeModel } from '../models/appointment-type.model';
import { PatientModel } from '../models/patient.model';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

/**
 * Generate unique appointment code (e.g., APT001, APT002, etc.)
 */
async function generateAppointmentCode(): Promise<string> {
  const lastAppointment = await AppointmentModel.findOne()
    .sort({ appointmentCode: -1 })
    .select('appointmentCode')
    .lean();

  if (!lastAppointment || !lastAppointment.appointmentCode) {
    return 'APT001';
  }

  const appointmentCodeStr = String(lastAppointment.appointmentCode || '');
  const match = appointmentCodeStr.match(/\d+$/);
  if (!match) {
    return 'APT001';
  }

  const lastNumber = parseInt(match[0], 10);
  const nextNumber = lastNumber + 1;

  return `APT${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Check for appointment conflicts
 * Includes buffer times from appointment types and room conflicts
 */
async function checkConflicts(
  providerId: string,
  appointmentDate: Date | string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string,
  appointmentTypeId?: string,
  roomId?: string
): Promise<{ hasConflict: boolean; conflictingAppointments: any[]; conflictType?: string }> {
  // Ensure appointmentDate is a Date object
  const dateObj = appointmentDate instanceof Date
    ? new Date(appointmentDate)
    : new Date(appointmentDate);

  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  // Get provider buffer time
  const provider = await ProviderModel.findById(providerId).lean();
  const providerBufferValue = provider?.appointmentBufferMinutes as any;
  const providerBuffer = Number(providerBufferValue) || 0;

  // Get buffer times from appointment type if provided
  let bufferBefore: number = 0;
  let bufferAfter: number = 0;
  if (appointmentTypeId) {
    const appointmentType = await AppointmentTypeModel.findById(appointmentTypeId).lean();
    if (appointmentType) {
      const bufferBeforeValue = appointmentType.bufferBefore as any;
      const bufferAfterValue = appointmentType.bufferAfter as any;
      bufferBefore = Number(bufferBeforeValue) || 0;
      bufferAfter = Number(bufferAfterValue) || 0;
    }
  }

  // Parse time strings (format: "HH:MM")
  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    return hours * 60 + minutes; // Convert to minutes since midnight
  };

  const newStart = parseTime(startTime) - bufferBefore; // Apply buffer before
  const bufferAfterNum = Number(bufferAfter) || 0;
  const providerBufferNum = Number(providerBuffer) || 0;
  const newEnd = parseTime(endTime) + bufferAfterNum + providerBufferNum; // Apply buffer after + provider buffer

  // Check provider conflicts
  const providerQuery: any = {
    providerId,
    appointmentDate: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
    status: { $nin: ['cancelled', 'no_show'] },
  };

  if (excludeAppointmentId) {
    providerQuery._id = { $ne: excludeAppointmentId };
  }

  const appointments = await AppointmentModel.find(providerQuery)
    .populate('appointmentTypeId', 'bufferBefore bufferAfter')
    .populate('providerId', 'appointmentBufferMinutes')
    .lean();

  const conflictingAppointments: any[] = [];

  // Check for provider time conflicts (with buffers)
  appointments.forEach((apt) => {
    const aptType = apt.appointmentTypeId as any;
    const aptProvider = apt.providerId as any;
    const aptBufferBefore = aptType?.bufferBefore || 0;
    const aptBufferAfter = aptType?.bufferAfter || 0;
    const aptProviderBuffer = aptProvider?.appointmentBufferMinutes || 0;
    const aptStart = parseTime(String(apt.startTime)) - aptBufferBefore;
    const aptEnd = parseTime(String(apt.endTime)) + aptBufferAfter + aptProviderBuffer;

    // Check for overlap (including buffers)
    if (!(newEnd <= aptStart || newStart >= aptEnd)) {
      conflictingAppointments.push({
        ...apt,
        conflictType: 'provider_time',
      });
    }
  });

  // Check for room conflicts if roomId is provided
  if (roomId) {
    const roomQuery: any = {
      roomId,
      appointmentDate: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
      status: { $nin: ['cancelled', 'no_show'] },
    };

    if (excludeAppointmentId) {
      roomQuery._id = { $ne: excludeAppointmentId };
    }

    const roomAppointments = await AppointmentModel.find(roomQuery)
      .populate('appointmentTypeId', 'bufferBefore bufferAfter')
      .populate('providerId', 'appointmentBufferMinutes')
      .lean();

    roomAppointments.forEach((apt) => {
      // Skip if already in conflictingAppointments (same appointment)
      if (conflictingAppointments.some(c => c._id.toString() === apt._id.toString())) {
        return;
      }

      const aptType = apt.appointmentTypeId as any;
      const aptProvider = apt.providerId as any;
      const aptBufferBefore = aptType?.bufferBefore || 0;
      const aptBufferAfter = aptType?.bufferAfter || 0;
      const aptProviderBuffer = aptProvider?.appointmentBufferMinutes || 0;
      const aptStart = parseTime(String(apt.startTime)) - aptBufferBefore;
      const aptEnd = parseTime(String(apt.endTime)) + aptBufferAfter + aptProviderBuffer;

      // Check for overlap (including buffers)
      if (!(newEnd <= aptStart || newStart >= aptEnd)) {
        conflictingAppointments.push({
          ...apt,
          conflictType: 'room',
        });
      }
    });
  }

  return {
    hasConflict: conflictingAppointments.length > 0,
    conflictingAppointments,
    conflictType: conflictingAppointments.length > 0
      ? conflictingAppointments[0].conflictType
      : undefined,
  };
}

export class AppointmentService {
  /**
   * Get all appointments with pagination and filters
   */
  async getAllAppointments(
    page = 1,
    limit = 10,
    filters?: {
      providerId?: string;
      patientId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      appointmentTypeId?: string;
      search?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.providerId) {
      query.providerId = filters.providerId;
    }

    if (filters?.patientId) {
      query.patientId = filters.patientId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.appointmentTypeId) {
      query.appointmentTypeId = filters.appointmentTypeId;
    }

    if (filters?.startDate || filters?.endDate) {
      query.appointmentDate = {};
      if (filters.startDate) {
        query.appointmentDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.appointmentDate.$lte = new Date(filters.endDate);
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

      const { UserModel } = await import('../models/user.model');
      const matchingUsers = await UserModel.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      }).select('_id').lean();
      const userIds = matchingUsers.map((u) => u._id.toString());

      const matchingProviders = await ProviderModel.find({
        $or: [
          { providerCode: searchRegex },
          { userId: { $in: userIds } },
        ],
      }).select('_id').lean();
      providerIds = matchingProviders.map((p) => p._id.toString());

      query.$or = [
        { appointmentCode: searchRegex },
        { chiefComplaint: searchRegex },
        ...(patientIds.length > 0 ? [{ patientId: { $in: patientIds } }] : []),
        ...(providerIds.length > 0 ? [{ providerId: { $in: providerIds } }] : []),
      ];
    }

    const [appointments, total] = await Promise.all([
      AppointmentModel.find(query)
        .populate('patientId', 'firstName lastName patientCode email phonePrimary')
        .populate({
          path: 'providerId',
          select: 'providerCode specialty title userId',
          populate: {
            path: 'userId',
            select: 'firstName lastName email',
          },
        })
        .populate('appointmentTypeId', 'name defaultDuration colorCode defaultPrice')
        .populate('createdBy', 'firstName lastName email')
        .sort({ appointmentDate: 1, startTime: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AppointmentModel.countDocuments(query),
    ]);

    return {
      appointments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId: string) {
    const appointment = await AppointmentModel.findById(appointmentId)
      .populate('patientId')
      .populate('providerId')
      .populate('appointmentTypeId')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    return appointment;
  }

  /**
   * Get provider schedule (day/week/month view)
   */
  async getProviderSchedule(
    providerId: string,
    startDate: Date,
    endDate: Date,
    view: 'day' | 'week' | 'month' = 'week'
  ) {
    const provider = await ProviderModel.findById(providerId).lean();
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const appointments = await AppointmentModel.find({
      providerId,
      appointmentDate: {
        $gte: startDate,
        $lte: endDate,
      },
      status: { $nin: ['cancelled'] },
    })
      .populate('patientId', 'firstName lastName patientCode')
      .populate('appointmentTypeId', 'name defaultDuration colorCode defaultPrice')
      .sort({ appointmentDate: 1, startTime: 1 })
      .lean();

    return {
      provider,
      appointments,
      view,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get calendar schedule for multiple providers
   * Returns appointments formatted for calendar display
   */
  async getCalendarSchedule(
    startDate: Date,
    endDate: Date,
    providerIds?: string[]
  ) {
    const query: any = {
      appointmentDate: {
        $gte: startDate,
        $lte: endDate,
      },
      status: { $nin: ['cancelled'] },
    };

    if (providerIds && providerIds.length > 0) {
      query.providerId = { $in: providerIds };
    }

    const appointments = await AppointmentModel.find(query)
      .populate('patientId', 'firstName lastName patientCode')
      .populate({
        path: 'providerId',
        select: 'providerCode specialty userId appointmentBufferMinutes',
        populate: {
          path: 'userId',
          select: 'firstName lastName',
        },
      })
      .populate('appointmentTypeId', 'name defaultDuration colorCode bufferBefore bufferAfter defaultPrice')
      .sort({ appointmentDate: 1, startTime: 1 })
      .lean();

    const calendarEvents = appointments.map((apt) => {
      const provider = apt.providerId as any;
      const patient = apt.patientId as any;
      const appointmentType = apt.appointmentTypeId as any;
      
      // Fix timezone issue: Use local date formatting instead of toISOString()
      // toISOString() converts to UTC which can shift the date by one day
      const appointmentDate = new Date(apt.appointmentDate as Date | string);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Calculate buffer times
      const providerBuffer = provider?.appointmentBufferMinutes || 0;
      const typeBufferBefore = appointmentType?.bufferBefore || 0;
      const typeBufferAfter = appointmentType?.bufferAfter || 0;
      const totalBufferBefore = typeBufferBefore;
      const totalBufferAfter = typeBufferAfter + providerBuffer;

      // Apply buffer to start and end times
      const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':').map(Number);
        const hours = parts[0] ?? 0;
        const minutes = parts[1] ?? 0;
        return hours * 60 + minutes;
      };
      const formatTime = (totalMinutes: number): string => {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      };

      const startMinutes = parseTime(String(apt.startTime));
      const endMinutes = parseTime(String(apt.endTime));
      const bufferedStartMinutes = Math.max(0, startMinutes - totalBufferBefore);
      const bufferedEndMinutes = Math.min(24 * 60 - 1, endMinutes + totalBufferAfter);
      
      return {
        id: apt._id.toString(),
        title: `${patient?.firstName || ''} ${patient?.lastName || ''} - ${appointmentType?.name || 'Appointment'}`,
        start: `${dateStr}T${formatTime(bufferedStartMinutes)}:00`,
        end: `${dateStr}T${formatTime(bufferedEndMinutes)}:00`,
        backgroundColor: appointmentType?.colorCode || this.getStatusColor(String(apt.status)),
        borderColor: appointmentType?.colorCode || this.getStatusColor(String(apt.status)),
        extendedProps: {
          appointmentId: apt._id.toString(),
          patientId: patient?._id?.toString(),
          patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`,
          patientCode: patient?.patientCode,
          providerId: provider?._id?.toString(),
          providerName: `${provider?.userId?.firstName || ''} ${provider?.userId?.lastName || ''}`,
          providerCode: provider?.providerCode,
          appointmentTypeId: appointmentType?._id?.toString(),
          appointmentTypeName: appointmentType?.name,
          status: apt.status,
          startTime: apt.startTime,
          endTime: apt.endTime,
          actualStartTime: apt.startTime,
          actualEndTime: apt.endTime,
          durationMinutes: apt.durationMinutes,
          bufferBefore: totalBufferBefore,
          bufferAfter: totalBufferAfter,
          chiefComplaint: apt.chiefComplaint,
          notes: apt.notes,
          insuranceVerified: apt.insuranceVerified,
        },
      };
    });

    const providers = await ProviderModel.find(
      providerIds && providerIds.length > 0 ? { _id: { $in: providerIds }, isActive: true } : { isActive: true }
    )
      .populate('userId', 'firstName lastName')
      .select('providerCode specialty userId workingHours')
      .lean();

    return {
      events: calendarEvents,
      providers: providers.map((p: any) => ({
        id: p._id.toString(),
        name: `${p.userId?.firstName || ''} ${p.userId?.lastName || ''}`,
        code: p.providerCode,
        specialty: p.specialty,
        workingHours: p.workingHours,
      })),
      dateRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      scheduled: '#1976d2',
      confirmed: '#2196f3',
      checked_in: '#ff9800',
      in_progress: '#9c27b0',
      completed: '#4caf50',
      cancelled: '#f44336',
      no_show: '#757575',
    };
    return colors[status] || '#1976d2';
  }

  /**
   * Get available time slots for a provider on a given date
   */
  async getAvailableSlots(providerId: string, date: Date | string, durationMinutes = 30) {
    const provider = await ProviderModel.findById(providerId).lean();
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    // Ensure date is a Date object
    const targetDate = date instanceof Date ? new Date(date) : new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get provider working hours for the day
    const dayOfWeek = targetDate.getDay();
    const workingHoursArray = (provider.workingHours as any) || [];
    const workingHours = Array.isArray(workingHoursArray) ? workingHoursArray.find((wh: any) => wh.dayOfWeek === dayOfWeek) : undefined;

    if (!workingHours || !workingHours.isAvailable) {
      return { availableSlots: [] };
    }

    // Get existing appointments for the day
    const existingAppointments = await AppointmentModel.find({
      providerId,
      appointmentDate: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
      status: { $nin: ['cancelled', 'no_show'] },
    })
      .select('startTime endTime appointmentTypeId')
      .populate('appointmentTypeId', 'bufferBefore bufferAfter')
      .lean();

    // Generate available slots
    const parseTime = (timeStr: string): number => {
      const parts = timeStr.split(':').map(Number);
      const hours = parts[0] ?? 0;
      const minutes = parts[1] ?? 0;
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const startMinutes = parseTime(workingHours.startTime);
    const endMinutes = parseTime(workingHours.endTime);
    const providerBuffer = provider.appointmentBufferMinutes || 0;
    const slotDuration = durationMinutes;

    const bookedSlots = existingAppointments.map((apt) => {
      const aptType = apt.appointmentTypeId as any;
      const bufferBefore = aptType?.bufferBefore || 0;
      const bufferAfter = aptType?.bufferAfter || 0;
      return {
        start: parseTime(String(apt.startTime)) - bufferBefore,
        end: parseTime(String(apt.endTime)) + bufferAfter + providerBuffer,
      };
    });

    const availableSlots: string[] = [];
    let currentTime = startMinutes;

    while (currentTime + slotDuration <= endMinutes) {
      const slotStart = currentTime;
      const slotEnd = slotStart + slotDuration;

      // Check if slot conflicts with existing appointments (which already include buffers)
      const hasConflict = bookedSlots.some(
        (booked) => !(slotEnd <= booked.start || slotStart >= booked.end)
      );

      if (!hasConflict) {
        availableSlots.push(formatTime(slotStart));
      }

      currentTime += slotDuration;
    }

    return { availableSlots };
  }

  /**
   * Create new appointment
   */
  async createAppointment(data: {
    patientId: string;
    providerId: string;
    appointmentTypeId?: string;
    appointmentDate: Date;
    startTime: string;
    endTime: string;
    durationMinutes?: number;
    chiefComplaint?: string;
    notes?: string;
    roomId?: string;
    requiresInterpreter?: boolean;
    interpreterLanguage?: string;
    insuranceVerified?: boolean;
    copayCollected?: number;
    reminderSent?: boolean;
    customFields?: Record<string, any>;
  }, createdBy: string) {
    // Validate patient exists
    const patient = await PatientModel.findById(data.patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Note: Insurance status validation is handled at the UI level
    // The insuranceVerified flag is set by the user during booking
    // Backend accepts the flag value without blocking booking

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

      // Use appointment type duration if not provided
      if (!data.durationMinutes) {
        data.durationMinutes = (appointmentType.defaultDuration as number) || 30;
      }
    }

    // Validate provider working hours
    const appointmentDateObj = data.appointmentDate instanceof Date
      ? new Date(data.appointmentDate)
      : new Date(data.appointmentDate);
    const dayOfWeek = appointmentDateObj.getDay();
    const workingHoursArray = (provider.workingHours as any) || [];
    const workingHours = Array.isArray(workingHoursArray) ? workingHoursArray.find((wh: any) => wh.dayOfWeek === dayOfWeek) : undefined;

    if (!workingHours || !workingHours.isAvailable) {
      throw new BadRequestError('Provider is not available on this date');
    }

    // Check if appointment time is within working hours
    const parseTime = (timeStr: string): number => {
      const parts = timeStr.split(':').map(Number);
      const hours = parts[0] ?? 0;
      const minutes = parts[1] ?? 0;
      return hours * 60 + minutes;
    };

    const startMinutes = parseTime(data.startTime);
    const endMinutes = parseTime(data.endTime);
    const workStart = parseTime(workingHours.startTime);
    const workEnd = parseTime(workingHours.endTime);

    if (startMinutes < workStart || endMinutes > workEnd) {
      throw new BadRequestError('Appointment time is outside provider working hours');
    }

    // Check daily max appointments limit
    if (provider.maxDailyAppointments) {
      const startOfDay = new Date(appointmentDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(appointmentDateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const dailyAppointmentCount = await AppointmentModel.countDocuments({
        providerId: data.providerId,
        appointmentDate: {
          $gte: startOfDay,
          $lt: endOfDay,
        },
        status: { $nin: ['cancelled', 'no_show'] },
      });

      if (dailyAppointmentCount >= (provider.maxDailyAppointments as number || 999)) {
        throw new BadRequestError(
          `Provider has reached the maximum daily appointments limit (${provider.maxDailyAppointments}). Please select a different date or provider.`
        );
      }
    }

    // Check for conflicts (including buffers and room)
    const conflictCheck = await checkConflicts(
      data.providerId,
      data.appointmentDate,
      data.startTime,
      data.endTime,
      undefined,
      data.appointmentTypeId,
      data.roomId
    );

    if (conflictCheck.hasConflict) {
      const conflictType = conflictCheck.conflictType === 'room'
        ? 'Room is already booked'
        : 'Appointment conflicts with existing appointment';
      throw new ConflictError(conflictType);
    }

    // Generate appointment code
    const appointmentCode = await generateAppointmentCode();

    // Create appointment
    const appointment = await AppointmentModel.create({
      appointmentCode,
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      appointmentDate: data.appointmentDate,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes: data.durationMinutes || 30,
      chiefComplaint: data.chiefComplaint,
      notes: data.notes,
      roomId: data.roomId,
      requiresInterpreter: data.requiresInterpreter || false,
      interpreterLanguage: data.interpreterLanguage,
      insuranceVerified: data.insuranceVerified || false,
      copayCollected: data.copayCollected,
      reminderSent: data.reminderSent || false,
      customFields: data.customFields || {},
      status: 'scheduled',
      createdBy,
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'appointments',
      String(appointment._id),
      undefined,
      appointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return appointment;
  }

  /**
   * Update appointment
   */
  async updateAppointment(
    appointmentId: string,
    updates: {
      appointmentTypeId?: string;
      appointmentDate?: Date;
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      status?: string;
      chiefComplaint?: string;
      notes?: string;
      roomId?: string;
      requiresInterpreter?: boolean;
      interpreterLanguage?: string;
      insuranceVerified?: boolean;
      copayCollected?: number;
      reminderSent?: boolean;
      cancellationReason?: string;
      customFields?: Record<string, any>;
    },
    updatedBy: string
  ) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // If updating date/time, check for conflicts (including buffers and room)
    if (updates.appointmentDate || updates.startTime || updates.endTime) {
      const appointmentDate = updates.appointmentDate || appointment.appointmentDate;
      const startTime = updates.startTime || appointment.startTime;
      const endTime = updates.endTime || appointment.endTime;
      const appointmentTypeId = updates.appointmentTypeId || appointment.appointmentTypeId;
      const roomId = updates.roomId !== undefined ? updates.roomId : appointment.roomId;

      // Validate provider working hours if date is changing
      if (updates.appointmentDate) {
        const provider = await ProviderModel.findById(appointment.providerId).lean();
        if (provider) {
          const appointmentDateObj = appointmentDate instanceof Date
            ? appointmentDate
            : new Date(String(appointmentDate));
          const dayOfWeek = appointmentDateObj.getDay();
          const workingHoursArray = (provider.workingHours as any) || [];
          const workingHours = Array.isArray(workingHoursArray) ? workingHoursArray.find((wh: any) => wh.dayOfWeek === dayOfWeek) : undefined;

          if (!workingHours || !workingHours.isAvailable) {
            throw new BadRequestError('Provider is not available on this date');
          }

          // Check if appointment time is within working hours
          const parseTime = (timeStr: string): number => {
            const parts = timeStr.split(':').map(Number);
            const hours = parts[0] ?? 0;
            const minutes = parts[1] ?? 0;
            return hours * 60 + minutes;
          };

          const startMinutes = parseTime(String(startTime));
          const endMinutes = parseTime(String(endTime));
          const workStart = parseTime(String(workingHours.startTime));
          const workEnd = parseTime(String(workingHours.endTime));

          if (startMinutes < workStart || endMinutes > workEnd) {
            throw new BadRequestError('Appointment time is outside provider working hours');
          }
        }
      }

      const conflictCheck = await checkConflicts(
        String(appointment.providerId),
        appointmentDate instanceof Date ? appointmentDate : new Date(String(appointmentDate)),
        String(startTime),
        String(endTime),
        appointmentId,
        appointmentTypeId ? String(appointmentTypeId) : undefined,
        roomId ? String(roomId) : undefined
      );

      if (conflictCheck.hasConflict) {
        const conflictType = conflictCheck.conflictType === 'room'
          ? 'Room is already booked at this time'
          : 'Updated appointment conflicts with existing appointment';
        throw new ConflictError(conflictType);
      }
    }

    // Validate appointment type if updating
    if (updates.appointmentTypeId) {
      const appointmentType = await AppointmentTypeModel.findById(updates.appointmentTypeId).lean();
      if (!appointmentType || !appointmentType.isActive) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
    }

    // Handle status changes
    if (updates.status) {
      if (updates.status === 'checked_in') {
        (updates as any).checkInAt = new Date();
      } else if (updates.status === 'completed') {
        (updates as any).completedAt = new Date();
      }
    }

    const oldData = appointment.toObject();

    // Update fields
    Object.assign(appointment, updates);

    await appointment.save();

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      appointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return appointment;
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(appointmentId: string, cancelledBy: string, cancellationReason?: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (String(appointment.status) === 'cancelled') {
      throw new BadRequestError('Appointment is already cancelled');
    }

    if (String(appointment.status) === 'completed') {
      throw new BadRequestError('Cannot cancel a completed appointment');
    }

    const oldData = appointment.toObject();

    (appointment as any).status = 'cancelled';
    if (cancellationReason) {
      (appointment as any).cancellationReason = cancellationReason;
    }

    await appointment.save();

    // Auto-promote waitlist entries for this provider according to documentation
    // Workflow 4: Appointment Cancellation → Fill from Waitlist
    // Check waitlist for matching preferences:
    // - Same provider
    // - Preferred date matches or is flexible
    // - Priority: urgent first
    const { WaitlistEntryModel } = await import('../models/waitlist-entry.model');
    
    // Find active waitlist entries for the same provider
    const allWaitlistEntries = await WaitlistEntryModel.find({
      providerId: appointment.providerId,
      status: 'active',
    })
      .sort({ priority: 1, createdAt: 1 }) // Urgent first, then by creation date
      .lean();

    // Filter by matching preferences according to documentation
    // 1. Same provider (already filtered)
    // 2. Preferred date matches or is flexible
    // 3. Priority: urgent first (already sorted)
    const cancelledDate = new Date(appointment.appointmentDate as Date | string);
    cancelledDate.setHours(0, 0, 0, 0);
    
    const matchingEntries = allWaitlistEntries.filter((entry) => {
      // If entry has preferred date, it should match the cancelled appointment date
      if (entry.preferredDate) {
        const preferredDate = new Date(entry.preferredDate as Date | string);
        preferredDate.setHours(0, 0, 0, 0);
        return preferredDate.getTime() === cancelledDate.getTime();
      }
      // If no preferred date or priority is flexible, it matches
      return !entry.preferredDate || String(entry.priority) === 'flexible';
    });

    // Promote the first matching waitlist entry if found
    if (matchingEntries.length > 0 && matchingEntries[0]?._id) {
      const waitlistEntry = await WaitlistEntryModel.findById(String(matchingEntries[0]._id));
      if (waitlistEntry) {
        (waitlistEntry as any).status = 'called';
        await waitlistEntry.save();

        // Log waitlist promotion
        await logActivity(
          cancelledBy,
          'updated',
          'waitlist',
          String(waitlistEntry._id),
          { status: 'active' },
          { status: 'called', reason: 'Auto-promoted due to appointment cancellation - matching preferences found' },
          undefined,
          undefined,
          'low'
        );
      }
    }

    // Log activity
    await logActivity(
      cancelledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      appointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return appointment;
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    newDate: Date,
    newStartTime: string,
    newEndTime: string,
    rescheduledBy: string
  ) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (String(appointment.status) === 'cancelled') {
      throw new BadRequestError('Cannot reschedule a cancelled appointment');
    }

    if (String(appointment.status) === 'completed') {
      throw new BadRequestError('Cannot reschedule a completed appointment');
    }

    // Validate provider working hours for new date
    const provider = await ProviderModel.findById(appointment.providerId).lean();
    if (!provider || !provider.isActive) {
      throw new NotFoundError('Provider not found or inactive');
    }

    const appointmentDateObj = newDate instanceof Date ? newDate : new Date(newDate);
    const dayOfWeek = appointmentDateObj.getDay();
    const workingHoursArray = (provider.workingHours as any) || [];
    const workingHours = Array.isArray(workingHoursArray) ? workingHoursArray.find((wh: any) => wh.dayOfWeek === dayOfWeek) : undefined;

    if (!workingHours || !workingHours.isAvailable) {
      throw new BadRequestError('Provider is not available on this date');
    }

    // Check if appointment time is within working hours
    const parseTime = (timeStr: string): number => {
      const parts = timeStr.split(':').map(Number);
      const hours = parts[0] ?? 0;
      const minutes = parts[1] ?? 0;
      return hours * 60 + minutes;
    };

    const startMinutes = parseTime(newStartTime);
    const endMinutes = parseTime(newEndTime);
    const workStart = parseTime(workingHours.startTime);
    const workEnd = parseTime(workingHours.endTime);

    if (startMinutes < workStart || endMinutes > workEnd) {
      throw new BadRequestError('Appointment time is outside provider working hours');
    }

    // Check for conflicts with new time (including buffers and room)
    const conflictCheck = await checkConflicts(
      String(appointment.providerId),
      newDate,
      newStartTime,
      newEndTime,
      appointmentId,
      String(appointment.appointmentTypeId || ''),
      appointment.roomId ? String(appointment.roomId) : undefined
    );

    if (conflictCheck.hasConflict) {
      const conflictType = conflictCheck.conflictType === 'room'
        ? 'Room is already booked at this time'
        : 'Rescheduled appointment conflicts with existing appointment';
      throw new ConflictError(conflictType);
    }

    const oldData = appointment.toObject();

    // Update appointment with new date/time
    const appointmentDoc = await AppointmentModel.findById(appointmentId);
    if (!appointmentDoc) {
      throw new NotFoundError('Appointment not found');
    }

    (appointmentDoc as any).appointmentDate = newDate;
    (appointmentDoc as any).startTime = newStartTime;
    (appointmentDoc as any).endTime = newEndTime;

    await appointmentDoc.save();

    // Log activity
    await logActivity(
      rescheduledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      appointment.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return appointment;
  }

  /**
   * Check-in patient
   */
  async checkInAppointment(appointmentId: string, checkedInBy: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (String(appointment.status) === 'checked_in') {
      throw new BadRequestError('Patient is already checked in');
    }

    if (String(appointment.status) === 'cancelled') {
      throw new BadRequestError('Cannot check in a cancelled appointment');
    }

    if (String(appointment.status) === 'completed') {
      throw new BadRequestError('Cannot check in a completed appointment');
    }

    const oldData = appointment.toObject();

    (appointment as any).status = 'checked_in';
    (appointment as any).checkInAt = new Date();

    await appointment.save();

    // Log activity
    await logActivity(
      checkedInBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      appointment.toObject(),
      undefined,
      undefined,
      'low'
    );

    return appointment;
  }

  /**
   * Delete appointment (hard delete)
   */
  async deleteAppointment(appointmentId: string, deletedBy: string) {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const oldData = appointment.toObject();

    // Hard delete - remove from database
    await AppointmentModel.deleteOne({ _id: appointmentId });

    // Log activity
    await logActivity(
      deletedBy,
      'deleted',
      'appointments',
      appointmentId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Appointment deleted successfully' };
  }
}

export const appointmentService = new AppointmentService();
