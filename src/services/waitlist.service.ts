import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { appointmentService } from './appointment.service';
import { getNextId } from '../utils/opendental-ids.util';
import { mapAppointmentTypeToApi, mapPatientToApi, mapProviderToApi } from '../utils/opendental-mappers.util';
import { mapUser } from '../utils/opendental-auth.util';

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

const priorityToFKeyType = (priority?: string) => {
  switch (priority) {
    case 'urgent':
      return 2;
    case 'flexible':
      return 3;
    default:
      return 1;
  }
};

const fKeyTypeToPriority = (value?: number | null) => {
  switch (value) {
    case 2:
      return 'urgent';
    case 3:
      return 'flexible';
    default:
      return 'normal';
  }
};

const statusToResponseStatus = (status?: string) => {
  switch (status) {
    case 'called':
      return 1;
    case 'scheduled':
      return 2;
    case 'expired':
      return 3;
    default:
      return 0;
  }
};

const responseStatusToStatus = (value?: number | null) => {
  switch (value) {
    case 1:
      return 'called';
    case 2:
      return 'scheduled';
    case 3:
      return 'expired';
    default:
      return 'active';
  }
};

type AsapMeta = {
  notes?: string;
  createdBy?: string;
};

export class WaitlistService {
  /**
   * Get all waitlist entries with pagination and filters
   */
  async getAllWaitlistEntries(
    page = 1,
    limit = 10,
    filters?: {
      patientId?: string;
      providerId?: string;
      status?: string;
      priority?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.patientId) {
      where.PatNum = BigInt(filters.patientId);
    }

    if (filters?.status) {
      where.ResponseStatus = statusToResponseStatus(filters.status);
    }

    if (filters?.priority) {
      where.FKeyType = priorityToFKeyType(filters.priority);
    }

    if (filters?.dateFrom || filters?.dateTo || filters?.providerId) {
      where.schedule = {};
      if (filters?.dateFrom || filters?.dateTo) {
        where.schedule.SchedDate = {};
        if (filters.dateFrom) where.schedule.SchedDate.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.schedule.SchedDate.lte = new Date(filters.dateTo);
      }
      if (filters?.providerId) {
        where.schedule.ProvNum = BigInt(filters.providerId);
      }
    }

    const [rows, total] = await Promise.all([
      prisma.asapcomm.findMany({
        where,
        include: { schedule: true },
        orderBy: { DateTimeEntry: 'asc' },
        skip,
        take: limit,
      }),
      prisma.asapcomm.count({ where }),
    ]);

    const patientIds = rows
      .map((row) => row.PatNum)
      .filter((id): id is bigint => id !== null && id !== undefined);
    const providerIds = rows
      .map((row) => row.schedule?.ProvNum)
      .filter((id): id is bigint => id !== null && id !== undefined);
    const appointmentTypeIds = rows
      .map((row) => row.FKey)
      .filter((id): id is bigint => id !== null && id !== undefined);

    const [patients, providers, appointmentTypes] = await Promise.all([
      patientIds.length ? prisma.patient.findMany({ where: { PatNum: { in: patientIds } } }) : [],
      providerIds.length ? prisma.provider.findMany({ where: { ProvNum: { in: providerIds } }, include: { definition: true } }) : [],
      appointmentTypeIds.length ? prisma.appointmenttype.findMany({ where: { AppointmentTypeNum: { in: appointmentTypeIds } } }) : [],
    ]);
    const providerUserIds = Array.from(
      new Set(providers.map((provider) => provider.CustomID).filter((id): id is string => Boolean(id)))
    );
    const creatorIds = Array.from(
      new Set(rows.map((row) => parseJson<AsapMeta>(row.Note).createdBy).filter((id): id is string => Boolean(id)))
    );
    const userIds = Array.from(new Set([...providerUserIds, ...creatorIds]));
    const users = userIds.length
      ? await prisma.userod.findMany({ where: { UserNum: { in: userIds.map((id) => BigInt(id)) } } })
      : [];

    const { getUsersMeta } = await import('../utils/opendental-auth.util');
    const usersMeta = users.length ? await getUsersMeta(users.map((u) => u.UserNum)) : {};

    const usersMap = new Map(
      await Promise.all(
        users.map(async (user) => {
          const mappedUser = await mapUser(user, usersMeta[user.UserNum.toString()]);
          return [user.UserNum.toString(), {
            _id: mappedUser._id,
            firstName: mappedUser.firstName,
            lastName: mappedUser.lastName,
            email: mappedUser.email || null,
          }] as const;
        })
      )
    );

    const patientMap = new Map(patients.map((patient) => [patient.PatNum.toString(), patient]));
    const providerMap = new Map(providers.map((provider) => [provider.ProvNum.toString(), provider]));
    const appointmentTypeMap = new Map(appointmentTypes.map((appt) => [appt.AppointmentTypeNum.toString(), appt]));

    let waitlistEntries = rows.map((row) => {
      const meta = parseJson<AsapMeta>(row.Note);
      const schedule = row.schedule;
      const patient = row.PatNum ? patientMap.get(row.PatNum.toString()) : null;
      const provider = schedule?.ProvNum ? providerMap.get(schedule.ProvNum.toString()) : null;
      const appointmentType = row.FKey ? appointmentTypeMap.get(row.FKey.toString()) : null;

      return {
        _id: row.AsapCommNum.toString(),
        patientId: row.PatNum?.toString() ?? null,
        providerId: schedule?.ProvNum?.toString() ?? null,
        appointmentTypeId: row.FKey?.toString() ?? null,
        preferredDate: schedule?.SchedDate ?? null,
        preferredTimeStart: schedule?.StartTime ? schedule.StartTime.toISOString().substring(11, 16) : null,
        preferredTimeEnd: schedule?.StopTime ? schedule.StopTime.toISOString().substring(11, 16) : null,
        priority: fKeyTypeToPriority(row.FKeyType),
        status: responseStatusToStatus(row.ResponseStatus),
        notes: meta.notes ?? null,
        createdBy: meta.createdBy ? usersMap.get(meta.createdBy) ?? { _id: meta.createdBy, firstName: '', lastName: '', email: null } : null,
        createdAt: row.DateTimeEntry ?? null,
        updatedAt: row.DateTimeOrig ?? row.DateTimeEntry ?? null,
        patient: patient ? mapPatientToApi(patient) : null,
        provider: provider
          ? mapProviderToApi(provider, {
              specialtyName: provider.definition?.ItemName ?? null,
              userId: provider.CustomID ?? null,
              user: provider.CustomID ? usersMap.get(provider.CustomID) ?? null : null,
            })
          : null,
        appointmentType: appointmentType ? mapAppointmentTypeToApi(appointmentType) : null,
      };
    });

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      waitlistEntries = waitlistEntries.filter((entry: any) => {
        const patientName = `${entry.patient?.firstName || ''} ${entry.patient?.lastName || ''}`.toLowerCase();
        const providerName = `${entry.provider?.firstName || ''} ${entry.provider?.lastName || ''}`.toLowerCase();
        return patientName.includes(searchLower) || providerName.includes(searchLower);
      });
    }

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
    const row = await prisma.asapcomm.findUnique({
      where: { AsapCommNum: BigInt(waitlistEntryId) },
      include: { schedule: true },
    });

