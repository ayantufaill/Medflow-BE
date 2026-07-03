import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { appointmentService } from './appointment.service';
import { getNextId } from '../utils/opendental-ids.util';
import { mapAppointmentTypeToApi, mapPatientToApi, mapProviderToApi } from '../utils/opendental-mappers.util';
import { mapUser, getUsersMeta } from '../utils/opendental-auth.util';

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
  const [hours = 0, minutes = 0] = meta.preferredTime.split(':').map(Number);
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
  private async mapRecurringRow(
    row: any,
    preloaded?: {
      patientMap: Map<string, any>;
      providerMap: Map<string, any>;
      appointmentTypeMap: Map<string, any>;
      userMap: Map<string, any>;
    }
  ) {
    const meta = parseJson<RecurringMeta>(row.Note);
    let patient, provider, appointmentType, mappedCreator, mappedProviderUser;

    if (preloaded) {
      patient = meta.patientId ? preloaded.patientMap.get(meta.patientId.toString()) : null;
      provider = meta.providerId ? preloaded.providerMap.get(meta.providerId.toString()) : null;
      appointmentType = meta.appointmentTypeId ? preloaded.appointmentTypeMap.get(meta.appointmentTypeId.toString()) : null;
      mappedCreator = meta.createdBy ? preloaded.userMap.get(meta.createdBy.toString()) : null;
      mappedProviderUser = provider?.CustomID ? preloaded.userMap.get(provider.CustomID.toString()) : null;
    } else {
      const results = await Promise.all([
        meta.patientId ? prisma.patient.findUnique({ where: { PatNum: BigInt(meta.patientId) } }) : null,
        meta.providerId ? prisma.provider.findUnique({ where: { ProvNum: BigInt(meta.providerId) }, include: { definition: true } }) : null,
        meta.appointmentTypeId ? prisma.appointmenttype.findUnique({ where: { AppointmentTypeNum: BigInt(meta.appointmentTypeId) } }) : null,
        meta.createdBy ? prisma.userod.findUnique({ where: { UserNum: BigInt(meta.createdBy) } }) : null,
      ]);
      patient = results[0];
      provider = results[1];
      appointmentType = results[2];
      const creatorUser = results[3];
      const linkedProviderUser = provider?.CustomID
        ? await prisma.userod.findUnique({ where: { UserNum: BigInt(provider.CustomID) } })
        : null;
      mappedCreator = creatorUser ? await mapUser(creatorUser) : null;
      mappedProviderUser = linkedProviderUser ? await mapUser(linkedProviderUser) : null;
    }

    return {
      _id: row.ScheduleNum.toString(),
      patientId: patient ? mapPatientToApi(patient) : meta.patientId ?? null,
      providerId: provider
        ? mapProviderToApi(provider, {
            specialtyName: provider.definition?.ItemName ?? null,
            userId: provider.CustomID ?? null,
            user: mappedProviderUser
              ? {
                  _id: mappedProviderUser._id,
                  firstName: mappedProviderUser.firstName,
                  lastName: mappedProviderUser.lastName,
                  email: mappedProviderUser.email || null,
                }
              : null,
          })
        : meta.providerId ?? null,
      appointmentTypeId: appointmentType ? mapAppointmentTypeToApi(appointmentType) : meta.appointmentTypeId ?? null,
      frequency: meta.frequency,
      frequencyValue: meta.frequencyValue,
      startDate: meta.startDate ? new Date(meta.startDate) : row.SchedDate,
      endDate: meta.endDate ? new Date(meta.endDate) : null,
      preferredTime: meta.preferredTime,
      preferredDayOfWeek: meta.preferredDayOfWeek ?? null,
      totalAppointments: meta.totalAppointments ?? null,
      appointmentsCreated: meta.appointmentsCreated ?? 0,
      isActive: meta.isActive ?? row.Status === 0,
      createdBy: mappedCreator
        ? {
            _id: mappedCreator._id,
            firstName: mappedCreator.firstName,
            lastName: mappedCreator.lastName,
            email: mappedCreator.email || null,
          }
        : (meta.createdBy ? { _id: meta.createdBy, firstName: '', lastName: '', email: null } : null),
      createdAt: row.SchedDate ?? null,
      updatedAt: row.SchedDate ?? null,
    };
  }

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

    const metaList = rows.map((row) => parseJson<RecurringMeta>(row.Note));
    const patientIds = Array.from(new Set(metaList.map(m => m.patientId).filter(Boolean))).map(id => BigInt(id!));
    const providerIds = Array.from(new Set(metaList.map(m => m.providerId).filter(Boolean))).map(id => BigInt(id!));
    const appointmentTypeIds = Array.from(new Set(metaList.map(m => m.appointmentTypeId).filter(Boolean))).map(id => BigInt(id!));

    const [patients, providers, appointmentTypes] = await Promise.all([
      patientIds.length ? prisma.patient.findMany({ where: { PatNum: { in: patientIds } } }) : [],
      providerIds.length ? prisma.provider.findMany({ where: { ProvNum: { in: providerIds } }, include: { definition: true } }) : [],
      appointmentTypeIds.length ? prisma.appointmenttype.findMany({ where: { AppointmentTypeNum: { in: appointmentTypeIds } } }) : [],
    ]);

    const providerUserIds = Array.from(
      new Set(providers.map((p) => p.CustomID).filter((id): id is string => Boolean(id)))
    );
    const creatorIds = Array.from(
      new Set(metaList.map(m => m.createdBy).filter((id): id is string => Boolean(id)))
    );
    const userIds = Array.from(new Set([...providerUserIds, ...creatorIds]));
    const users = userIds.length ? await prisma.userod.findMany({ where: { UserNum: { in: userIds.map(id => BigInt(id)) } } }) : [];

    const usersMeta = users.length ? await getUsersMeta(users.map((u) => u.UserNum)) : {};
    const usersMap = new Map(
      await Promise.all(
        users.map(async (user) => {
          const mappedUser = await mapUser(user, usersMeta[user.UserNum.toString()]);
          return [user.UserNum.toString(), mappedUser] as const;
        })
      )
    );

    const patientMap = new Map(patients.map((p) => [p.PatNum.toString(), p]));
    const providerMap = new Map(providers.map((p) => [p.ProvNum.toString(), p]));
    const appointmentTypeMap = new Map(appointmentTypes.map((a) => [a.AppointmentTypeNum.toString(), a]));

    let recurringAppointments = await Promise.all(
      rows.map((row) => this.mapRecurringRow(row, { patientMap, providerMap, appointmentTypeMap, userMap: usersMap }))
    );

    if (filters?.patientId) {
      recurringAppointments = recurringAppointments.filter((rec: any) => {
        const pid = typeof rec.patientId === 'object' ? rec.patientId?._id : rec.patientId;
        return pid === filters.patientId;
      });
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

    return this.mapRecurringRow(row);
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

    const mappedRecurringAppointment = await this.getRecurringAppointmentById(
      recurringAppointment.ScheduleNum.toString()
    );

    if (generatedInfo) {
      return {
        recurringAppointment: mappedRecurringAppointment,
        ...generatedInfo,
      };
    }

    return mappedRecurringAppointment;
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

  async updateRecurringAppointment(
    recurringAppointmentId: string,
    updates: Partial<{
      appointmentTypeId: string;
      frequency: 'weekly' | 'monthly' | 'quarterly';
      frequencyValue: number;
      startDate: Date;
      endDate: Date;
      preferredTime: string;
      preferredDayOfWeek: number;
      totalAppointments: number;
      isActive: boolean;
    }>,
    userId: string
  ) {
    const row = await prisma.schedule.findUnique({
      where: { ScheduleNum: BigInt(recurringAppointmentId) },
    });
    if (!row) {
      throw new NotFoundError('Recurring appointment not found');
    }

    const meta = parseJson<RecurringMeta>(row.Note);
    const nextMeta: RecurringMeta = {
      ...meta,
      appointmentTypeId: updates.appointmentTypeId ?? meta.appointmentTypeId,
      frequency: updates.frequency ?? meta.frequency,
      frequencyValue: updates.frequencyValue ?? meta.frequencyValue,
      startDate: updates.startDate ? updates.startDate.toISOString() : meta.startDate,
      endDate: updates.endDate ? updates.endDate.toISOString() : meta.endDate,
      preferredTime: updates.preferredTime ?? meta.preferredTime,
      preferredDayOfWeek: updates.preferredDayOfWeek ?? meta.preferredDayOfWeek,
      totalAppointments: updates.totalAppointments ?? meta.totalAppointments,
      isActive: updates.isActive ?? meta.isActive,
    };

    const data: any = {
      Note: buildJson(nextMeta),
    };
    if (updates.startDate) {
      data.SchedDate = updates.startDate;
    }
    if (updates.preferredTime) {
      data.StartTime = new Date(`1970-01-01T${updates.preferredTime}:00Z`);
    }
    if (updates.isActive !== undefined) {
      data.Status = updates.isActive ? 0 : 1;
    }

    await prisma.schedule.update({
      where: { ScheduleNum: row.ScheduleNum },
      data,
    });

    await logActivity(
      userId,
      'updated',
      'recurring_appointments',
      recurringAppointmentId,
      row,
      updates,
      undefined,
      undefined,
      'medium'
    );

    return this.getRecurringAppointmentById(recurringAppointmentId);
  }

  async deleteRecurringAppointment(recurringAppointmentId: string, userId: string) {
    const row = await prisma.schedule.findUnique({
      where: { ScheduleNum: BigInt(recurringAppointmentId) },
    });
    if (!row) {
      throw new NotFoundError('Recurring appointment not found');
    }

    await prisma.schedule.delete({ where: { ScheduleNum: row.ScheduleNum } });

    await logActivity(
      userId,
      'deleted',
      'recurring_appointments',
      recurringAppointmentId,
      row,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { deletedAppointmentsCount: 0 };
  }

  async createRecurringAppointmentWithResolution(
    data: Parameters<RecurringAppointmentService['createRecurringAppointment']>[0] & {
      appointmentOverrides?: {
        dayOfWeek: number;
        skip?: boolean;
        customDate?: string;
        customStartTime?: string;
        customEndTime?: string;
      }[];
    },
    createdBy: string
  ) {
    const result = await this.createRecurringAppointment(data, createdBy);
    const recurringAppointment = (result as any).recurringAppointment ?? result;
    const appointmentsCreated = (result as any).appointmentsCreated ?? 0;
    const skippedCount = (result as any).skippedCount ?? 0;

    return {
      recurringAppointment,
      appointmentsCreated,
      skippedCount,
      skippedAppointments: (result as any).skippedAppointments ?? [],
    };
  }

  async getLinkedAppointments(_recurringAppointmentId: string) {
    return [];
  }
}

export const recurringAppointmentService = new RecurringAppointmentService();
