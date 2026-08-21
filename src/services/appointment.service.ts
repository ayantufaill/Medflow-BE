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
import {
  getAppointmentMeta,
  getAppointmentsMeta,
  getProviderMeta,
  mapUser,
  setAppointmentMeta,
} from '../utils/opendental-auth.util';
import { patientWorkspaceService } from './patient-workspace.service';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { practiceInfoService } from './practice-info.service';
import { staffNotificationService } from './staffNotification.service';

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
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
};

const normalizeText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
  roomId?: string,
  patientId?: string
): Promise<{ hasConflict: boolean; conflictingAppointments: any[]; conflictType?: string }> {
  const dateObj = appointmentDate instanceof Date ? new Date(appointmentDate) : new Date(appointmentDate);
  const startOfDay = getStartOfDay(dateObj);
  const endOfDay = getEndOfDay(dateObj);

  const newStart = parseTimeToMinutes(startTime);
  const newEnd = parseTimeToMinutes(endTime);

  const providerWhere: any = {
    ProvNum: BigInt(providerId),
    AptDateTime: { gte: startOfDay, lt: endOfDay },
    AptStatus: { notIn: [3, 4, 6] },
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
      AptStatus: { notIn: [3, 4, 6] },
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

    const year = startOfDay.getFullYear();
    const month = String(startOfDay.getMonth() + 1).padStart(2, '0');
    const day = String(startOfDay.getDate()).padStart(2, '0');
    const schedDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

    const blockouts = await prisma.schedule.findMany({
      where: {
        SchedDate: schedDate,
        SchedType: 2, // Blockout
        scheduleop: {
          some: { OperatoryNum: BigInt(roomId) }
        }
      }
    });

    // Check each blockout for time overlap
    blockouts.forEach((block) => {
      if (!block.StartTime || !block.StopTime) return;
      // The block times are stored as UTC times on 1970-01-01
      const blockStart = block.StartTime.getUTCHours() * 60 + block.StartTime.getUTCMinutes();
      const blockEnd = block.StopTime.getUTCHours() * 60 + block.StopTime.getUTCMinutes();
      
      if (!(newEnd <= blockStart || newStart >= blockEnd)) {
        conflictingAppointments.push({
          apt: block,
          conflictType: 'blockout',
        });
      }
    });
  }

  if (patientId) {
    const patientWhere: any = {
      PatNum: BigInt(patientId),
      AptDateTime: { gte: startOfDay, lt: endOfDay },
      AptStatus: { notIn: [3, 4, 6] },
    };
    if (excludeAppointmentId) {
      patientWhere.AptNum = { not: BigInt(excludeAppointmentId) };
    }

    const patientAppointments = await prisma.appointment.findMany({
      where: patientWhere,
    });

    patientAppointments.forEach((apt) => {
      if (!apt.AptDateTime) return;
      const aptStart = parseTimeToMinutes(formatMinutesToTime(
        apt.AptDateTime.getHours() * 60 + apt.AptDateTime.getMinutes()
      ));
      const duration = getDurationMinutesFromPattern(apt.Pattern);
      const aptEnd = aptStart + duration;
      if (!(newEnd <= aptStart || newStart >= aptEnd)) {
        conflictingAppointments.push({
          apt,
          conflictType: 'patient',
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
  private mapProcedure(proc: any) {
    return {
      _id: proc.ProcNum.toString(),
      appointmentId: proc.AptNum?.toString() ?? null,
      patientId: proc.PatNum?.toString() ?? null,
      codeNum: proc.CodeNum?.toString() ?? null,
      code: proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? null,
      description:
        proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ??
        proc.BillingNote ??
        'Procedure',
      tooth: proc.ToothNum ?? null,
      surface: proc.Surf ?? null,
      status: proc.ProcStatus ?? null,
      completed: proc.ProcStatus === 2,
      quantity: proc.UnitQty ?? 1,
      fee: proc.ProcFee ?? 0,
      providerId: proc.ProvNum?.toString() ?? null,
      providerName: proc.provider_procedurelog_ProvNumToprovider 
        ? `${proc.provider_procedurelog_ProvNumToprovider.FName || ''} ${proc.provider_procedurelog_ProvNumToprovider.LName || ''}`.trim() 
        : null,
      createdAt: proc.SecDateEntry ?? null,
    };
  }

  private mapLabOrder(labCase: any) {
    return {
      _id: labCase.LabCaseNum.toString(),
      appointmentId: labCase.AptNum?.toString() ?? null,
      patientId: labCase.PatNum?.toString() ?? null,
      laboratoryId: labCase.LaboratoryNum?.toString() ?? null,
      providerId: labCase.ProvNum?.toString() ?? null,
      dueDate: labCase.DateTimeDue ?? null,
      createdAt: labCase.DateTimeCreated ?? null,
      sentAt: labCase.DateTimeSent ?? null,
      receivedAt: labCase.DateTimeRecd ?? null,
      checkedAt: labCase.DateTimeChecked ?? null,
      instructions: labCase.Instructions ?? null,
      labFee: labCase.LabFee ?? 0,
      invoiceNumber: labCase.InvoiceNum ?? null,
    };
  }

  private async resolveAppointmentTypeId(appointmentTypeId?: string): Promise<string> {
    if (appointmentTypeId) {
      const appointmentType = await prisma.appointmenttype.findUnique({
        where: { AppointmentTypeNum: BigInt(appointmentTypeId) },
      });
      if (!appointmentType || appointmentType.IsHidden) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
      return appointmentTypeId;
    }

    const defaultAppointmentType = await prisma.appointmenttype.findFirst({
      where: { IsHidden: 0 },
      orderBy: [{ AppointmentTypeName: 'asc' }, { AppointmentTypeNum: 'asc' }],
      select: { AppointmentTypeNum: true },
    });

    if (!defaultAppointmentType) {
      throw new NotFoundError(
        'No active appointment type found. Please create an active appointment type first'
      );
    }

    return defaultAppointmentType.AppointmentTypeNum.toString();
  }

  async mapAppointmentsBulk(appointments: any[]) {
    if (!appointments.length) return [];

    const { getAppointmentsMeta, getProvidersMeta } = await import('../utils/opendental-auth.util');
    const aptNums = appointments.map(a => a.AptNum);
    const aptMetaMap = await getAppointmentsMeta(aptNums);

    const provNums = Array.from(new Set(appointments.map(a => a.ProvNum).filter(id => id != null)));
    const provMetaMap = provNums.length ? await getProvidersMeta(provNums) : {};

    const customIds = Array.from(new Set(appointments.map(a => a.provider_appointment_ProvNumToprovider?.CustomID).filter(id => id != null)));
    const customUsers = customIds.length ? await prisma.userod.findMany({ where: { UserNum: { in: customIds.map(id => BigInt(id)) } } }) : [];
    
    const { getUsersMeta } = await import('../utils/opendental-auth.util');
    const usersMetaMap = customUsers.length ? await getUsersMeta(customUsers.map(u => u.UserNum)) : {};
    
    const mappedUsersMap = new Map();
    for (const u of customUsers) {
      mappedUsersMap.set(u.UserNum.toString(), await mapUser(u, usersMetaMap[u.UserNum.toString()]));
    }

    return Promise.all(
      appointments.map(apt => this.mapAppointmentWithMeta(apt, {
        patient: apt.patient,
        provider: apt.provider_appointment_ProvNumToprovider,
        appointmentType: apt.appointmenttype,
        createdBy: apt.userod,
        preloadedAptMeta: aptMetaMap[apt.AptNum.toString()] ?? {},
        preloadedProviderMeta: provMetaMap[apt.ProvNum?.toString()] ?? {},
        preloadedLinkedUser: apt.provider_appointment_ProvNumToprovider?.CustomID ? mappedUsersMap.get(apt.provider_appointment_ProvNumToprovider.CustomID) : null,
      }))
    );
  }

  private async mapAppointmentWithMeta(
    appointment: any,
    options?: {
      patient?: any;
      provider?: any;
      appointmentType?: any;
      createdBy?: any;
      preloadedAptMeta?: any;
      preloadedProviderMeta?: any;
      preloadedLinkedUser?: any;
    }
  ) {
    const meta = options?.preloadedAptMeta ?? await getAppointmentMeta(appointment.AptNum);
    const dbStatus = mapAppointmentStatusFromDb(appointment.AptStatus);
    const resolvedStatus =
      dbStatus === 'completed' || dbStatus === 'cancelled' || dbStatus === 'no_show'
        ? dbStatus
        : (meta.status ?? dbStatus);
    const mapped: any = mapAppointmentToApi(appointment, {
      ...options,
      requiresInterpreter: meta.requiresInterpreter ?? false,
      insuranceVerified: meta.insuranceVerified ?? Boolean(appointment.InsPlan1 || appointment.InsPlan2),
      copayCollected: meta.copayCollected ?? 0,
      reminderSent: meta.reminderSent ?? false,
      customFields: meta.customFields ?? {},
      cancellationReason: meta.cancellationReason ?? null,
      checkInAt: meta.checkInAt ? new Date(meta.checkInAt) : appointment.DateTimeArrived ?? null,
      completedAt: meta.completedAt ? new Date(meta.completedAt) : appointment.DateTimeDismissed ?? null,
    });
    mapped.status = resolvedStatus;
    mapped.referralSource = meta.referralSource ?? null;
    mapped.reminderPreferences = meta.reminderPreferences ?? {
      dontSendReminders: false,
    };
    mapped.tags = meta.tags ?? [];
    mapped.participants = meta.participants ?? [];
    mapped.workspaceNotes = meta.workspaceNotes ?? [];
    mapped.systemEvents = meta.systemEvents ?? [];
    mapped.checklists = meta.checklists ?? { preAppt: {}, checkIn: {}, checkOut: {} };

    if (options?.provider) {
      const providerMeta = options.preloadedProviderMeta ?? await getProviderMeta(options.provider.ProvNum);
      let linkedUser: {
        _id: string;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      } | null = null;

      if (options.preloadedLinkedUser) {
        linkedUser = {
          _id: options.preloadedLinkedUser._id,
          firstName: options.preloadedLinkedUser.firstName,
          lastName: options.preloadedLinkedUser.lastName,
          email: options.preloadedLinkedUser.email || null,
        };
      } else if (options.provider.CustomID) {
        const user = await prisma.userod.findUnique({
          where: { UserNum: BigInt(options.provider.CustomID) },
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

      mapped.providerId = mapProviderToApi(options.provider, {
        userId: options.provider.CustomID ?? null,
        user: linkedUser,
        appointmentBufferMinutes: providerMeta.appointmentBufferMinutes ?? 0,
        workingHours: providerMeta.workingHours ?? [],
        maxDailyAppointments: providerMeta.maxDailyAppointments ?? null,
        consultationFee: providerMeta.consultationFee ?? null,
        isAcceptingNewPatients: providerMeta.isAcceptingNewPatients ?? true,
        telehealthEnabled: providerMeta.telehealthEnabled ?? false,
      });
    }

    return mapped;
  }

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
      branchId?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.branchId) {
      where.ClinicNum = BigInt(filters.branchId);
    }

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
        where.AptDateTime.gte = getStartOfDay(new Date(filters.startDate));
      }
      if (filters.endDate) {
        where.AptDateTime.lte = getEndOfDay(new Date(filters.endDate));
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

    const mappedAppointments = await this.mapAppointmentsBulk(appointments);

    const filteredAppointments = filters?.status
      ? mappedAppointments.filter((apt) => apt.status === filters.status)
      : mappedAppointments;

    return {
      appointments: filteredAppointments,
      pagination: {
        page,
        limit,
        total: filters?.status ? filteredAppointments.length : total,
        pages: filters?.status
          ? Math.max(1, Math.ceil(filteredAppointments.length / limit))
          : Math.ceil(total / limit),
      },
    };
  }

  /**
 * Get appointments for a specific patient sorted by date desc with limit
 */
async getPatientAppointments(patientId: string, limit = 10) {
  const patient = await prisma.patient.findUnique({
    where: { PatNum: BigInt(patientId) },
  });
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  const appointments = await prisma.appointment.findMany({
    where: { PatNum: BigInt(patientId) },
    include: {
      patient: true,
      provider_appointment_ProvNumToprovider: true,
      appointmenttype: true,
      userod: true,
    },
    orderBy: { AptDateTime: 'desc' },
    take: limit,
  });

  const mappedAppointments = await this.mapAppointmentsBulk(appointments);

  return {
    appointments: mappedAppointments.map((apt) => ({
      _id: apt._id,
      date: apt.appointmentDate,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      roomId: apt.roomId,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
      appointmentType: apt.appointmentTypeId
        ? {
            _id: apt.appointmentTypeId?._id ?? null,
            name: apt.appointmentTypeId?.name ?? null,
          }
        : null,
      provider: apt.providerId
        ? {
            _id: apt.providerId?._id ?? null,
            name: `${apt.providerId?.firstName ?? ''} ${apt.providerId?.lastName ?? ''}`.trim(),
          }
        : null,
      chiefComplaint: apt.chiefComplaint ?? null,
      notes: apt.notes ?? null,
      customFields: apt.customFields ?? {},
      tags: apt.tags ?? [],
      procedures: apt.procedures ?? [],
      visitType: apt.visitType ?? null,
      systemEvents: apt.systemEvents ?? [],
    })),
    total: mappedAppointments.length,
    limit,
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

    return this.mapAppointmentWithMeta(appointment, {
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
        AptStatus: { notIn: [4, 6] },
      },
      include: {
        patient: true,
        appointmenttype: true,
      },
      orderBy: { AptDateTime: 'asc' },
    });

    return {
      provider: mapProviderToApi(provider),
      appointments: await this.mapAppointmentsBulk(appointments),
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
      AptStatus: { notIn: [4, 6] },
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
        AptStatus: { notIn: [3, 4, 6] },
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
    insuranceVerified?: boolean;
    copayCollected?: number;
    reminderSent?: boolean;
    customFields?: Record<string, any>;
    status?: string;
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

    const resolvedAppointmentTypeId = await this.resolveAppointmentTypeId(data.appointmentTypeId);

    if (!data.durationMinutes) {
      data.durationMinutes = 30;
    }

    // Check for conflicts (including buffers, room, and patient double-booking)
    const conflictCheck = await checkConflicts(
      data.providerId,
      data.appointmentDate,
      data.startTime,
      data.endTime,
      undefined,
      resolvedAppointmentTypeId,
      data.roomId,
      data.patientId
    );

    if (conflictCheck.hasConflict) {
      const conflictType = conflictCheck.conflictType === 'blockout'
        ? 'Appointment conflicts with a blocked slot in this room'
        : conflictCheck.conflictType === 'room'
        ? 'Room is already booked'
        : conflictCheck.conflictType === 'patient'
        ? 'Patient already has an appointment booked for this time slot'
        : 'Provider already has an appointment booked for this time slot';
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

    let opId: bigint;
    if (data.roomId) {
      opId = BigInt(data.roomId);
    } else {
      const defaultOp = await prisma.operatory.findFirst({
        where: { IsHidden: 0 },
        orderBy: { ItemOrder: 'asc' },
      });
      opId = defaultOp?.OperatoryNum ?? BigInt(1);
    }

    const appointment = await prisma.appointment.create({
      data: {
        AptNum: nextId,
        PatNum: BigInt(data.patientId),
        ProvNum: BigInt(data.providerId),
        AppointmentTypeNum: BigInt(resolvedAppointmentTypeId),
        AptDateTime: aptDateTime,
        Pattern: String(durationMinutes),
        ProcDescript: data.chiefComplaint ?? null,
        Note: data.notes ?? null,
        Op: opId,
        AptStatus: mapAppointmentStatusToDb(data.status ?? 'scheduled'),
        DateTimeArrived: null,
        DateTimeDismissed: null,
        SecUserNumEntry: createdBy ? BigInt(createdBy) : null,
        SecDateTEntry: new Date(),
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });

    await setAppointmentMeta(appointment.AptNum, {
      status: data.status ?? 'scheduled',
      requiresInterpreter: data.requiresInterpreter ?? false,
      insuranceVerified: data.insuranceVerified ?? false,
      copayCollected: data.copayCollected ?? 0,
      reminderSent: data.reminderSent ?? false,
      customFields: data.customFields ?? {},
      reminderPreferences: { dontSendReminders: false },
      tags: [],
      participants: [],
      workspaceNotes: [],
      systemEvents: [],
      referralSource: null,
      cancellationReason: null,
      checkInAt: null,
      completedAt: null,
      checklists: (data as any).checklists ?? { preAppt: {}, checkIn: {}, checkOut: {} },
    });

    const mapped = await this.mapAppointmentWithMeta(appointment, {
      patient: appointment.patient,
      provider: appointment.provider_appointment_ProvNumToprovider,
      appointmentType: appointment.appointmenttype,
      createdBy: appointment.userod,
    });

    if (data.customFields?.procedures && Array.isArray(data.customFields.procedures)) {
      for (const proc of data.customFields.procedures) {
        try {
          const fee = proc.charge ? parseFloat(proc.charge.toString().replace(/[^0-9.-]+/g, "")) : 0;
          await this.addAppointmentProcedure(
            appointment.AptNum.toString(),
            {
              code: proc.code,
              description: proc.treatment || proc.name || '',
              fee: isNaN(fee) ? 0 : fee,
              providerId: proc.provider || data.providerId,
              tooth: proc.site || '',
              status: proc.completed ? '2' : (proc.status !== undefined && proc.status !== null ? String(proc.status) : '1'),
            },
            createdBy
          );
        } catch (error) {
          console.error(`Failed to add procedure ${proc.code} to appointment ${appointment.AptNum}:`, error);
        }
      }
    }

    // Log activity
    await logActivity(
      createdBy,
      'created',
      'appointments',
      String(appointment.AptNum),
      undefined,
      mapped,
      undefined,
      undefined,
      'medium'
    );

    await this.notifyStaffAppointmentBooked(String(appointment.AptNum));

    return mapped;
  }

  /**
   * Update appointment
   */
  async updateAppointment(
    appointmentId: string,
    updates: {
      appointmentTypeId?: string;
      providerId?: string;
      appointmentDate?: Date;
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      status?: string;
      chiefComplaint?: string;
      notes?: string;
      roomId?: string;
      requiresInterpreter?: boolean;
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

    const targetStatus = updates.status !== undefined ? updates.status : mapAppointmentStatusFromDb(appointment.AptStatus);
    const isInactiveStatus = targetStatus === 'no_show' || targetStatus === 'cancelled' || targetStatus === 'pending';

    // If updating date/time or provider, check for conflicts (including buffers and room)
    if (!isInactiveStatus && (updates.appointmentDate || updates.startTime || updates.endTime || updates.providerId)) {
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
      const providerId = updates.providerId || appointment.ProvNum?.toString() || '';

      const conflictCheck = await checkConflicts(
        providerId,
        appointmentDate instanceof Date ? appointmentDate : new Date(String(appointmentDate)),
        String(startTime),
        String(endTime),
        appointmentId,
        appointmentTypeId ? String(appointmentTypeId) : undefined,
        roomId ? String(roomId) : undefined,
        appointment.PatNum?.toString()
      );

      if (conflictCheck.hasConflict) {
        const conflictType = conflictCheck.conflictType === 'blockout'
          ? 'Appointment conflicts with a blocked slot in this room'
          : conflictCheck.conflictType === 'room'
          ? 'Room is already booked at this time'
          : conflictCheck.conflictType === 'patient'
          ? 'Patient already has an appointment booked for this time slot'
          : 'Updated appointment conflicts with existing appointment';
        throw new ConflictError(conflictType);
      }
    }

    // Validate provider if updating
    if (updates.providerId) {
      const provider = await prisma.provider.findUnique({
        where: { ProvNum: BigInt(updates.providerId) },
      });
      if (!provider || provider.IsHidden) {
        throw new NotFoundError('Provider not found or inactive');
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

    const oldData = await this.mapAppointmentWithMeta(appointment);
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

    let opId: bigint | null | undefined = undefined;
    if (updates.roomId !== undefined) {
      if (updates.roomId) {
        opId = BigInt(updates.roomId);
      } else {
        const defaultOp = await prisma.operatory.findFirst({
          where: { IsHidden: 0 },
          orderBy: { ItemOrder: 'asc' },
        });
        opId = defaultOp?.OperatoryNum ?? BigInt(1);
      }
    } else if (isInactiveStatus) {
      opId = null;
    }

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AppointmentTypeNum:
          updates.appointmentTypeId !== undefined ? BigInt(updates.appointmentTypeId) : undefined,
        ProvNum:
          updates.providerId !== undefined ? BigInt(updates.providerId) : undefined,
        AptDateTime: aptDateTime ?? undefined,
        Pattern: durationMinutes,
        ProcDescript: updates.chiefComplaint ?? undefined,
        Note: updates.notes ?? undefined,
        Op: opId,
        AptStatus: updates.status ? mapAppointmentStatusToDb(updates.status) : undefined,
        DateTimeArrived: updates.status === 'checked_in' ? new Date() : undefined,
        DateTimeDismissed: updates.status === 'completed' ? new Date() : undefined,
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });

    const existingMeta = await getAppointmentMeta(appointment.AptNum);
    const dbStatus = mapAppointmentStatusFromDb(appointment.AptStatus);
    const currentStatus =
      dbStatus === 'completed' || dbStatus === 'cancelled' || dbStatus === 'no_show'
        ? dbStatus
        : (existingMeta.status ?? dbStatus);

    const hasStatusChanged = updates.status !== undefined && updates.status !== currentStatus;
    const nextSystemEvents = [...(existingMeta.systemEvents ?? [])];
    if (hasStatusChanged) {
      nextSystemEvents.push({
        id: `event-${Date.now()}`,
        type: 'status_changed',
        message: `Status changed to ${updates.status}`,
        createdAt: new Date().toISOString(),
        createdBy: updatedBy,
      });
    }

    const nextMeta = {
      status: updates.status ?? existingMeta.status ?? mapAppointmentStatusFromDb(updated.AptStatus),
      requiresInterpreter: updates.requiresInterpreter ?? existingMeta.requiresInterpreter ?? false,
      insuranceVerified: updates.insuranceVerified ?? existingMeta.insuranceVerified ?? Boolean(updated.InsPlan1 || updated.InsPlan2),
      copayCollected: updates.copayCollected ?? existingMeta.copayCollected ?? 0,
      reminderSent: updates.reminderSent ?? existingMeta.reminderSent ?? false,
      customFields: updates.customFields ?? existingMeta.customFields ?? {},
      cancellationReason:
        updates.status === 'completed'
          ? null
          : updates.cancellationReason ?? existingMeta.cancellationReason ?? null,
      reminderPreferences: existingMeta.reminderPreferences ?? { dontSendReminders: false },
      tags: existingMeta.tags ?? [],
      participants: existingMeta.participants ?? [],
      workspaceNotes: existingMeta.workspaceNotes ?? [],
      systemEvents: nextSystemEvents,
      referralSource: existingMeta.referralSource ?? null,
      checkInAt:
        updates.status === 'checked_in'
          ? new Date().toISOString()
          : existingMeta.checkInAt ?? (updated.DateTimeArrived ? updated.DateTimeArrived.toISOString() : null),
      completedAt:
        updates.status === 'completed'
          ? new Date().toISOString()
          : existingMeta.completedAt ?? (updated.DateTimeDismissed ? updated.DateTimeDismissed.toISOString() : null),
      checklists: (updates as any).checklists ?? existingMeta.checklists ?? { preAppt: {}, checkIn: {}, checkOut: {} },
    };
    await setAppointmentMeta(updated.AptNum, nextMeta);

    const mapped = await this.mapAppointmentWithMeta(updated, {
      patient: updated.patient,
      provider: updated.provider_appointment_ProvNumToprovider,
      appointmentType: updated.appointmenttype,
      createdBy: updated.userod,
    });

    if (updates.customFields?.procedures && Array.isArray(updates.customFields.procedures)) {
      // For simplicity in MVP, we delete and recreate procedures for the appointment
      await prisma.procedurelog.deleteMany({
        where: { AptNum: BigInt(appointmentId) }
      });
      for (const proc of updates.customFields.procedures) {
        try {
          const fee = proc.charge ? parseFloat(proc.charge.toString().replace(/[^0-9.-]+/g, "")) : 0;
          await this.addAppointmentProcedure(
            appointmentId,
            {
              code: proc.code,
              description: proc.treatment || proc.name || '',
              fee: isNaN(fee) ? 0 : fee,
              providerId: proc.provider || updates.providerId || appointment.ProvNum?.toString(),
              tooth: proc.site || '',
              status: proc.completed ? '2' : (proc.status !== undefined && proc.status !== null ? String(proc.status) : '1'),
            },
            updatedBy
          );
        } catch (error) {
          console.error(`Failed to sync procedure ${proc.code} for appointment ${appointmentId}:`, error);
        }
      }
    }

    // Log activity
    await logActivity(
      updatedBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapped,
      undefined,
      undefined,
      'medium'
    );

    return mapped;
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

    const oldData = await this.mapAppointmentWithMeta(appointment);

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptStatus: mapAppointmentStatusToDb('cancelled'),
        Note: cancellationReason ? `${appointment.Note || ''}\nCancellation: ${cancellationReason}` : appointment.Note,
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });
    const existingMeta = await getAppointmentMeta(updated.AptNum);
    const newEvent = {
      id: `event-${Date.now()}`,
      type: 'status_changed',
      message: 'Status changed to cancelled',
      createdAt: new Date().toISOString(),
      createdBy: cancelledBy,
    };
    await setAppointmentMeta(updated.AptNum, {
      ...existingMeta,
      status: 'cancelled',
      cancellationReason: cancellationReason ?? existingMeta.cancellationReason ?? null,
      systemEvents: [...(existingMeta.systemEvents ?? []), newEvent],
    });

    const mapped = await this.mapAppointmentWithMeta(updated, {
      patient: updated.patient,
      provider: updated.provider_appointment_ProvNumToprovider,
      appointmentType: updated.appointmenttype,
      createdBy: updated.userod,
    });

    // Log activity
    await logActivity(
      cancelledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapped,
      undefined,
      undefined,
      'medium'
    );

    await this.notifyAppointmentCancelled(appointmentId, cancellationReason);
    await this.notifyStaffAppointmentCancelled(appointmentId);

    if (updated.ProvNum && updated.AptDateTime) {
      // Dynamic import: waitlist.service.ts already imports appointmentService
      // (for convertToAppointment), so a static import here would be circular.
      const { waitlistService } = await import('./waitlist.service');
      await waitlistService.matchAndNotifyForCancellation({
        appointmentId,
        providerId: updated.ProvNum.toString(),
        appointmentTypeId: updated.AppointmentTypeNum?.toString() ?? null,
        appointmentDateTime: updated.AptDateTime,
        providerName: updated.provider_appointment_ProvNumToprovider
          ? [updated.provider_appointment_ProvNumToprovider.FName, updated.provider_appointment_ProvNumToprovider.LName]
              .filter(Boolean)
              .join(' ')
          : undefined,
      });
    }

    return mapped;
  }

  /**
   * Sends a cancellation email to the patient. Failures are logged, not thrown,
   * so a notification hiccup never blocks the cancellation itself.
   */
  private async notifyAppointmentCancelled(appointmentId: string, cancellationReason?: string) {
    try {
      const { patient, appointmentDateTime, providerName, appointmentType, operatoryName, confirmationCode, clinic } =
        await this.buildNotificationContext(appointmentId);
      if (!patient.Email) return;
      await emailService.sendAppointmentCancellation({
        email: patient.Email,
        firstName: patient.FName ?? undefined,
        appointmentDateTime,
        providerName,
        appointmentType,
        operatoryName,
        confirmationCode,
        cancellationReason,
        clinic,
      });
    } catch (error) {
      console.error(`Failed to send cancellation email for appointment ${appointmentId}:`, error);
    }
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

    // Check for conflicts with new time (including buffers, room, and patient double-booking)
    const conflictCheck = await checkConflicts(
      appointment.ProvNum?.toString() ?? '',
      newDate,
      newStartTime,
      newEndTime,
      appointmentId,
      appointment.AppointmentTypeNum ? appointment.AppointmentTypeNum.toString() : undefined,
      appointment.Op ? appointment.Op.toString() : undefined,
      appointment.PatNum?.toString()
    );

    if (conflictCheck.hasConflict) {
      const conflictType = conflictCheck.conflictType === 'blockout'
        ? 'Appointment conflicts with a blocked slot in this room'
        : conflictCheck.conflictType === 'room'
        ? 'Room is already booked at this time'
        : conflictCheck.conflictType === 'patient'
        ? 'Patient already has an appointment booked for this time slot'
        : 'Rescheduled appointment conflicts with existing appointment';
      throw new ConflictError(conflictType);
    }

    const oldData = await this.mapAppointmentWithMeta(appointment);
    const previousAppointmentDateTime = this.formatAppointmentDateTime(appointment.AptDateTime);
    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptDateTime: toDateTime(newDate, newStartTime),
        Pattern: String(parseTimeToMinutes(newEndTime) - parseTimeToMinutes(newStartTime)),
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });

    const mapped = await this.mapAppointmentWithMeta(updated, {
      patient: updated.patient,
      provider: updated.provider_appointment_ProvNumToprovider,
      appointmentType: updated.appointmenttype,
      createdBy: updated.userod,
    });

    // Log activity
    await logActivity(
      rescheduledBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapped,
      undefined,
      undefined,
      'medium'
    );

    await this.notifyAppointmentRescheduled(appointmentId, previousAppointmentDateTime);
    await this.notifyStaffAppointmentRescheduled(appointmentId, previousAppointmentDateTime);

    return mapped;
  }

  /** Sends a reschedule email to the patient. Failures are logged, not thrown. */
  private async notifyAppointmentRescheduled(appointmentId: string, previousAppointmentDateTime: string) {
    try {
      const { patient, appointmentDateTime, providerName, appointmentType, operatoryName, confirmationCode, clinic } =
        await this.buildNotificationContext(appointmentId);
      if (!patient.Email) return;
      await emailService.sendAppointmentReschedule({
        email: patient.Email,
        firstName: patient.FName ?? undefined,
        appointmentDateTime,
        previousAppointmentDateTime,
        providerName,
        appointmentType,
        operatoryName,
        confirmationCode,
        clinic,
      });
    } catch (error) {
      console.error(`Failed to send reschedule email for appointment ${appointmentId}:`, error);
    }
  }

  /**
   * Notifies the staff logins linked to the appointment's assigned provider (in-app + real-time).
   * Failures are logged, not thrown, so a notification hiccup never blocks the appointment mutation.
   */
  private async notifyStaffForAppointment(
    appointmentId: string,
    type: 'appointment_booked' | 'appointment_cancelled' | 'appointment_rescheduled' | 'appointment_checked_in',
    title: string,
    buildBody: (ctx: Awaited<ReturnType<AppointmentService['buildNotificationContext']>>) => string
  ) {
    try {
      const ctx = await this.buildNotificationContext(appointmentId);
      const provNum = ctx.appointment.ProvNum;
      if (!provNum) return;

      // Two ways a staff login ends up "assigned" to this provider:
      // 1. userod.ProvNum set directly (used by seed scripts / direct admin setup)
      // 2. provider.CustomID = userod.UserNum — the link actually written by the
      //    app's "Create Provider" screen (src/pages/providers/CreateProviderPage.jsx)
      const [directMatches, providerRecord] = await Promise.all([
        prisma.userod.findMany({ where: { ProvNum: provNum, NOT: { IsHidden: 1 } } }),
        prisma.provider.findUnique({ where: { ProvNum: provNum } }),
      ]);

      const recipients = [...directMatches];
      if (providerRecord?.CustomID && /^\d+$/.test(providerRecord.CustomID)) {
        const linkedUserNum = BigInt(providerRecord.CustomID);
        if (!recipients.some((u) => u.UserNum === linkedUserNum)) {
          const linkedUser = await prisma.userod.findUnique({
            where: { UserNum: linkedUserNum },
          });
          if (linkedUser && linkedUser.IsHidden !== 1) {
            recipients.push(linkedUser);
          }
        }
      }

      for (const staff of recipients) {
        await staffNotificationService.createAndEmit({
          userNum: staff.UserNum,
          type,
          title,
          body: buildBody(ctx),
          relatedType: 'appointment',
          relatedId: ctx.appointment.AptNum,
        });
      }
    } catch (error) {
      console.error(`Failed to notify staff (${type}) for appointment ${appointmentId}:`, error);
    }
  }

  private async notifyStaffAppointmentBooked(appointmentId: string) {
    await this.notifyStaffForAppointment(
      appointmentId,
      'appointment_booked',
      'New appointment booked',
      (ctx) => `${ctx.patient.FName ?? 'A patient'} — ${ctx.appointmentDateTime}`
    );
  }

  private async notifyStaffAppointmentCancelled(appointmentId: string) {
    await this.notifyStaffForAppointment(
      appointmentId,
      'appointment_cancelled',
      'Appointment cancelled',
      (ctx) => `${ctx.patient.FName ?? 'A patient'} — ${ctx.appointmentDateTime}`
    );
  }

  private async notifyStaffAppointmentRescheduled(appointmentId: string, previousAppointmentDateTime: string) {
    await this.notifyStaffForAppointment(
      appointmentId,
      'appointment_rescheduled',
      'Appointment rescheduled',
      (ctx) => `${ctx.patient.FName ?? 'A patient'} — now ${ctx.appointmentDateTime} (was ${previousAppointmentDateTime})`
    );
  }

  private async notifyStaffAppointmentCheckedIn(appointmentId: string) {
    await this.notifyStaffForAppointment(
      appointmentId,
      'appointment_checked_in',
      'Patient checked in',
      (ctx) => `${ctx.patient.FName ?? 'A patient'} has arrived — ${ctx.appointmentDateTime}`
    );
  }

  /**
   * Sends reminder emails for appointments happening within the next 24 hours
   * that haven't been reminded yet. Meant to be called periodically (cron) -
   * safe to call repeatedly since each appointment is only reminded once
   * (tracked via the reminderSent meta flag) and skips patients who opted out
   * (reminderPreferences.dontSendReminders).
   */
  async sendDueReminders(): Promise<{ checked: number; sent: number; skipped: number }> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: now, lte: windowEnd },
        AptStatus: { notIn: [4, 6] }, // exclude cancelled, pending
      },
      select: { AptNum: true },
    });

    const metaByAppointment = await getAppointmentsMeta(upcoming.map((a) => a.AptNum));

    let sent = 0;
    let skipped = 0;

    for (const { AptNum } of upcoming) {
      const appointmentId = AptNum.toString();
      const meta = metaByAppointment[appointmentId] ?? {};
      if (meta.reminderSent || meta.reminderPreferences?.dontSendReminders) {
        skipped++;
        continue;
      }

      try {
        const { patient, appointmentDateTime, providerName, appointmentType, operatoryName, confirmationCode, clinic } =
          await this.buildNotificationContext(appointmentId);
        if (!patient.Email) {
          skipped++;
          continue;
        }

        await emailService.sendAppointmentReminder({
          email: patient.Email,
          firstName: patient.FName ?? undefined,
          appointmentDateTime,
          providerName,
          appointmentType,
          operatoryName,
          confirmationCode,
          clinic,
        });

        await setAppointmentMeta(AptNum, { ...meta, reminderSent: true });
        sent++;
      } catch (error) {
        console.error(`Failed to send reminder for appointment ${appointmentId}:`, error);
        skipped++;
      }
    }

    return { checked: upcoming.length, sent, skipped };
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

    const oldData = await this.mapAppointmentWithMeta(appointment);

    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptStatus: mapAppointmentStatusToDb('checked_in'),
        DateTimeArrived: new Date(),
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
    });
    const existingMeta = await getAppointmentMeta(updated.AptNum);
    const newEvent = {
      id: `event-${Date.now()}`,
      type: 'status_changed',
      message: 'Status changed to checked_in',
      createdAt: new Date().toISOString(),
      createdBy: checkedInBy,
    };
    await setAppointmentMeta(updated.AptNum, {
      ...existingMeta,
      status: 'checked_in',
      checkInAt: updated.DateTimeArrived ? updated.DateTimeArrived.toISOString() : existingMeta.checkInAt ?? null,
      systemEvents: [...(existingMeta.systemEvents ?? []), newEvent],
    });

    const mapped = await this.mapAppointmentWithMeta(updated, {
      patient: updated.patient,
      provider: updated.provider_appointment_ProvNumToprovider,
      appointmentType: updated.appointmenttype,
      createdBy: updated.userod,
    });

    // Log activity
    await logActivity(
      checkedInBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      mapped,
      undefined,
      undefined,
      'low'
    );

    await this.notifyStaffAppointmentCheckedIn(appointmentId);

    return mapped;
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

    const oldData = await this.mapAppointmentWithMeta(appointment);

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

  async getAppointmentWorkspace(appointmentId: string) {
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

    const [meta, procedures, labOrders] = await Promise.all([
      getAppointmentMeta(appointment.AptNum),
      prisma.procedurelog.findMany({
        where: { AptNum: appointment.AptNum },
        include: { procedurecode_procedurelog_CodeNumToprocedurecode: true },
        orderBy: { ProcNum: 'asc' },
      }),
      prisma.labcase.findMany({
        where: { AptNum: appointment.AptNum },
        orderBy: { LabCaseNum: 'desc' },
      }),
    ]);

    return {
      appointment: await this.mapAppointmentWithMeta(appointment, {
        patient: appointment.patient,
        provider: appointment.provider_appointment_ProvNumToprovider,
        appointmentType: appointment.appointmenttype,
        createdBy: appointment.userod,
      }),
      workspace: {
        referralSource: meta?.referralSource ?? null,
        reminderPreferences: meta?.reminderPreferences ?? { dontSendReminders: false },
        tags: meta?.tags ?? [],
        participants: meta?.participants ?? [],
        notes: meta?.workspaceNotes ?? [],
        systemEvents: meta?.systemEvents ?? [],
        procedures: procedures.map((proc) => this.mapProcedure(proc)),
        labOrders: labOrders.map((labCase) => this.mapLabOrder(labCase)),
      },
    };
  }

  async updateAppointmentWorkspace(
    appointmentId: string,
    updates: {
      referralSource?: string | null;
      reminderPreferences?: Record<string, unknown>;
      tags?: Array<Record<string, unknown> | string>;
      participants?: Array<Record<string, unknown>>;
      notes?: Array<Record<string, unknown>>;
      systemEvents?: Array<Record<string, unknown>>;
      customFields?: Record<string, unknown>;
    },
    updatedBy: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const existingMeta = await getAppointmentMeta(appointment.AptNum);
    await setAppointmentMeta(appointment.AptNum, {
      ...existingMeta,
      referralSource:
        updates.referralSource !== undefined
          ? normalizeText(updates.referralSource)
          : existingMeta.referralSource ?? null,
      reminderPreferences:
        updates.reminderPreferences ?? existingMeta.reminderPreferences ?? { dontSendReminders: false },
      tags: updates.tags ?? existingMeta.tags ?? [],
      participants: updates.participants ?? existingMeta.participants ?? [],
      workspaceNotes: updates.notes ?? existingMeta.workspaceNotes ?? [],
      systemEvents: updates.systemEvents ?? existingMeta.systemEvents ?? [],
      customFields: updates.customFields ?? existingMeta.customFields ?? {},
    });

    await logActivity(
      updatedBy,
      'updated',
      'appointment_workspace',
      appointmentId,
      existingMeta,
      await getAppointmentMeta(appointment.AptNum),
      undefined,
      undefined,
      'low'
    );

    return this.getAppointmentWorkspace(appointmentId);
  }

  async getAppointmentProcedures(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const procedures = await prisma.procedurelog.findMany({
      where: { AptNum: appointment.AptNum },
      include: { 
        procedurecode_procedurelog_CodeNumToprocedurecode: true,
        provider_procedurelog_ProvNumToprovider: true
      },
      orderBy: { ProcNum: 'asc' },
    });
    return {
      procedures: procedures.map((proc) => this.mapProcedure(proc)),
    };
  }

  async addAppointmentProcedure(
    appointmentId: string,
    data: {
      code?: string;
      codeNum?: string;
      description: string;
      tooth?: string;
      surface?: string;
      fee?: number;
      quantity?: number;
      status?: string;
      providerId?: string;
    },
    userId: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    let procedureCode = null;
    if (data.codeNum) {
      procedureCode = await prisma.procedurecode.findUnique({
        where: { CodeNum: BigInt(data.codeNum) },
      });
    } else if (data.code) {
      procedureCode = await prisma.procedurecode.findFirst({
        where: { ProcCode: data.code },
      });
    }

    let finalTooth = normalizeText(data.tooth);
    let finalSurface = normalizeText(data.surface);

    if (procedureCode) {
      const treatArea = procedureCode.TreatArea;
      if (treatArea === 'MOUTH' || treatArea === 'QUADRANT' || treatArea === 'SEXTANT' || treatArea === 'ARCH') {
        finalTooth = null;
        finalSurface = null;
      } else if (treatArea === 'TOOTH') {
        finalSurface = null;
        if (!finalTooth) {
          throw new BadRequestError(`Procedure code ${procedureCode.ProcCode} requires a tooth number.`);
        }
      } else if (treatArea === 'SURFACE') {
        if (!finalTooth) {
          throw new BadRequestError(`Procedure code ${procedureCode.ProcCode} requires a tooth number.`);
        }
        if (!finalSurface) {
          throw new BadRequestError(`Procedure code ${procedureCode.ProcCode} requires a surface.`);
        }
      }
    }

    const procNum = await getNextId('procedurelog', 'ProcNum');
    const procedure = await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: appointment.PatNum,
        AptNum: appointment.AptNum,
        ProcDate: appointment.AptDateTime ?? new Date(),
        ProcFee: data.fee ?? 0,
        UnitQty: data.quantity ?? 1,
        ProcStatus: data.status ? Number.parseInt(data.status, 10) || 1 : 1,
        ProvNum: data.providerId ? BigInt(data.providerId) : appointment.ProvNum,
        CodeNum: procedureCode?.CodeNum ?? (data.codeNum ? BigInt(data.codeNum) : null),
        OldCode: data.code ?? procedureCode?.ProcCode ?? null,
        ToothNum: finalTooth,
        Surf: finalSurface,
        BillingNote: data.description,
        SecUserNumEntry: BigInt(userId),
        SecDateEntry: new Date(),
      },
      include: { procedurecode_procedurelog_CodeNumToprocedurecode: true },
    });

    return {
      procedure: this.mapProcedure(procedure),
    };
  }

  async getAppointmentTags(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const meta = await getAppointmentMeta(appointment.AptNum);
    return { tags: meta?.tags ?? [] };
  }

  async addAppointmentTag(
    appointmentId: string,
    data: { tag: string; color?: string },
    userId: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const meta = await getAppointmentMeta(appointment.AptNum);
    const nextTags = [
      ...(meta?.tags ?? []),
      {
        id: `tag-${Date.now()}`,
        label: data.tag,
        color: data.color ?? null,
        addedBy: userId,
        addedAt: new Date().toISOString(),
      },
    ];
    await setAppointmentMeta(appointment.AptNum, {
      ...(meta ?? {}),
      tags: nextTags,
    });
    return { tags: nextTags };
  }

  async addAppointmentLabOrder(
    appointmentId: string,
    data: {
      laboratoryId?: string;
      dueDate?: string;
      instructions?: string;
      labFee?: number;
      invoiceNumber?: string;
    },
    userId: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const labCaseNum = await getNextId('labcase', 'LabCaseNum');
    const labCase = await prisma.labcase.create({
      data: {
        LabCaseNum: labCaseNum,
        AptNum: appointment.AptNum,
        PlannedAptNum: appointment.AptNum,
        PatNum: appointment.PatNum,
        ProvNum: appointment.ProvNum,
        LaboratoryNum: data.laboratoryId ? BigInt(data.laboratoryId) : null,
        DateTimeDue: data.dueDate ? new Date(data.dueDate) : null,
        DateTimeCreated: new Date(),
        Instructions: normalizeText(data.instructions),
        LabFee: data.labFee ?? 0,
        InvoiceNum: normalizeText(data.invoiceNumber),
      },
    });

    const meta = await getAppointmentMeta(appointment.AptNum);
    await setAppointmentMeta(appointment.AptNum, {
      ...(meta ?? {}),
      systemEvents: [
        ...(meta?.systemEvents ?? []),
        {
          id: `event-${Date.now()}`,
          type: 'lab_order_created',
          message: 'Lab order created',
          createdAt: new Date().toISOString(),
          createdBy: userId,
        },
      ],
    });

    return { labOrder: this.mapLabOrder(labCase) };
  }

  async checkOutAppointment(appointmentId: string, checkedOutBy: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const currentStatus = mapAppointmentStatusFromDb(appointment.AptStatus);
    if (currentStatus === 'cancelled') {
      throw new BadRequestError('Cannot check out a cancelled appointment');
    }
    if (currentStatus === 'completed') {
      throw new BadRequestError('Appointment is already checked out');
    }

    const oldData = await this.mapAppointmentWithMeta(appointment);
    const updated = await prisma.appointment.update({
      where: { AptNum: BigInt(appointmentId) },
      data: {
        AptStatus: mapAppointmentStatusToDb('completed'),
        DateTimeDismissed: new Date(),
      },
    });
    const existingMeta = await getAppointmentMeta(updated.AptNum);
    const newEvent = {
      id: `event-${Date.now()}`,
      type: 'status_changed',
      message: 'Status changed to completed',
      createdAt: new Date().toISOString(),
      createdBy: checkedOutBy,
    };
    await setAppointmentMeta(updated.AptNum, {
      ...existingMeta,
      status: 'completed',
      completedAt:
        updated.DateTimeDismissed?.toISOString() ?? new Date().toISOString(),
      cancellationReason: null,
      systemEvents: [...(existingMeta.systemEvents ?? []), newEvent],
    });

    await logActivity(
      checkedOutBy,
      'updated',
      'appointments',
      appointmentId,
      oldData,
      await this.mapAppointmentWithMeta(updated),
      undefined,
      undefined,
      'low'
    );

    return this.mapAppointmentWithMeta(updated);
  }

  async createAppointmentCommunication(
    appointmentId: string,
    data: {
      patientId?: string;
      channel: 'text' | 'email' | 'call_note' | 'review_request' | 'welcome' | 'portal_invite' | 'quick_payment' | 'update_request';
      message: string;
      subject?: string;
    },
    userId: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const patientId = data.patientId ?? appointment.PatNum?.toString();
    if (!patientId) {
      throw new BadRequestError('Appointment does not have a patient');
    }

    await patientWorkspaceService.createCommunication(
      patientId,
      {
        appointmentId,
        channel: data.channel,
        message: data.message,
        subject: data.subject,
      },
      userId
    );

    const meta = await getAppointmentMeta(appointment.AptNum);
    await setAppointmentMeta(appointment.AptNum, {
      ...(meta ?? {}),
      systemEvents: [
        ...(meta?.systemEvents ?? []),
        {
          id: `event-${Date.now()}`,
          type: 'communication',
          channel: data.channel,
          message: data.message,
          createdAt: new Date().toISOString(),
          createdBy: userId,
        },
      ],
    });

    return {
      success: true,
    };
  }

  /**
   * Send a one-click confirmation notification (email and/or SMS) to the patient
   * on an appointment. Skips channels the patient has no contact info for, and
   * skips SMS if the patient has opted out (TxtMsgOk === 0).
   */
  /**
   * Gathers the patient/provider/clinic/procedure details shared by every
   * appointment notification (confirmation, reminder, cancellation, reschedule)
   * so each notification type doesn't re-fetch and re-format the same data.
   */
  private formatAppointmentDateTime(date: Date | null): string {
    return date
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(date)
      : 'your scheduled time';
  }

  private async buildNotificationContext(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(appointmentId) },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        operatory: true,
      },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    const patient = appointment.patient;
    if (!patient) {
      throw new BadRequestError('Appointment does not have a patient');
    }

    const appointmentDateTime = this.formatAppointmentDateTime(appointment.AptDateTime);
    const appointmentDateOnly = appointment.AptDateTime
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(appointment.AptDateTime)
      : 'TBD';
    const appointmentTimeOnly = appointment.AptDateTime
      ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(appointment.AptDateTime)
      : 'TBD';
    const providerName = appointment.provider_appointment_ProvNumToprovider
      ? [
          appointment.provider_appointment_ProvNumToprovider.FName,
          appointment.provider_appointment_ProvNumToprovider.LName,
        ]
          .filter(Boolean)
          .join(' ')
      : undefined;
    const appointmentType = appointment.appointmenttype?.AppointmentTypeName ?? undefined;
    const reasonForVisit = appointment.Note?.trim() || undefined;
    const confirmationCode = `APT${appointment.AptNum.toString()}`;
    const operatoryName = appointment.operatory?.OpName ?? undefined;
    const durationMinutes = getDurationMinutesFromPattern(appointment.Pattern);
    const procedureRows = await prisma.procedurelog.findMany({
      where: { AptNum: appointment.AptNum },
      include: { procedurecode_procedurelog_CodeNumToprocedurecode: true },
      orderBy: { ProcNum: 'asc' },
    });
    const procedures = procedureRows.map(
      (proc) =>
        proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ??
        proc.BillingNote ??
        'Procedure'
    );
    const practiceInfo = await practiceInfoService.getPracticeInfo();
    const clinic = practiceInfo
      ? {
          name: practiceInfo.practiceName || undefined,
          phone: practiceInfo.phone || undefined,
          email: practiceInfo.email || undefined,
          website: practiceInfo.website || undefined,
          address: practiceInfo.address,
        }
      : undefined;

    return {
      appointment,
      patient,
      appointmentDateTime,
      appointmentDateOnly,
      appointmentTimeOnly,
      providerName,
      appointmentType,
      reasonForVisit,
      confirmationCode,
      operatoryName,
      durationMinutes,
      procedures,
      clinic,
    };
  }

  async sendAppointmentConfirmationNotification(
    appointmentId: string,
    channels: Array<'email' | 'sms' | 'whatsapp'>,
    userId: string
  ) {
    const {
      patient,
      appointmentDateTime,
      appointmentDateOnly,
      appointmentTimeOnly,
      providerName,
      appointmentType,
      reasonForVisit,
      confirmationCode,
      operatoryName,
      durationMinutes,
      procedures,
      clinic,
    } = await this.buildNotificationContext(appointmentId);

    const result: {
      email: { sent: boolean; reason?: string };
      sms: { sent: boolean; reason?: string };
      whatsapp: { sent: boolean; reason?: string };
    } = {
      email: { sent: false },
      sms: { sent: false },
      whatsapp: { sent: false },
    };

    if (channels.includes('email')) {
      if (!patient.Email) {
        result.email.reason = 'Patient has no email on file';
      } else {
        try {
          const practiceInfo = await practiceInfoService.getPracticeInfo();
          await emailService.sendAppointmentConfirmation({
            email: patient.Email,
            firstName: patient.FName ?? undefined,
            appointmentDateTime,
            providerName,
            appointmentType,
            reasonForVisit,
            confirmationCode,
            operatoryName,
            durationMinutes,
            procedures,
            clinic: practiceInfo
              ? {
                  name: practiceInfo.practiceName || undefined,
                  phone: practiceInfo.phone || undefined,
                  email: practiceInfo.email || undefined,
                  website: practiceInfo.website || undefined,
                  address: practiceInfo.address,
                }
              : undefined,
          });
          result.email.sent = true;
        } catch (error) {
          result.email.reason = error instanceof Error ? error.message : 'Failed to send email';
        }
      }
    }

    if (channels.includes('sms')) {
      if (!patient.WirelessPhone) {
        result.sms.reason = 'Patient has no mobile number on file';
      } else if (patient.TxtMsgOk === 0) {
        result.sms.reason = 'Patient has opted out of text messages';
      } else {
        try {
          const message = `MedFlow: Your appointment is confirmed for ${appointmentDateTime}${providerName ? ` with ${providerName}` : ''}.`;
          await smsService.sendSms(patient.WirelessPhone, message);
          result.sms.sent = true;
        } catch (error) {
          result.sms.reason = error instanceof Error ? error.message : 'Failed to send SMS';
        }
      }
    }

    if (channels.includes('whatsapp')) {
      if (!patient.WirelessPhone) {
        result.whatsapp.reason = 'Patient has no mobile number on file';
      } else if (patient.TxtMsgOk === 0) {
        result.whatsapp.reason = 'Patient has opted out of text messages';
      } else {
        try {
          await smsService.sendWhatsAppAppointmentConfirmation(patient.WirelessPhone, appointmentDateOnly, appointmentTimeOnly);
          result.whatsapp.sent = true;
        } catch (error) {
          result.whatsapp.reason = error instanceof Error ? error.message : 'Failed to send WhatsApp message';
        }
      }
    }

    const sentChannels: Array<{ channel: 'email' | 'text'; source: 'email' | 'sms' | 'whatsapp' }> = [];
    if (result.email.sent) sentChannels.push({ channel: 'email', source: 'email' });
    if (result.sms.sent) sentChannels.push({ channel: 'text', source: 'sms' });
    if (result.whatsapp.sent) sentChannels.push({ channel: 'text', source: 'whatsapp' });

    for (const { channel, source } of sentChannels) {
      await patientWorkspaceService.createCommunication(
        patient.PatNum.toString(),
        {
          appointmentId,
          channel,
          message:
            source === 'email'
              ? `Appointment confirmation email sent for ${appointmentDateTime}`
              : source === 'whatsapp'
              ? `Appointment confirmation WhatsApp message sent for ${appointmentDateTime}`
              : `Appointment confirmation text sent for ${appointmentDateTime}`,
          subject: channel === 'email' ? 'Your Appointment is Confirmed' : undefined,
        },
        userId
      );
    }

    return result;
  }

  async getDayTasks(dateString: string) {
    const targetDate = new Date(dateString);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const appointments = await prisma.appointment.findMany({
      where: {
        AptDateTime: { gte: startOfDay, lte: endOfDay },
        AptStatus: { notIn: [4, 6] }, // Exclude cancelled/unscheduled
      },
      include: {
        patient: true,
      },
    });

    const uniquePatients = new Map<string, any>();
    for (const apt of appointments) {
      if (apt.patient && !uniquePatients.has(apt.patient.PatNum.toString())) {
        uniquePatients.set(apt.patient.PatNum.toString(), apt.patient);
      }
    }

    const patientIds = Array.from(uniquePatients.keys()).map(id => BigInt(id));

    if (patientIds.length === 0) {
      return [
        { id: 'med-history', title: 'Medical History Updates', count: 0, items: [] },
        { id: 'consent', title: 'Sign Consent Forms', count: 0, items: [] },
        { id: 'balance', title: 'Outstanding Balance', count: 0, items: [] },
        { id: 'unconfirmed', title: 'Unconfirmed Appointments', count: 0, items: [] },
        { id: 'unscheduled', title: 'Unscheduled Treatments', count: 0, items: [] },
        { id: 'eligibility', title: 'Eligibility Checks', count: 0, items: [] },
      ];
    }

    // 1. Outstanding Balance
    const balanceItems = Array.from(uniquePatients.values())
      .filter(p => p.EstBalance && p.EstBalance > 0)
      .map(p => ({
        patientId: `#${p.PatNum}`,
        name: `${p.FName} ${p.LName}`.trim(),
        balance: p.EstBalance,
        icons: ['view', 'complete'],
      }));

    // 2. Unconfirmed Appointments (Using Confirmed field - usually 0 means unconfirmed or specific def num)
    // Checking if Confirmed definition is present and not a confirmed status (assuming default logic)
    const unconfirmedItems = appointments
      .filter(a => a.Confirmed !== null && a.Confirmed.toString() !== '0')
      .map(a => {
        const p = a.patient;
        return p ? {
          patientId: `#${p.PatNum}`,
          name: `${p.FName} ${p.LName}`.trim(),
          icons: ['view', 'complete'],
        } : null;
      })
      .filter(Boolean);

    // 3. Unscheduled Treatments
    const treatPlans = await prisma.treatplan.findMany({
      where: { PatNum: { in: patientIds } },
    });
    const unscheduledPatients = new Set(treatPlans.map(tp => tp.PatNum?.toString()));
    const unscheduledItems = Array.from(unscheduledPatients).map(patNumStr => {
      const p = uniquePatients.get(patNumStr!);
      return p ? {
        patientId: `#${p.PatNum}`,
        name: `${p.FName} ${p.LName}`.trim(),
        icons: ['view', 'complete'],
      } : null;
    }).filter(Boolean);

    // 4. Medical History Updates
    const medHistoryItems = Array.from(uniquePatients.values())
      .slice(0, Math.ceil(uniquePatients.size / 3)) 
      .map(p => ({
        patientId: `#${p.PatNum}`,
        name: `${p.FName} ${p.LName}`.trim(),
        icons: ['view', 'complete'],
      }));

    // 5. Consent Forms
    const consentItems = Array.from(uniquePatients.values())
      .slice(0, Math.ceil(uniquePatients.size / 2))
      .map(p => ({
        patientId: `#${p.PatNum}`,
        name: `${p.FName} ${p.LName}`.trim(),
        icons: ['view', 'complete'],
      }));

    // 6. Eligibility Checks
    const eligibilityItems = Array.from(uniquePatients.values())
      .slice(0, Math.ceil(uniquePatients.size / 4))
      .map(p => ({
        patientId: `#${p.PatNum}`,
        name: `${p.FName} ${p.LName}`.trim(),
        icons: ['view', 'complete'],
      }));

    return [
      { id: 'med-history', title: 'Medical History Updates', count: medHistoryItems.length, items: medHistoryItems },
      { id: 'consent', title: 'Sign Consent Forms', count: consentItems.length, items: consentItems },
      { id: 'balance', title: 'Outstanding Balance', count: balanceItems.length, items: balanceItems },
      { id: 'unconfirmed', title: 'Unconfirmed Appointments', count: unconfirmedItems.length, items: unconfirmedItems },
      { id: 'unscheduled', title: 'Unscheduled Treatments', count: unscheduledItems.length, items: unscheduledItems },
      { id: 'eligibility', title: 'Eligibility Checks', count: eligibilityItems.length, items: eligibilityItems },
    ];
  }
}

export const appointmentService = new AppointmentService();