    if (!row) {
      throw new NotFoundError('Waitlist entry not found');
    }

    const meta = parseJson<AsapMeta>(row.Note);
    const patient = row.PatNum
      ? await prisma.patient.findUnique({ where: { PatNum: row.PatNum } })
      : null;
    const provider = row.schedule?.ProvNum
      ? await prisma.provider.findUnique({
          where: { ProvNum: row.schedule.ProvNum },
          include: { definition: true },
        })
      : null;
    const appointmentType = row.FKey
      ? await prisma.appointmenttype.findUnique({
          where: { AppointmentTypeNum: row.FKey },
        })
      : null;

    const creatorUser = meta.createdBy
      ? await prisma.userod.findUnique({ where: { UserNum: BigInt(meta.createdBy) } })
      : null;
    const mappedCreator = creatorUser ? await mapUser(creatorUser) : null;
    const providerUser = provider?.CustomID
      ? await prisma.userod.findUnique({ where: { UserNum: BigInt(provider.CustomID) } })
      : null;
    const mappedProviderUser = providerUser ? await mapUser(providerUser) : null;
    const creator = mappedCreator
      ? {
          _id: mappedCreator._id,
          firstName: mappedCreator.firstName,
          lastName: mappedCreator.lastName,
          email: mappedCreator.email || null,
        }
      : (meta.createdBy ? { _id: meta.createdBy, firstName: '', lastName: '', email: null } : null);

