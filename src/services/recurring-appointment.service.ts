import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { appointmentService } from './appointment.service';
import { getNextId } from '../utils/opendental-ids.util';

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

type RecurringMeta = {
  patientId: string;
  providerId: string;
  appointmentTypeId?: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  frequencyValue: number;
  startDate: string;
  endDate?: string;
  preferredTime: string;
  preferredDayOfWeek?: number;
  totalAppointments?: number;
  appointmentsCreated?: number;
  isActive?: boolean;
  createdBy: string;
};

const calculateTotalAppointments = (data: {
  frequency: 'weekly' | 'monthly' | 'quarterly';
  frequencyValue: number;
  startDate: Date;
  endDate?: Date;
  totalAppointments?: number;
}) => {
  if (data.totalAppointments) return data.totalAppointments;
  if (!data.endDate) return undefined;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (data.frequency === 'weekly') {
    return Math.max(1, Math.ceil(daysDiff / (7 * data.frequencyValue)));
  }
  if (data.frequency === 'monthly') {
    return Math.max(1, Math.ceil(daysDiff / (30 * data.frequencyValue)));
  }
  return Math.max(1, Math.ceil(daysDiff / (90 * data.frequencyValue)));
};

const generateOccurrences = (meta: RecurringMeta, count: number) => {
  const occurrences: Date[] = [];
  let currentDate = new Date(meta.startDate);
  const [hours, minutes] = meta.preferredTime.split(':').map(Number);
  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    currentDate.setHours(hours, minutes, 0, 0);
  }

  if (meta.preferredDayOfWeek !== undefined) {
    const currentDay = currentDate.getDay();
    const daysToAdd = (meta.preferredDayOfWeek - currentDay + 7) % 7;
    currentDate.setDate(currentDate.getDate() + daysToAdd);
  }

  for (let i = 0; i < count; i++) {
    if (meta.endDate && currentDate > new Date(meta.endDate)) break;
    occurrences.push(new Date(currentDate));

    if (meta.frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7 * meta.frequencyValue);
    } else if (meta.frequency === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + meta.frequencyValue);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 3 * meta.frequencyValue);
    }

    if (meta.preferredDayOfWeek !== undefined) {
      const currentDay = currentDate.getDay();
      const daysToAdd = (meta.preferredDayOfWeek - currentDay + 7) % 7;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
    }
  }

  return occurrences;
};

