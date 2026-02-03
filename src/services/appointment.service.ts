import { prisma } from '../config/db';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapAppointmentStatusToDb,
  mapAppointmentToApi,
  mapAppointmentStatusFromDb,
  mapProviderToApi,
} from '../utils/opendental-mappers.util';

/**
 * Generate unique appointment code (e.g., APT001, APT002, etc.)
 */
async function generateAppointmentCode(): Promise<string> {
  const nextId = await getNextId('appointment', 'AptNum');
  return `APT${nextId.toString().padStart(3, '0')}`;
}

const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
};

const formatMinutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDurationMinutesFromPattern = (pattern?: string | null): number => {
  if (!pattern) return 30;
  const parsed = Number.parseInt(pattern, 10);
  return Number.isFinite(parsed) ? parsed : 30;
};

const toDateTime = (date: Date, time: string): Date => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr ?? 0);
  const minutes = Number(minutesStr ?? 0);
  const dt = new Date(date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

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
  const dateObj = appointmentDate instanceof Date ? new Date(appointmentDate) : new Date(appointmentDate);
  const startOfDay = getStartOfDay(dateObj);
  const endOfDay = getEndOfDay(dateObj);

  const newStart = parseTimeToMinutes(startTime);
  const newEnd = parseTimeToMinutes(endTime);

  const providerWhere: any = {
    ProvNum: BigInt(providerId),
    AptDateTime: { gte: startOfDay, lt: endOfDay },
    AptStatus: { notIn: [3, 4] },
  };
  if (excludeAppointmentId) {
    providerWhere.AptNum = { not: BigInt(excludeAppointmentId) };
  }

  const providerAppointments = await prisma.appointment.findMany({
    where: providerWhere,
  });

  const conflictingAppointments: any[] = [];

  providerAppointments.forEach((apt) => {
    if (!apt.AptDateTime) return;
    const aptStart = parseTimeToMinutes(formatMinutesToTime(
      apt.AptDateTime.getHours() * 60 + apt.AptDateTime.getMinutes()
    ));
    const duration = getDurationMinutesFromPattern(apt.Pattern);
    const aptEnd = aptStart + duration;
    if (!(newEnd <= aptStart || newStart >= aptEnd)) {
      conflictingAppointments.push({
        apt,
        conflictType: 'provider_time',
      });
    }
  });

  if (roomId) {
    const roomWhere: any = {
      Op: BigInt(roomId),
      AptDateTime: { gte: startOfDay, lt: endOfDay },
      AptStatus: { notIn: [3, 4] },
    };
    if (excludeAppointmentId) {
      roomWhere.AptNum = { not: BigInt(excludeAppointmentId) };
    }

    const roomAppointments = await prisma.appointment.findMany({
      where: roomWhere,
    });

    roomAppointments.forEach((apt) => {
      if (!apt.AptDateTime) return;
      const aptStart = parseTimeToMinutes(formatMinutesToTime(
        apt.AptDateTime.getHours() * 60 + apt.AptDateTime.getMinutes()
      ));
      const duration = getDurationMinutesFromPattern(apt.Pattern);
      const aptEnd = aptStart + duration;
      if (!(newEnd <= aptStart || newStart >= aptEnd)) {
        conflictingAppointments.push({
          apt,
          conflictType: 'room',
        });
      }
    });
  }

  return {
    hasConflict: conflictingAppointments.length > 0,
    conflictingAppointments,
    conflictType: conflictingAppointments.length > 0 ? conflictingAppointments[0].conflictType : undefined,
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
    const where: any = {};

    if (filters?.providerId) {
      where.ProvNum = BigInt(filters.providerId);
    }

    if (filters?.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }

    if (filters?.status) {
      where.AptStatus = mapAppointmentStatusToDb(filters.status);
    }

    if (filters?.appointmentTypeId) {
      where.AppointmentTypeNum = BigInt(filters.appointmentTypeId);
    }

    if (filters?.startDate || filters?.endDate) {
      where.AptDateTime = {};
      if (filters.startDate) {
        where.AptDateTime.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.AptDateTime.lte = new Date(filters.endDate);
      }
    }

    let patientIds: bigint[] = [];
    let providerIds: bigint[] = [];

    if (filters?.search) {
      const searchTerm = filters.search;

      const matchingPatients = await prisma.patient.findMany({
        where: {
          OR: [
            { FName: { contains: searchTerm } },
            { LName: { contains: searchTerm } },
            { ChartNumber: { contains: searchTerm } },
          ],
        },
        select: { PatNum: true },
      });
      patientIds = matchingPatients.map((p) => p.PatNum);

      const matchingProviders = await prisma.provider.findMany({
        where: {
          OR: [
            { FName: { contains: searchTerm } },
            { LName: { contains: searchTerm } },
            { Abbr: { contains: searchTerm } },
          ],
        },
        select: { ProvNum: true },
      });
      providerIds = matchingProviders.map((p) => p.ProvNum);

      where.OR = [
        { ProcDescript: { contains: searchTerm } },
        { Note: { contains: searchTerm } },
        ...(patientIds.length > 0 ? [{ PatNum: { in: patientIds } }] : []),
        ...(providerIds.length > 0 ? [{ ProvNum: { in: providerIds } }] : []),
      ];
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          provider_appointment_ProvNumToprovider: true,
          appointmenttype: true,
          userod: true,
        },
        orderBy: { AptDateTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      appointments: appointments.map((apt) =>
        mapAppointmentToApi(apt, {
          patient: apt.patient,
          provider: apt.provider_appointment_ProvNumToprovider,
          appointmentType: apt.appointmenttype,
          createdBy: apt.userod,
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
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    return mapAppointmentToApi(appointment, {
      patient: appointment.patient,
      provider: appointment.provider_appointment_ProvNumToprovider,
      appointmentType: appointment.appointmenttype,
      createdBy: appointment.userod,
    });
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
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        ProvNum: BigInt(providerId),
        AptDateTime: { gte: startDate, lte: endDate },
        AptStatus: { not: 4 },
      },
      include: {
        patient: true,
        appointmenttype: true,
      },
      orderBy: { AptDateTime: 'asc' },
    });

    return {
      provider: mapProviderToApi(provider),
      appointments: appointments.map((apt) =>
        mapAppointmentToApi(apt, {
          patient: apt.patient,
          appointmentType: apt.appointmenttype,
        })
      ),
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
    const where: any = {
      AptDateTime: { gte: startDate, lte: endDate },
      AptStatus: { not: 4 },
    };

    if (providerIds && providerIds.length > 0) {
      where.ProvNum = { in: providerIds.map((id) => BigInt(id)) };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
      },
      orderBy: { AptDateTime: 'asc' },
    });

    const calendarEvents = appointments.map((apt) => {
      const provider = apt.provider_appointment_ProvNumToprovider as any;
      const patient = apt.patient as any;
      const appointmentType = apt.appointmenttype as any;
      
      // Fix timezone issue: Use local date formatting instead of toISOString()
      // toISOString() converts to UTC which can shift the date by one day
      const appointmentDate = new Date(apt.AptDateTime as Date | string);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Calculate buffer times
      const totalBufferBefore = 0;
      const totalBufferAfter = 0;

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

      const startMinutes = parseTime(formatMinutesToTime(
        appointmentDate.getHours() * 60 + appointmentDate.getMinutes()
      ));
      const durationMinutes = getDurationMinutesFromPattern(apt.Pattern);
      const endMinutes = startMinutes + durationMinutes;
      const bufferedStartMinutes = Math.max(0, startMinutes - totalBufferBefore);
      const bufferedEndMinutes = Math.min(24 * 60 - 1, endMinutes + totalBufferAfter);
      
      return {
        id: apt.AptNum.toString(),
        title: `${patient?.FName || ''} ${patient?.LName || ''} - ${appointmentType?.AppointmentTypeName || 'Appointment'}`,
        start: `${dateStr}T${formatTime(bufferedStartMinutes)}:00`,
        end: `${dateStr}T${formatTime(bufferedEndMinutes)}:00`,
        backgroundColor: appointmentType?.AppointmentTypeColor
          ? String(appointmentType.AppointmentTypeColor)
          : this.getStatusColor(mapAppointmentStatusFromDb(apt.AptStatus)),
        borderColor: appointmentType?.AppointmentTypeColor
          ? String(appointmentType.AppointmentTypeColor)
          : this.getStatusColor(mapAppointmentStatusFromDb(apt.AptStatus)),
        extendedProps: {
          appointmentId: apt.AptNum.toString(),
          patientId: patient?.PatNum?.toString(),
          patientName: `${patient?.FName || ''} ${patient?.LName || ''}`,
          patientCode: patient?.ChartNumber,
          providerId: provider?.ProvNum?.toString(),
          providerName: `${provider?.FName || ''} ${provider?.LName || ''}`,
          providerCode: provider?.Abbr,
          appointmentTypeId: appointmentType?.AppointmentTypeNum?.toString(),
          appointmentTypeName: appointmentType?.AppointmentTypeName,
          status: mapAppointmentStatusFromDb(apt.AptStatus),
          startTime: formatTime(startMinutes),
          endTime: formatTime(endMinutes),
          actualStartTime: formatTime(startMinutes),
          actualEndTime: formatTime(endMinutes),
          durationMinutes,
          bufferBefore: totalBufferBefore,
          bufferAfter: totalBufferAfter,
          chiefComplaint: apt.ProcDescript,
          notes: apt.Note,
          insuranceVerified: Boolean(apt.InsPlan1 || apt.InsPlan2),
        },
      };
    });

    const providers = await prisma.provider.findMany({
      where:
        providerIds && providerIds.length > 0
          ? { ProvNum: { in: providerIds.map((id) => BigInt(id)) }, IsHidden: 0 }
          : { IsHidden: 0 },
    });

    return {
      events: calendarEvents,
      providers: providers.map((p: any) => ({
        id: p.ProvNum.toString(),
        name: `${p.FName || ''} ${p.LName || ''}`,
        code: p.Abbr,
        specialty: p.Specialty,
        workingHours: [],
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
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(providerId) },
    });
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    // Ensure date is a Date object
    const targetDate = date instanceof Date ? new Date(date) : new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // OpenDental doesn't store working hours in provider; use default business hours.
    const workingHours = { startTime: '09:00', endTime: '17:00', isAvailable: true };

    // Get existing appointments for the day
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        ProvNum: BigInt(providerId),
        AptDateTime: { gte: startOfDay, lt: endOfDay },
        AptStatus: { notIn: [3, 4] },
      },
      select: { AptDateTime: true, Pattern: true },
    });

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
    const providerBuffer = 0;
    const slotDuration = durationMinutes;

    const bookedSlots = existingAppointments.map((apt) => {
      const bufferBefore = 0;
      const bufferAfter = 0;
      const startTime = apt.AptDateTime ? formatMinutesToTime(
        apt.AptDateTime.getHours() * 60 + apt.AptDateTime.getMinutes()
      ) : '00:00';
      const duration = getDurationMinutesFromPattern(apt.Pattern);
      const endTime = formatMinutesToTime(parseTimeToMinutes(startTime) + duration);
      return {
        start: parseTime(startTime) - bufferBefore,
        end: parseTime(endTime) + bufferAfter + providerBuffer,
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
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(data.patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Note: Insurance status validation is handled at the UI level
    // The insuranceVerified flag is set by the user during booking
    // Backend accepts the flag value without blocking booking

    // Validate provider exists
    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(data.providerId) },
    });
    if (!provider || provider.IsHidden) {
      throw new NotFoundError('Provider not found or inactive');
    }

    // Validate appointment type if provided
    if (data.appointmentTypeId) {
      const appointmentType = await prisma.appointmenttype.findUnique({
        where: { AppointmentTypeNum: BigInt(data.appointmentTypeId) },
      });
      if (!appointmentType || appointmentType.IsHidden) {
        throw new NotFoundError('Appointment type not found or inactive');
      }

      // Use appointment type duration if not provided
      if (!data.durationMinutes) {
        data.durationMinutes = 30;
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
    await generateAppointmentCode();
    const nextId = await getNextId('appointment', 'AptNum');
    const appointmentDateObj = data.appointmentDate instanceof Date
      ? new Date(data.appointmentDate)
      : new Date(data.appointmentDate);
    const aptDateTime = toDateTime(appointmentDateObj, data.startTime);
    const durationMinutes = data.durationMinutes || 30;

    const appointment = await prisma.appointment.create({
      data: {
        AptNum: nextId,
        PatNum: BigInt(data.patientId),
        ProvNum: BigInt(data.providerId),
        AppointmentTypeNum: data.appointmentTypeId ? BigInt(data.appointmentTypeId) : null,
        AptDateTime: aptDateTime,
        Pattern: String(durationMinutes),
        ProcDescript: data.chiefComplaint ?? null,
        Note: data.notes ?? null,
        Op: data.roomId ? BigInt(data.roomId) : null,
        AptStatus: mapAppointmentStatusToDb('scheduled'),
        DateTimeArrived: null,
        DateTimeDismissed: null,
        SecUserNumEntry: createdBy ? BigInt(createdBy) : null,
        SecDateTEntry: new Date(),
      },
    });

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'appointments',
      String(appointment.AptNum),
      undefined,
      mapAppointmentToApi(appointment),
      undefined,
      undefined,
      'medium'
    );

    return mapAppointmentToApi(appointment);
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
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // If updating date/time, check for conflicts (including buffers and room)
    if (updates.appointmentDate || updates.startTime || updates.endTime) {
      const appointmentDate = updates.appointmentDate || appointment.AptDateTime || new Date();
      const startTime = updates.startTime || (appointment.AptDateTime ? formatMinutesToTime(
        appointment.AptDateTime.getHours() * 60 + appointment.AptDateTime.getMinutes()
      ) : '09:00');
      const endTime =
        updates.endTime ||
        formatMinutesToTime(parseTimeToMinutes(startTime) + getDurationMinutesFromPattern(appointment.Pattern));
      const appointmentTypeId =
        updates.appointmentTypeId || (appointment.AppointmentTypeNum ? appointment.AppointmentTypeNum.toString() : undefined);
      const roomId = updates.roomId !== undefined ? updates.roomId : appointment.Op?.toString();

      const conflictCheck = await checkConflicts(
        appointment.ProvNum?.toString() ?? '',
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
      const appointmentType = await prisma.appointmenttype.findUnique({
        where: { AppointmentTypeNum: BigInt(updates.appointmentTypeId) },
      });
      if (!appointmentType || appointmentType.IsHidden) {
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

    const oldData = mapAppointmentToApi(appointment);
    const aptDateTime =
      updates.appointmentDate || updates.startTime
        ? toDateTime(
            updates.appointmentDate ? new Date(updates.appointmentDate) : (appointment.AptDateTime ?? new Date()),
            updates.startTime ||
              (appointment.AptDateTime
                ? formatMinutesToTime(appointment.AptDateTime.getHours() * 60 + appointment.AptDateTime.getMinutes())
                : '09:00')
          )
        : undefined;
    const durationMinutes =
      updates.durationMinutes !== undefined ? String(updates.durationMinutes) : undefined;

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AppointmentTypeNum:
          updates.appointmentTypeId !== undefined ? BigInt(updates.appointmentTypeId) : undefined,
        AptDateTime: aptDateTime ?? undefined,
        Pattern: durationMinutes,
        ProcDescript: updates.chiefComplaint ?? undefined,
        Note: updates.notes ?? undefined,
        Op: updates.roomId !== undefined ? BigInt(updates.roomId) : undefined,
        AptStatus: updates.status ? mapAppointmentStatusToDb(updates.status) : undefined,
        DateTimeArrived: updates.status === 'checked_in' ? new Date() : undefined,
        DateTimeDismissed: updates.status === 'completed' ? new Date() : undefined,
      },
    });

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapAppointmentToApi(updated),
      undefined,
      undefined,
      'medium'
    );

    return mapAppointmentToApi(updated);
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(appointmentId: string, cancelledBy: string, cancellationReason?: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'cancelled') {
      throw new BadRequestError('Appointment is already cancelled');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'completed') {
      throw new BadRequestError('Cannot cancel a completed appointment');
    }

    const oldData = mapAppointmentToApi(appointment);

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptStatus: mapAppointmentStatusToDb('cancelled'),
        Note: cancellationReason ? `${appointment.Note || ''}\nCancellation: ${cancellationReason}` : appointment.Note,
      },
    });

    // Log activity
    await logActivity(
      cancelledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapAppointmentToApi(updated),
      undefined,
      undefined,
      'medium'
    );

    return mapAppointmentToApi(updated);
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
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'cancelled') {
      throw new BadRequestError('Cannot reschedule a cancelled appointment');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'completed') {
      throw new BadRequestError('Cannot reschedule a completed appointment');
    }

    // Check for conflicts with new time (including buffers and room)
    const conflictCheck = await checkConflicts(
      appointment.ProvNum?.toString() ?? '',
      newDate,
      newStartTime,
      newEndTime,
      appointmentId,
      appointment.AppointmentTypeNum ? appointment.AppointmentTypeNum.toString() : undefined,
      appointment.Op ? appointment.Op.toString() : undefined
    );

    if (conflictCheck.hasConflict) {
      const conflictType = conflictCheck.conflictType === 'room'
        ? 'Room is already booked at this time'
        : 'Rescheduled appointment conflicts with existing appointment';
      throw new ConflictError(conflictType);
    }

    const oldData = mapAppointmentToApi(appointment);
    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptDateTime: toDateTime(newDate, newStartTime),
        Pattern: String(parseTimeToMinutes(newEndTime) - parseTimeToMinutes(newStartTime)),
      },
    });

    // Log activity
    await logActivity(
      rescheduledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapAppointmentToApi(updated),
      undefined,
      undefined,
      'medium'
    );

    return mapAppointmentToApi(updated);
  }

  /**
   * Check-in patient
   */
  async checkInAppointment(appointmentId: string, checkedInBy: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'checked_in') {
      throw new BadRequestError('Patient is already checked in');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'cancelled') {
      throw new BadRequestError('Cannot check in a cancelled appointment');
    }

    if (mapAppointmentStatusFromDb(appointment.AptStatus) === 'completed') {
      throw new BadRequestError('Cannot check in a completed appointment');
    }

    const oldData = mapAppointmentToApi(appointment);

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptStatus: mapAppointmentStatusToDb('checked_in'),
        DateTimeArrived: new Date(),
      },
    });

    // Log activity
    await logActivity(
      checkedInBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapAppointmentToApi(updated),
      undefined,
      undefined,
      'low'
    );

    return mapAppointmentToApi(updated);
  }

  /**
   * Delete appointment (hard delete)
   */
  async deleteAppointment(appointmentId: string, deletedBy: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const oldData = mapAppointmentToApi(appointment);

    // Hard delete - remove from database
    await prisma.appointment.delete({
      where: { AptNum: BigInt(appointmentId) },
    });

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