    return {
      _id: row.AsapCommNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      providerId: row.schedule?.ProvNum?.toString() ?? null,
      appointmentTypeId: row.FKey?.toString() ?? null,
      preferredDate: row.schedule?.SchedDate ?? null,
      preferredTimeStart: row.schedule?.StartTime ? row.schedule.StartTime.toISOString().substring(11, 16) : null,
      preferredTimeEnd: row.schedule?.StopTime ? row.schedule.StopTime.toISOString().substring(11, 16) : null,
      priority: fKeyTypeToPriority(row.FKeyType),
      status: responseStatusToStatus(row.ResponseStatus),
      notes: meta.notes ?? null,
      createdBy: creator,
      createdAt: row.DateTimeEntry ?? null,
      updatedAt: row.DateTimeOrig ?? row.DateTimeEntry ?? null,
      patient: patient ? mapPatientToApi(patient) : null,
      provider: provider
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
        : null,
      appointmentType: appointmentType ? mapAppointmentTypeToApi(appointmentType) : null,
    };
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

    if (data.preferredTimeStart && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTimeStart)) {
      throw new BadRequestError('Preferred time start must be in HH:MM format');
    }

    if (data.preferredTimeEnd && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(data.preferredTimeEnd)) {
      throw new BadRequestError('Preferred time end must be in HH:MM format');
    }

    const existingEntry = await prisma.asapcomm.findFirst({
      where: {
        PatNum: BigInt(data.patientId),
        ResponseStatus: statusToResponseStatus('active'),
      },
    });

    if (existingEntry) {
      throw new ConflictError('Patient is already on the waitlist for this provider');
    }

    const scheduleNum = await getNextId('schedule', 'ScheduleNum');
    const asapNum = await getNextId('asapcomm', 'AsapCommNum');

    const schedule = await prisma.schedule.create({
      data: {
        ScheduleNum: scheduleNum,
        SchedDate: data.preferredDate ?? null,
        StartTime: data.preferredTimeStart ? new Date(`1970-01-01T${data.preferredTimeStart}:00Z`) : null,
        StopTime: data.preferredTimeEnd ? new Date(`1970-01-01T${data.preferredTimeEnd}:00Z`) : null,
        SchedType: 0,
        ProvNum: BigInt(data.providerId),
        Status: 0,
      },
    });

    const waitlistEntry = await prisma.asapcomm.create({
      data: {
        AsapCommNum: asapNum,
        PatNum: BigInt(data.patientId),
        ScheduleNum: schedule.ScheduleNum,
        FKey: data.appointmentTypeId ? BigInt(data.appointmentTypeId) : null,
        FKeyType: priorityToFKeyType(data.priority),
        ResponseStatus: statusToResponseStatus('active'),
        DateTimeEntry: new Date(),
        DateTimeOrig: new Date(),
        Note: buildJson({
          notes: data.notes ?? null,
          createdBy,
        }),
      },
    });

    await logActivity(
      createdBy,
      'created',
      'waitlist',
      waitlistEntry.AsapCommNum.toString(),
      undefined,
      waitlistEntry,
      undefined,
      undefined,
      'low'
    );

    return this.getWaitlistEntryById(waitlistEntry.AsapCommNum.toString());
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
    const waitlistEntry = await prisma.asapcomm.findUnique({
      where: { AsapCommNum: BigInt(waitlistEntryId) },
      include: { schedule: true },
    });
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    if (updates.preferredTimeStart && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.preferredTimeStart)) {
      throw new BadRequestError('Preferred time start must be in HH:MM format');
    }

    if (updates.preferredTimeEnd && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.preferredTimeEnd)) {
      throw new BadRequestError('Preferred time end must be in HH:MM format');
    }

    const oldData = waitlistEntry;
    const meta = parseJson<AsapMeta>(waitlistEntry.Note);

    if (waitlistEntry.ScheduleNum) {
      await prisma.schedule.update({
        where: { ScheduleNum: waitlistEntry.ScheduleNum },
        data: {
          SchedDate: updates.preferredDate ?? undefined,
          StartTime: updates.preferredTimeStart
            ? new Date(`1970-01-01T${updates.preferredTimeStart}:00Z`)
            : undefined,
          StopTime: updates.preferredTimeEnd
            ? new Date(`1970-01-01T${updates.preferredTimeEnd}:00Z`)
            : undefined,
        },
      });
    }

    const updated = await prisma.asapcomm.update({
      where: { AsapCommNum: BigInt(waitlistEntryId) },
      data: {
        FKey: updates.appointmentTypeId ? BigInt(updates.appointmentTypeId) : undefined,
        FKeyType: updates.priority ? priorityToFKeyType(updates.priority) : undefined,
        ResponseStatus: updates.status ? statusToResponseStatus(updates.status) : undefined,
        Note: buildJson({
          ...meta,
          notes: updates.notes ?? meta.notes ?? null,
          createdBy: meta.createdBy ?? updatedBy,
        }),
      },
    });

    await logActivity(
      updatedBy,
      'updated',
      'waitlist',
      waitlistEntryId,
      oldData,
      updated,
      undefined,
      undefined,
      'low'
    );

    return this.getWaitlistEntryById(updated.AsapCommNum.toString());
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
    const waitlistEntry = await prisma.asapcomm.findUnique({
      where: { AsapCommNum: BigInt(waitlistEntryId) },
      include: { schedule: true },
    });

    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    if (responseStatusToStatus(waitlistEntry.ResponseStatus) === 'scheduled') {
      throw new BadRequestError('Waitlist entry is already scheduled');
    }

    const appointmentType = waitlistEntry.FKey
      ? await prisma.appointmenttype.findUnique({
          where: { AppointmentTypeNum: waitlistEntry.FKey },
        })
      : null;

    let durationMinutes = appointmentData.durationMinutes;
    if (!durationMinutes && appointmentType) {
      durationMinutes = 30;
    }
    if (!durationMinutes) durationMinutes = 30;

    const notesMeta = parseJson<AsapMeta>(waitlistEntry.Note);

    const appointmentDataPayload: any = {
      patientId: waitlistEntry.PatNum?.toString(),
      providerId: waitlistEntry.schedule?.ProvNum?.toString(),
      appointmentDate: appointmentData.appointmentDate,
      startTime: appointmentData.startTime,
      endTime: appointmentData.endTime,
      durationMinutes,
      notes: appointmentData.notes
        ? `${appointmentData.notes}\n\nCreated from waitlist entry. Original waitlist notes: ${notesMeta.notes || 'None'}`
        : `Created from waitlist entry. Original waitlist notes: ${notesMeta.notes || 'None'}`,
    };

    if (waitlistEntry.FKey) {
      appointmentDataPayload.appointmentTypeId = waitlistEntry.FKey.toString();
    }
    if (appointmentData.roomId) {
      appointmentDataPayload.roomId = appointmentData.roomId;
    }
    if (appointmentData.chiefComplaint) {
      appointmentDataPayload.chiefComplaint = appointmentData.chiefComplaint;
    }

    const appointment = await appointmentService.createAppointment(appointmentDataPayload, convertedBy);

    await this.markAsScheduled(waitlistEntryId, convertedBy);

    return {
      appointment,
      waitlistEntry: await this.getWaitlistEntryById(waitlistEntryId),
    };
  }

  /**
   * Delete waitlist entry
   */
  async deleteWaitlistEntry(waitlistEntryId: string, deletedBy: string) {
    const waitlistEntry = await prisma.asapcomm.findUnique({
      where: { AsapCommNum: BigInt(waitlistEntryId) },
    });
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    await prisma.asapcomm.delete({ where: { AsapCommNum: BigInt(waitlistEntryId) } });
    if (waitlistEntry.ScheduleNum) {
      await prisma.schedule.delete({ where: { ScheduleNum: waitlistEntry.ScheduleNum } });
    }

    await logActivity(
      deletedBy,
      'deleted',
      'waitlist',
      waitlistEntryId,
      waitlistEntry,
      undefined,
      undefined,
      undefined,
      'low'
    );

    return { message: 'Waitlist entry deleted successfully' };
  }
}

export const waitlistService = new WaitlistService();