export class RecurringAppointmentService {
  async getAllRecurringAppointments(
    page = 1,
    limit = 10,
    filters?: {
      patientId?: string;
      providerId?: string;
      isActive?: boolean;
      search?: string;
      startDateFrom?: string;
      startDateTo?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = { SchedType: 2 };

    if (filters?.providerId) where.ProvNum = BigInt(filters.providerId);
    if (filters?.isActive !== undefined) where.Status = filters.isActive ? 0 : 1;
    if (filters?.startDateFrom || filters?.startDateTo) {
      where.SchedDate = {};
      if (filters.startDateFrom) where.SchedDate.gte = new Date(filters.startDateFrom);
      if (filters.startDateTo) where.SchedDate.lte = new Date(filters.startDateTo);
    }

    const [rows, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        orderBy: { SchedDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    let recurringAppointments = rows.map((row) => {
      const meta = parseJson<RecurringMeta>(row.Note);
      return {
        _id: row.ScheduleNum.toString(),
        patientId: meta.patientId,
        providerId: meta.providerId,
        appointmentTypeId: meta.appointmentTypeId ?? null,
        frequency: meta.frequency,
        frequencyValue: meta.frequencyValue,
        startDate: meta.startDate ? new Date(meta.startDate) : row.SchedDate,
        endDate: meta.endDate ? new Date(meta.endDate) : null,
        preferredTime: meta.preferredTime,
        preferredDayOfWeek: meta.preferredDayOfWeek ?? null,
        totalAppointments: meta.totalAppointments ?? null,
        appointmentsCreated: meta.appointmentsCreated ?? 0,
        isActive: meta.isActive ?? row.Status === 0,
        createdBy: meta.createdBy,
      };
    });

    if (filters?.patientId) {
      recurringAppointments = recurringAppointments.filter(
        (rec) => rec.patientId === filters.patientId
      );
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      recurringAppointments = recurringAppointments.filter((rec) =>
        rec.frequency.toLowerCase().includes(searchLower)
      );
    }

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

  async getRecurringAppointmentById(recurringAppointmentId: string) {
    const row = await prisma.schedule.findUnique({
      where: { ScheduleNum: BigInt(recurringAppointmentId) },
    });
    if (!row) {
      throw new NotFoundError('Recurring appointment not found');
    }

    const meta = parseJson<RecurringMeta>(row.Note);
    return {
      _id: row.ScheduleNum.toString(),
      patientId: meta.patientId,
      providerId: meta.providerId,
      appointmentTypeId: meta.appointmentTypeId ?? null,
      frequency: meta.frequency,
      frequencyValue: meta.frequencyValue,
      startDate: meta.startDate ? new Date(meta.startDate) : row.SchedDate,
      endDate: meta.endDate ? new Date(meta.endDate) : null,
      preferredTime: meta.preferredTime,
      preferredDayOfWeek: meta.preferredDayOfWeek ?? null,
      totalAppointments: meta.totalAppointments ?? null,
      appointmentsCreated: meta.appointmentsCreated ?? 0,
      isActive: meta.isActive ?? row.Status === 0,
      createdBy: meta.createdBy,
    };
  }

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
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(data.patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const provider = await prisma.provider.findUnique({
      where: { ProvNum: BigInt(data.providerId) },
    });
    if (!provider || provider.IsHidden) {
      throw new NotFoundError('Provider not found or inactive');
    }

    if (data.appointmentTypeId) {
      const appointmentType = await prisma.appointmenttype.findUnique({
        where: { AppointmentTypeNum: BigInt(data.appointmentTypeId) },
      });
      if (!appointmentType || appointmentType.IsHidden) {
        throw new NotFoundError('Appointment type not found or inactive');
      }
    }

    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    if (data.preferredDayOfWeek !== undefined && (data.preferredDayOfWeek < 0 || data.preferredDayOfWeek > 6)) {
      throw new BadRequestError('Preferred day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    const totalAppointments = calculateTotalAppointments({
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate,
      endDate: data.endDate,
      totalAppointments: data.totalAppointments,
    });

    const scheduleNum = await getNextId('schedule', 'ScheduleNum');
    const meta: RecurringMeta = {
      patientId: data.patientId,
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate ? data.endDate.toISOString() : undefined,
      preferredTime: data.preferredTime,
      preferredDayOfWeek: data.preferredDayOfWeek,
      totalAppointments,
      appointmentsCreated: 0,
      isActive: true,
      createdBy,
    };

    const recurringAppointment = await prisma.schedule.create({
      data: {
        ScheduleNum: scheduleNum,
        SchedDate: data.startDate,
        StartTime: new Date(`1970-01-01T${data.preferredTime}:00Z`),
        SchedType: 2,
        ProvNum: BigInt(data.providerId),
        Status: 0,
        Note: buildJson(meta),
      },
    });

    let generatedInfo = null;
    if (totalAppointments) {
      const generateResult = await this.generateAppointments(recurringAppointment.ScheduleNum.toString(), totalAppointments, createdBy);
      generatedInfo = {
        appointmentsCreated: generateResult.appointments.length,
        skippedCount: generateResult.skippedCount || 0,
      };
    }

    await logActivity(
      createdBy,
      'created',
      'recurring_appointments',
      recurringAppointment.ScheduleNum.toString(),
      undefined,
      recurringAppointment,
      undefined,
      undefined,
      'medium'
    );

    if (generatedInfo) {
      return {
        recurringAppointment,
        ...generatedInfo,
      };
    }

    return recurringAppointment;
  }

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
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTime)) {
      throw new BadRequestError('Preferred time must be in HH:MM format');
    }

    const totalAppointments = calculateTotalAppointments({
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate,
      endDate: data.endDate,
      totalAppointments: data.totalAppointments,
    });

    if (!totalAppointments) {
      throw new BadRequestError('totalAppointments or endDate is required for preview');
    }

    const meta: RecurringMeta = {
      patientId: 'preview',
      providerId: data.providerId,
      appointmentTypeId: data.appointmentTypeId,
      frequency: data.frequency,
      frequencyValue: data.frequencyValue,
      startDate: data.startDate.toISOString(),
      endDate: data.endDate ? data.endDate.toISOString() : undefined,
      preferredTime: data.preferredTime,
      preferredDayOfWeek: data.preferredDayOfWeek,
      totalAppointments,
      appointmentsCreated: 0,
      isActive: true,
      createdBy: 'preview',
    };

    const previewAppointments = generateOccurrences(meta, totalAppointments).map((date, idx) => {
      const endTimeDate = new Date(date);
      endTimeDate.setMinutes(endTimeDate.getMinutes() + 30);
      const startTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;
      return {
        appointmentNumber: idx + 1,
        date,
        startTime,
        endTime,
        durationMinutes: 30,
        hasConflict: false,
      };
    });

    return {
      previewAppointments,
      totalCount: previewAppointments.length,
      conflictCount: 0,
      availableCount: previewAppointments.length,
    };
  }

  async generateAppointments(recurringAppointmentId: string, count: number, createdBy: string) {
    const recurringAppointment = await prisma.schedule.findUnique({
      where: { ScheduleNum: BigInt(recurringAppointmentId) },
    });
    if (!recurringAppointment) {
      throw new NotFoundError('Recurring appointment not found');
    }

    const meta = parseJson<RecurringMeta>(recurringAppointment.Note);
    if (!meta.isActive) {
      throw new BadRequestError('Recurring appointment series is not active');
    }

    const remaining = meta.totalAppointments
      ? Math.max(0, meta.totalAppointments - (meta.appointmentsCreated || 0))
      : count;
    const appointmentsToCreate = Math.min(count, remaining || count);

    if (appointmentsToCreate <= 0) {
      throw new BadRequestError('No more appointments can be created for this series');
    }

    const occurrences = generateOccurrences(meta, appointmentsToCreate);
    const appointments: any[] = [];
    const skippedAppointments: any[] = [];

    for (const occurrence of occurrences) {
      try {
        const endTimeDate = new Date(occurrence);
        endTimeDate.setMinutes(endTimeDate.getMinutes() + 30);
        const startTime = `${occurrence.getHours().toString().padStart(2, '0')}:${occurrence.getMinutes().toString().padStart(2, '0')}`;
        const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;

        const appointment = await appointmentService.createAppointment(
          {
            patientId: meta.patientId,
            providerId: meta.providerId,
            appointmentTypeId: meta.appointmentTypeId,
            appointmentDate: occurrence,
            startTime,
            endTime,
            durationMinutes: 30,
            notes: 'Generated from recurring appointment',
          },
          createdBy
        );
        appointments.push(appointment);
      } catch (error) {
        skippedAppointments.push({
          date: occurrence,
          reason: error instanceof Error ? error.message : 'Conflict detected',
        });
      }
    }

    const nextMeta: RecurringMeta = {
      ...meta,
      appointmentsCreated: (meta.appointmentsCreated || 0) + appointments.length,
    };

    await prisma.schedule.update({
      where: { ScheduleNum: BigInt(recurringAppointmentId) },
      data: { Note: buildJson(nextMeta) },
    });

    return {
      appointments,
      skippedAppointments,
      skippedCount: skippedAppointments.length,
    };
  }
}

export const recurringAppointmentService = new RecurringAppointmentService();
