import { prisma } from '../config/db';
import { AppointmentService, appointmentService } from './appointment.service';
import { patientInsuranceService } from './patient-insurance.service';
import { patientFormService } from './patient-form.service';
import { notificationService } from './notification.service';
import { providerService } from './provider.service';
import { patientWorkspaceService } from './patient-workspace.service';
import { formTemplateService, type FormFieldDefinition } from './form-template.service';
import {
  getPatientMeta,
  mapUser,
  setPatientMeta,
} from '../utils/opendental-auth.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  AuthorizationError,
  BadRequestError,
  NotFoundError,
} from '../utils/error.util';
import {
  mapContactPreferenceToDb,
  mapPatientToApi,
} from '../utils/opendental-mappers.util';

type PortalMessageMeta = {
  type: 'portal_message';
  threadId: string;
  subject?: string | null;
  message: string;
  senderUserId: string;
  senderRole: 'patient' | 'doctor';
  recipientUserId?: string | null;
  providerId?: string | null;
  isRead?: boolean;
  createdAt: string;
};

type NotificationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  appointmentReminderHours: number;
};

type ProfileInsuranceInput = {
  insuranceCompanyId: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberDateOfBirth?: string;
  relationshipToPatient?: string;
  insuranceType?: string;
  effectiveDate?: string;
  expirationDate?: string;
  notes?: string;
};

type ProfileUpdateInput = {
  firstName?: string;
  lastName?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  email?: string;
  preferredLanguage?: string;
  communicationPreference?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  insurance?: ProfileInsuranceInput;
};

const parseJson = <T>(value?: string | null): T | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
};

const toIsoString = (value?: string): string | undefined => {
  if (!value) return undefined;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
};

const normalizeString = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const hasInsuranceValuesForExisting = (insurance?: ProfileInsuranceInput) => {
  if (!insurance) return false;
  return Boolean(
    normalizeString(insurance.insuranceCompanyId) ||
      normalizeString(insurance.policyNumber) ||
      normalizeString(insurance.groupNumber) ||
      normalizeString(insurance.subscriberName) ||
      normalizeString(insurance.subscriberDateOfBirth) ||
      normalizeString(insurance.relationshipToPatient) ||
      normalizeString(insurance.insuranceType) ||
      normalizeString(insurance.effectiveDate) ||
      normalizeString(insurance.expirationDate) ||
      normalizeString(insurance.notes)
  );
};

const hasInsuranceValuesForCreate = (insurance?: ProfileInsuranceInput) => {
  if (!insurance) return false;
  return Boolean(
    normalizeString(insurance.insuranceCompanyId) ||
      normalizeString(insurance.policyNumber) ||
      normalizeString(insurance.groupNumber) ||
      normalizeString(insurance.subscriberName) ||
      normalizeString(insurance.subscriberDateOfBirth) ||
      normalizeString(insurance.effectiveDate) ||
      normalizeString(insurance.expirationDate) ||
      normalizeString(insurance.notes)
  );
};

const parseTimeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return (hours || 0) * 60 + (minutes || 0);
};

const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const addMinutesToTime = (time: string, minutesToAdd: number): string => {
  return formatMinutesToTime(parseTimeToMinutes(time) + minutesToAdd);
};

export class PortalService {
  private appointmentSvc: AppointmentService;

  constructor() {
    this.appointmentSvc = appointmentService;
  }

  private async createPortalPatientProfile(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }) {
    const nextId = await getNextId('patient', 'PatNum');
    const patientCode = `PAT${nextId.toString().padStart(3, '0')}`;
    const firstName = data.firstName?.trim() || 'Patient';
    const lastName = data.lastName?.trim() || 'Portal';
    const email = data.email?.trim().toLowerCase() || null;
    const phone = data.phone?.trim() || null;

    const patient = await prisma.patient.create({
      data: {
        PatNum: nextId,
        ChartNumber: patientCode,
        FName: firstName,
        LName: lastName,
        Email: email,
        WirelessPhone: phone,
        HmPhone: phone,
        Language: 'en',
        PatStatus: 0,
      },
    });

    await setPatientMeta(patient.PatNum, {
      portalAccessEnabled: true,
      emergencyContact: null,
      referralSource: null,
      customFields: {},
    });

    return patient;
  }

  private async getPatientContext(userId: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const mappedUser = await mapUser(user);
    const userEmail = (mappedUser.email || user.UserName || '').toLowerCase().trim();

    if (!userEmail) {
      throw new NotFoundError('No email found for current user');
    }

    let patient = await prisma.patient.findFirst({
      where: { Email: { equals: userEmail } },
    });

    if (!patient) {
      patient = await this.createPortalPatientProfile({
        firstName: mappedUser.firstName ?? undefined,
        lastName: mappedUser.lastName ?? undefined,
        email: userEmail,
        phone: mappedUser.phone ?? undefined,
      });
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    if (!patientMeta.portalAccessEnabled) {
      await setPatientMeta(patient.PatNum, {
        ...patientMeta,
        portalAccessEnabled: true,
      });
    }

    const nextPatientMeta = await getPatientMeta(patient.PatNum);

    return {
      user,
      mappedUser,
      patient,
      patientMeta: nextPatientMeta,
      patientId: patient.PatNum.toString(),
    };
  }

  private async getProviderContext(userId: string) {
    const providerByUserLink = await prisma.provider.findFirst({
      where: { CustomID: userId, IsHidden: 0 },
      select: { ProvNum: true, CustomID: true },
    });

    if (providerByUserLink) {
      return {
        providerId: providerByUserLink.ProvNum.toString(),
      };
    }

    if (/^\d+$/.test(userId)) {
      const providerByProvNum = await prisma.provider.findFirst({
        where: { ProvNum: BigInt(userId), IsHidden: 0 },
        select: { ProvNum: true, CustomID: true },
      });

      if (providerByProvNum) {
        return {
          providerId: providerByProvNum.ProvNum.toString(),
        };
      }
    }

    throw new AuthorizationError('No active provider profile linked to this account');
  }

  private async assertFormOwnership(formId: string, patientId: string) {
    const form = await patientFormService.getFormById(formId);
    if (form.patientId !== patientId) {
      throw new AuthorizationError('You can only access your own forms');
    }
    return form;
  }

  private async assertProviderPatientAccess(providerId: string, patientId: string) {
    const [appointmentLink, messageLink] = await Promise.all([
      prisma.appointment.findFirst({
        where: {
          ProvNum: BigInt(providerId),
          PatNum: BigInt(patientId),
        },
        select: { AptNum: true },
      }),
      prisma.commlog.findFirst({
        where: {
          PatNum: BigInt(patientId),
          Note: { contains: `"providerId":"${providerId}"` },
        },
        select: { CommlogNum: true },
      }),
    ]);

    if (!appointmentLink && !messageLink) {
      throw new AuthorizationError('You are not authorized to access this patient context');
    }
  }

  private async ensureSlotIsAvailable(
    providerId: string,
    date: string,
    startTime: string,
    durationMinutes: number
  ) {
    const slotResult = await this.appointmentSvc.getAvailableSlots(providerId, date, durationMinutes);
    if (!slotResult.availableSlots.includes(startTime)) {
      throw new BadRequestError('Selected time slot is no longer available');
    }
  }

  private async assertAppointmentOwnership(appointmentId: string, patientId: string) {
    const appointment = await this.appointmentSvc.getAppointmentById(appointmentId);
    const appointmentPatientId =
      typeof appointment.patientId === 'string'
        ? appointment.patientId
        : appointment.patientId?._id;

    if (!appointmentPatientId || appointmentPatientId !== patientId) {
      throw new AuthorizationError('You can only manage your own appointments');
    }

    return appointment;
  }

  private parsePortalMessageNote(note?: string | null) {
    const meta = parseJson<PortalMessageMeta>(note);
    if (!meta || meta.type !== 'portal_message' || !meta.threadId) {
      return null;
    }
    return meta;
  }

  private async getNotificationPreferencesByPatient(patNum: bigint, patientMeta?: Record<string, any>) {
    const commOptOut = await prisma.commoptout.findFirst({
      where: { PatNum: patNum },
    });

    const meta = patientMeta ?? (await getPatientMeta(patNum));
    const metaPrefs = (meta.notificationPreferences ?? {}) as Partial<NotificationPreferences>;

    return {
      emailEnabled: commOptOut ? commOptOut.OptOutEmail !== 1 : true,
      smsEnabled: commOptOut ? commOptOut.OptOutSms !== 1 : true,
      inAppEnabled: metaPrefs.inAppEnabled ?? true,
      appointmentReminderHours: metaPrefs.appointmentReminderHours ?? 24,
    } satisfies NotificationPreferences;
  }

  async getMyProfile(userId: string) {
    const context = await this.getPatientContext(userId);

    const patient = mapPatientToApi(context.patient, {
      emergencyContact: context.patientMeta.emergencyContact ?? null,
      portalAccessEnabled: context.patientMeta.portalAccessEnabled ?? true,
      referralSource: context.patientMeta.referralSource ?? null,
      customFields: context.patientMeta.customFields ?? {},
    });

    const insurance = await patientInsuranceService.getPatientInsurances(context.patientId, true);
    const notificationPreferences = await this.getNotificationPreferencesByPatient(
      context.patient.PatNum,
      context.patientMeta
    );

    return {
      user: {
        _id: context.mappedUser._id,
        email: context.mappedUser.email,
        firstName: context.mappedUser.firstName,
        lastName: context.mappedUser.lastName,
      },
      patient,
      insurance,
      notificationPreferences,
    };
  }

  async updateMyProfile(userId: string, updates: ProfileUpdateInput) {
    const context = await this.getPatientContext(userId);

    await prisma.patient.update({
      where: { PatNum: context.patient.PatNum },
      data: {
        FName: updates.firstName?.trim() || undefined,
        LName: updates.lastName?.trim() || undefined,
        WirelessPhone: updates.phonePrimary?.trim() || undefined,
        HmPhone: updates.phonePrimary?.trim() || undefined,
        WkPhone: updates.phoneSecondary?.trim() || undefined,
        Email: updates.email?.trim().toLowerCase() || undefined,
        Address: updates.address?.line1?.trim() || undefined,
        Address2: updates.address?.line2?.trim() || undefined,
        City: updates.address?.city?.trim() || undefined,
        State: updates.address?.state?.trim() || undefined,
        Zip: updates.address?.postalCode?.trim() || undefined,
        Language: updates.preferredLanguage?.trim() || undefined,
        PreferContactMethod: updates.communicationPreference
          ? mapContactPreferenceToDb(updates.communicationPreference)
          : undefined,
      },
    });

    if (updates.insurance) {
      const insurance = updates.insurance;
      const existing = await patientInsuranceService.getPatientInsurances(context.patientId, true);

      if (existing.length > 0) {
        if (!hasInsuranceValuesForExisting(insurance)) {
          return this.getMyProfile(userId);
        }

        const insuranceUpdates: {
          policyNumber?: string;
          groupNumber?: string;
          subscriberName?: string;
          subscriberDateOfBirth?: Date;
          relationshipToPatient?: string;
          insuranceType?: string;
          effectiveDate?: Date;
          expirationDate?: Date;
          notes?: string;
        } = {};

        const policyNumber = normalizeString(insurance.policyNumber);
        const groupNumber = normalizeString(insurance.groupNumber);
        const subscriberName = normalizeString(insurance.subscriberName);
        const relationshipToPatient = normalizeString(insurance.relationshipToPatient);
        const insuranceType = normalizeString(insurance.insuranceType);
        const notes = normalizeString(insurance.notes);
        const subscriberDobIso = toIsoString(insurance.subscriberDateOfBirth);
        const effectiveDateIso = toIsoString(insurance.effectiveDate);
        const expirationDateIso = toIsoString(insurance.expirationDate);

        if (policyNumber) insuranceUpdates.policyNumber = policyNumber;
        if (groupNumber) insuranceUpdates.groupNumber = groupNumber;
        if (subscriberName) insuranceUpdates.subscriberName = subscriberName;
        if (relationshipToPatient) insuranceUpdates.relationshipToPatient = relationshipToPatient;
        if (insuranceType) insuranceUpdates.insuranceType = insuranceType;
        if (notes) insuranceUpdates.notes = notes;
        if (subscriberDobIso) insuranceUpdates.subscriberDateOfBirth = new Date(subscriberDobIso);
        if (effectiveDateIso) insuranceUpdates.effectiveDate = new Date(effectiveDateIso);
        if (expirationDateIso) insuranceUpdates.expirationDate = new Date(expirationDateIso);

        if (Object.keys(insuranceUpdates).length > 0) {
          await patientInsuranceService.updatePatientInsurance(
            context.patientId,
            existing[0]?._id || '',
            insuranceUpdates,
            userId
          );
        }
      } else {
        if (!hasInsuranceValuesForCreate(insurance)) {
          return this.getMyProfile(userId);
        }

        const insuranceCompanyId = normalizeString(insurance.insuranceCompanyId);
        const policyNumber = normalizeString(insurance.policyNumber);
        if (!insuranceCompanyId) {
          throw new BadRequestError('insurance.insuranceCompanyId is required to add new insurance');
        }
        if (!policyNumber) {
          throw new BadRequestError('insurance.policyNumber is required to add new insurance');
        }

        const subscriberName =
          normalizeString(insurance.subscriberName) ||
          `${context.patient.FName || ''} ${context.patient.LName || ''}`.trim();
        const subscriberDobIso = toIsoString(insurance.subscriberDateOfBirth);
        const effectiveDateIso = toIsoString(insurance.effectiveDate);
        const expirationDateIso = toIsoString(insurance.expirationDate);

        await patientInsuranceService.createPatientInsurance(
          context.patientId,
          {
            insuranceCompanyId,
            policyNumber,
            groupNumber: normalizeString(insurance.groupNumber),
            subscriberName,
            subscriberDateOfBirth: new Date(
              subscriberDobIso || context.patient.Birthdate || new Date().toISOString()
            ),
            relationshipToPatient: normalizeString(insurance.relationshipToPatient) || 'self',
            insuranceType: normalizeString(insurance.insuranceType) || 'primary',
            effectiveDate: new Date(effectiveDateIso || new Date().toISOString()),
            expirationDate: expirationDateIso ? new Date(expirationDateIso) : undefined,
            notes: normalizeString(insurance.notes),
          },
          userId
        );
      }
    }

    return this.getMyProfile(userId);
  }

  async getMyAppointments(
    userId: string,
    page = 1,
    limit = 10,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const context = await this.getPatientContext(userId);

    return this.appointmentSvc.getAllAppointments(page, limit, {
      patientId: context.patientId,
      status: filters?.status,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
  }

  async getMyAppointmentById(userId: string, appointmentId: string) {
    const context = await this.getPatientContext(userId);
    return this.assertAppointmentOwnership(appointmentId, context.patientId);
  }

  async getProviders() {
    const rows = await prisma.provider.findMany({
      where: { IsHidden: 0 },
      orderBy: [{ Abbr: 'asc' }, { ProvNum: 'asc' }],
      select: { ProvNum: true },
    });

    const providers = await Promise.all(
      rows.map((row) => providerService.getProviderById(row.ProvNum.toString()))
    );

    return providers.map((provider) => {
      const linkedUser =
        provider.userId && typeof provider.userId === 'object' ? provider.userId : null;
      const firstName = (linkedUser?.firstName || '').trim();
      const lastName = (linkedUser?.lastName || '').trim();
      const baseName = `${firstName} ${lastName}`.trim();
      const fallbackName =
        (linkedUser?.email || '').trim() ||
        (provider.providerCode || '').trim() ||
        `Provider #${provider._id}`;

      return {
        _id: provider._id,
        providerCode: provider.providerCode || null,
        firstName,
        lastName,
        name: baseName || fallbackName,
      };
    });
  }

  async getAvailableSlots(userId: string, providerId: string, date: string, durationMinutes = 30) {
    await this.getPatientContext(userId);
    return this.appointmentSvc.getAvailableSlots(providerId, date, durationMinutes);
  }

  async bookAppointment(
    userId: string,
    data: {
      providerId: string;
      appointmentTypeId?: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
      durationMinutes?: number;
      chiefComplaint?: string;
      notes?: string;
      roomId?: string;
    }
  ) {
    const context = await this.getPatientContext(userId);
    const durationMinutes =
      data.durationMinutes ??
      Math.max(5, parseTimeToMinutes(data.endTime) - parseTimeToMinutes(data.startTime));

    await this.ensureSlotIsAvailable(
      data.providerId,
      data.appointmentDate,
      data.startTime,
      durationMinutes
    );
    const endTime = data.endTime || addMinutesToTime(data.startTime, durationMinutes);

    const appointment = await this.appointmentSvc.createAppointment(
      {
        patientId: context.patientId,
        providerId: data.providerId,
        appointmentTypeId: data.appointmentTypeId,
        appointmentDate: new Date(data.appointmentDate),
        startTime: data.startTime,
        endTime,
        durationMinutes,
        chiefComplaint: data.chiefComplaint,
        notes: data.notes,
        roomId: data.roomId,
        insuranceVerified: false,
        copayCollected: 0,
        reminderSent: false,
        status: 'scheduled',
      },
      userId
    );

    await notificationService.createNotification({
      userId,
      type: 'appointment',
      title: 'Appointment booked',
      message: `Your appointment ${appointment.appointmentCode} has been scheduled.`,
      data: {
        appointmentId: appointment._id,
        appointmentDate: appointment.appointmentDate,
      },
    });

    return appointment;
  }

  async rescheduleAppointment(
    userId: string,
    appointmentId: string,
    data: {
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    }
  ) {
    const context = await this.getPatientContext(userId);
    const currentAppointment = await this.assertAppointmentOwnership(appointmentId, context.patientId);

    const providerId =
      typeof currentAppointment.providerId === 'string'
        ? currentAppointment.providerId
        : currentAppointment.providerId?._id;
    if (!providerId) {
      throw new BadRequestError('Appointment provider is missing');
    }

    if (!currentAppointment.appointmentDate) {
      throw new BadRequestError('Appointment date is missing');
    }
    const currentDate = new Date(currentAppointment.appointmentDate).toISOString().slice(0, 10);
    const sameSlot =
      currentDate === data.newDate &&
      currentAppointment.startTime === data.newStartTime &&
      currentAppointment.endTime === data.newEndTime;

    if (!sameSlot) {
      const durationMinutes =
        currentAppointment.durationMinutes ||
        Math.max(5, parseTimeToMinutes(data.newEndTime) - parseTimeToMinutes(data.newStartTime));
      await this.ensureSlotIsAvailable(providerId, data.newDate, data.newStartTime, durationMinutes);
    }

    const appointment = await this.appointmentSvc.rescheduleAppointment(
      appointmentId,
      new Date(data.newDate),
      data.newStartTime,
      data.newEndTime,
      userId
    );

    await notificationService.createNotification({
      userId,
      type: 'appointment',
      title: 'Appointment rescheduled',
      message: `Your appointment ${appointment.appointmentCode} has been rescheduled.`,
      data: {
        appointmentId: appointment._id,
        appointmentDate: appointment.appointmentDate,
      },
    });

    return appointment;
  }

  async cancelAppointment(userId: string, appointmentId: string, cancellationReason?: string) {
    const context = await this.getPatientContext(userId);
    await this.assertAppointmentOwnership(appointmentId, context.patientId);

    const appointment = await this.appointmentSvc.cancelAppointment(
      appointmentId,
      userId,
      cancellationReason
    );

    await notificationService.createNotification({
      userId,
      type: 'appointment',
      title: 'Appointment cancelled',
      message: `Your appointment ${appointment.appointmentCode} has been cancelled.`,
      data: {
        appointmentId: appointment._id,
      },
    });

    return appointment;
  }

  async getMessageThreads(userId: string) {
    const context = await this.getPatientContext(userId);
    const rows = await prisma.commlog.findMany({
      where: {
        PatNum: context.patient.PatNum,
        Note: { contains: '"type":"portal_message"' },
      },
      orderBy: { CommDateTime: 'desc' },
    });

    const threads = new Map<
      string,
      {
        _id: string;
        subject: string;
        providerId: string | null;
        lastMessage: string;
        lastMessageAt: Date | null;
        unreadCount: number;
      }
    >();

    for (const row of rows) {
      const meta = this.parsePortalMessageNote(row.Note);
      if (!meta) continue;

      const threadId = meta.threadId;
      const existing = threads.get(threadId);
      const rowDate = row.CommDateTime ?? null;
      const unreadIncrement = meta.recipientUserId === userId && !meta.isRead ? 1 : 0;

      if (!existing) {
        threads.set(threadId, {
          _id: threadId,
          subject: meta.subject || 'Conversation',
          providerId: meta.providerId || null,
          lastMessage: meta.message,
          lastMessageAt: rowDate,
          unreadCount: unreadIncrement,
        });
        continue;
      }

      if (rowDate && (!existing.lastMessageAt || rowDate > existing.lastMessageAt)) {
        existing.lastMessage = meta.message;
        existing.lastMessageAt = rowDate;
        existing.subject = meta.subject || existing.subject;
        existing.providerId = meta.providerId || existing.providerId;
      }

      existing.unreadCount += unreadIncrement;
    }

    return {
      threads: Array.from(threads.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
        const bTime = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
        return bTime - aTime;
      }),
    };
  }

  async getThreadMessages(userId: string, threadId: string) {
    const context = await this.getPatientContext(userId);
    const rows = await prisma.commlog.findMany({
      where: {
        PatNum: context.patient.PatNum,
        Note: { contains: '"type":"portal_message"' },
      },
      orderBy: { CommDateTime: 'asc' },
    });

    const messages = rows
      .map((row) => ({ row, meta: this.parsePortalMessageNote(row.Note) }))
      .filter((entry) => entry.meta && entry.meta.threadId === threadId);

    for (const message of messages) {
      if (!message.meta) continue;
      if (message.meta.recipientUserId === userId && !message.meta.isRead) {
        const nextPayload: PortalMessageMeta = {
          ...message.meta,
          isRead: true,
        };
        await prisma.commlog.update({
          where: { CommlogNum: message.row.CommlogNum },
          data: { Note: JSON.stringify(nextPayload) },
        });
      }
    }

    return {
      messages: messages.map((entry) => {
        const meta = entry.meta as PortalMessageMeta;
        return {
          _id: entry.row.CommlogNum.toString(),
          threadId: meta.threadId,
          subject: meta.subject || null,
          message: meta.message,
          senderUserId: meta.senderUserId,
          senderRole: meta.senderRole,
          recipientUserId: meta.recipientUserId || null,
          providerId: meta.providerId || null,
          isRead: meta.isRead ?? false,
          createdAt: entry.row.CommDateTime ?? new Date(meta.createdAt),
        };
      }),
    };
  }

  async sendMessage(
    userId: string,
    data: {
      providerId?: string;
      providerIds?: string[];
      subject?: string;
      message: string;
      threadId?: string;
    }
  ) {
    const context = await this.getPatientContext(userId);
    const providerIdsFromPayload = new Set<string>();
    if (data.providerId?.trim()) {
      providerIdsFromPayload.add(data.providerId.trim());
    }
    for (const providerId of data.providerIds || []) {
      const normalized = providerId?.trim();
      if (normalized) providerIdsFromPayload.add(normalized);
    }

    const existingThreadId = data.threadId?.trim() || null;
    if (existingThreadId) {
      const threadRows = await prisma.commlog.findMany({
        where: {
          PatNum: context.patient.PatNum,
          Note: { contains: `"threadId":"${existingThreadId}"` },
        },
        orderBy: { CommDateTime: 'asc' },
      });

      const threadMessages = threadRows
        .map((row) => this.parsePortalMessageNote(row.Note))
        .filter(
          (meta): meta is PortalMessageMeta =>
            Boolean(meta && meta.type === 'portal_message' && meta.threadId === existingThreadId)
        );

      if (!threadMessages.length) {
        throw new NotFoundError('Thread not found');
      }

      const threadProviderId = threadMessages[threadMessages.length - 1]?.providerId || null;
      if (!threadProviderId) {
        throw new BadRequestError('Thread provider is missing');
      }

      if (providerIdsFromPayload.size === 0) {
        providerIdsFromPayload.add(threadProviderId);
      }

      if (
        providerIdsFromPayload.size !== 1 ||
        !providerIdsFromPayload.has(threadProviderId)
      ) {
        throw new BadRequestError('Thread replies can only target the original provider');
      }
    }

    if (providerIdsFromPayload.size === 0) {
      throw new BadRequestError('providerId, providerIds, or threadId is required');
    }

    const targetProviderIds = Array.from(providerIdsFromPayload);
    const providers = await prisma.provider.findMany({
      where: { ProvNum: { in: targetProviderIds.map((id) => BigInt(id)) } },
      select: {
        ProvNum: true,
        FName: true,
        LName: true,
        CustomID: true,
      },
    });
    const providersById = new Map(providers.map((provider) => [provider.ProvNum.toString(), provider]));

    for (const providerId of targetProviderIds) {
      if (!providersById.has(providerId)) {
        throw new NotFoundError(`Provider ${providerId} not found`);
      }
    }

    const createdMessages = [];
    for (const providerId of targetProviderIds) {
      const provider = providersById.get(providerId);
      if (!provider) continue;

      const threadId =
        existingThreadId ||
        `thread-${providerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const recipientUserId = provider.CustomID ? provider.CustomID.toString() : null;

      const payload: PortalMessageMeta = {
        type: 'portal_message',
        threadId,
        subject: data.subject?.trim() || 'Patient message',
        message: data.message,
        senderUserId: userId,
        senderRole: 'patient',
        recipientUserId,
        providerId: provider.ProvNum.toString(),
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const commlogNum = await getNextId('commlog', 'CommlogNum');
      const created = await prisma.commlog.create({
        data: {
          CommlogNum: commlogNum,
          PatNum: context.patient.PatNum,
          UserNum: BigInt(userId),
          CommDateTime: new Date(),
          DateTEntry: new Date(),
          SentOrReceived: 1,
          Mode_: 3,
          Note: JSON.stringify(payload),
        },
      });

      if (recipientUserId) {
        await notificationService.createNotification({
          userId: recipientUserId,
          type: 'portal_message',
          title: 'New patient message',
          message: `${context.patient.FName || 'Patient'} ${context.patient.LName || ''}: ${payload.subject}`,
          data: {
            threadId,
            patientId: context.patientId,
            providerId: provider.ProvNum.toString(),
          },
        });
      }

      createdMessages.push({
        _id: created.CommlogNum.toString(),
        threadId,
        subject: payload.subject,
        message: payload.message,
        senderUserId: userId,
        senderRole: 'patient',
        recipientUserId,
        providerId: provider.ProvNum.toString(),
        isRead: false,
        createdAt: created.CommDateTime,
      });
    }

    return createdMessages;
  }

  async getMyForms(userId: string, page = 1, limit = 10) {
    const context = await this.getPatientContext(userId);
    return patientFormService.getAllForms(page, limit, context.patientId);
  }

  async getPendingForms(userId: string) {
    const context = await this.getPatientContext(userId);
    const submitted = await patientFormService.getAllForms(1, 200, context.patientId);
    const updateRequests = await patientWorkspaceService.getUpdateRequests(context.patientId);
    const activeTemplates = await formTemplateService.getAllTemplates();

    const submittedTemplateIds = new Set(
      (submitted.forms || [])
        .map((form) => form.templateId)
        .filter((templateId): templateId is string => Boolean(templateId))
    );

    const requestedForms = (updateRequests.updateRequests || [])
      .filter((request: any) => request.status === 'pending')
      .flatMap((request: any) =>
        (request.sections || []).map((section: string) => ({
          templateId: section,
          name: section
            .split('-')
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          description: `Requested by office on ${new Date(request.sentAt).toLocaleDateString()}`,
          requestId: request._id,
          sourceSection: section,
        }))
      );

    return {
      pendingForms: [
        ...activeTemplates
          .filter((template) => !submittedTemplateIds.has(template.templateId))
          .map((template) => ({
            templateId: template.templateId,
            name: template.name,
            description: template.description ?? '',
          })),
        ...requestedForms,
      ],
    };
  }

  async submitForm(
    userId: string,
    data: {
      templateId?: string;
      requestId?: string;
      sourceSection?: string;
      formData: Record<string, unknown>;
    },
    requestMeta?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const context = await this.getPatientContext(userId);

    // Snapshot the template's fields as they exist right now — this is the audit
    // trail proof of what the patient actually saw and signed, and survives later
    // edits to the template itself. templateId isn't always a real formtemplate row
    // (e.g. ad-hoc update-request sections), so a missing template just means no
    // snapshot rather than a failed submission.
    let templateFieldsSnapshot: FormFieldDefinition[] | null = null;
    if (data.templateId) {
      try {
        const template = await formTemplateService.getTemplateByTemplateId(data.templateId);
        templateFieldsSnapshot = template.fields;
      } catch {
        templateFieldsSnapshot = null;
      }
    }

    const form = await patientFormService.createForm({
      patientId: context.patientId,
      templateId: data.templateId,
      formData: data.formData,
      requestId: data.requestId,
      sourceSection: data.sourceSection,
      submittedByRole: 'patient',
      ipAddress: requestMeta?.ipAddress ?? null,
      userAgent: requestMeta?.userAgent ?? null,
      templateFieldsSnapshot,
    });

    if (data.requestId) {
      await patientWorkspaceService.markUpdateRequestSubmitted(
        context.patientId,
        data.requestId,
        form._id,
        userId
      );
    }

    await notificationService.createNotification({
      userId,
      type: 'portal_form',
      title: 'Form submitted',
      message: 'Your intake form has been submitted successfully.',
      data: { formId: form._id, templateId: data.templateId },
    });

    return form;
  }

  async getMyFormById(userId: string, formId: string) {
    const context = await this.getPatientContext(userId);
    return this.assertFormOwnership(formId, context.patientId);
  }

  async updateMyForm(
    userId: string,
    formId: string,
    data: {
      templateId?: string;
      requestId?: string;
      sourceSection?: string;
      formData: Record<string, unknown>;
    }
  ) {
    const context = await this.getPatientContext(userId);
    await this.assertFormOwnership(formId, context.patientId);

    const form = await patientFormService.updateForm(formId, {
      templateId: data.templateId,
      formData: data.formData,
      requestId: data.requestId,
      sourceSection: data.sourceSection,
      submittedByRole: 'patient',
    });

    if (data.requestId) {
      await patientWorkspaceService.markUpdateRequestSubmitted(
        context.patientId,
        data.requestId,
        form._id,
        userId
      );
    }

    return form;
  }

  async getProviderMessageThreads(userId: string) {
    const context = await this.getProviderContext(userId);
    const rows = await prisma.commlog.findMany({
      where: {
        Note: {
          contains: `"providerId":"${context.providerId}"`,
        },
      },
      orderBy: { CommDateTime: 'desc' },
    });

    const patientIds = Array.from(
      new Set(
        rows
          .map((row) => row.PatNum?.toString())
          .filter((id): id is string => Boolean(id))
      )
    );

    const patients = patientIds.length
      ? await prisma.patient.findMany({
          where: { PatNum: { in: patientIds.map((id) => BigInt(id)) } },
          select: { PatNum: true, FName: true, LName: true, Email: true },
        })
      : [];

    const patientMap = new Map(
      patients.map((patient) => [
        patient.PatNum.toString(),
        {
          _id: patient.PatNum.toString(),
          firstName: patient.FName || '',
          lastName: patient.LName || '',
          email: patient.Email || null,
        },
      ])
    );

    const threads = new Map<
      string,
      {
        _id: string;
        subject: string;
        providerId: string;
        patientId: string | null;
        patient: { _id: string; firstName: string; lastName: string; email: string | null } | null;
        lastMessage: string;
        lastMessageAt: Date | null;
        unreadCount: number;
      }
    >();

    for (const row of rows) {
      const meta = this.parsePortalMessageNote(row.Note);
      if (!meta || meta.providerId !== context.providerId) continue;

      const threadId = meta.threadId;
      const existing = threads.get(threadId);
      const rowDate = row.CommDateTime ?? null;
      const unreadIncrement = meta.recipientUserId === userId && !meta.isRead ? 1 : 0;
      const patientId = row.PatNum?.toString() ?? null;
      const patient = patientId ? patientMap.get(patientId) ?? null : null;

      if (!existing) {
        threads.set(threadId, {
          _id: threadId,
          subject: meta.subject || 'Conversation',
          providerId: context.providerId,
          patientId,
          patient,
          lastMessage: meta.message,
          lastMessageAt: rowDate,
          unreadCount: unreadIncrement,
        });
        continue;
      }

      if (rowDate && (!existing.lastMessageAt || rowDate > existing.lastMessageAt)) {
        existing.lastMessage = meta.message;
        existing.lastMessageAt = rowDate;
        existing.subject = meta.subject || existing.subject;
      }

      if (!existing.patient && patient) {
        existing.patient = patient;
        existing.patientId = patientId;
      }

      existing.unreadCount += unreadIncrement;
    }

    return {
      threads: Array.from(threads.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
        const bTime = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
        return bTime - aTime;
      }),
    };
  }

  async getProviderThreadMessages(userId: string, threadId: string) {
    const context = await this.getProviderContext(userId);
    const rows = await prisma.commlog.findMany({
      where: {
        Note: { contains: `"providerId":"${context.providerId}"` },
      },
      orderBy: { CommDateTime: 'asc' },
    });

    const messages = rows
      .map((row) => ({ row, meta: this.parsePortalMessageNote(row.Note) }))
      .filter(
        (entry) =>
          entry.meta &&
          entry.meta.providerId === context.providerId &&
          entry.meta.threadId === threadId
      );

    if (!messages.length) {
      throw new NotFoundError('Thread not found');
    }

    for (const message of messages) {
      if (!message.meta) continue;
      if (message.meta.recipientUserId === userId && !message.meta.isRead) {
        const nextPayload: PortalMessageMeta = {
          ...message.meta,
          isRead: true,
        };
        await prisma.commlog.update({
          where: { CommlogNum: message.row.CommlogNum },
          data: { Note: JSON.stringify(nextPayload) },
        });
      }
    }

    return {
      messages: messages.map((entry) => {
        const meta = entry.meta as PortalMessageMeta;
        return {
          _id: entry.row.CommlogNum.toString(),
          threadId: meta.threadId,
          subject: meta.subject || null,
          message: meta.message,
          senderUserId: meta.senderUserId,
          senderRole: meta.senderRole,
          recipientUserId: meta.recipientUserId || null,
          providerId: meta.providerId || null,
          patientId: entry.row.PatNum?.toString() ?? null,
          isRead: meta.isRead ?? false,
          createdAt: entry.row.CommDateTime ?? new Date(meta.createdAt),
        };
      }),
    };
  }

  async replyToProviderThread(
    userId: string,
    data: {
      threadId: string;
      message: string;
      subject?: string;
    }
  ) {
    const context = await this.getProviderContext(userId);

    const rows = await prisma.commlog.findMany({
      where: {
        Note: { contains: `"providerId":"${context.providerId}"` },
      },
      orderBy: { CommDateTime: 'asc' },
    });

    const threadMessages = rows
      .map((row) => ({ row, meta: this.parsePortalMessageNote(row.Note) }))
      .filter(
        (entry) =>
          entry.meta &&
          entry.meta.providerId === context.providerId &&
          entry.meta.threadId === data.threadId
      );

    if (!threadMessages.length) {
      throw new NotFoundError('Thread not found');
    }

    const firstMessage = threadMessages[0];
    const latestMessage = threadMessages[threadMessages.length - 1];
    const patientUserId =
      threadMessages.find((entry) => entry.meta?.senderRole === 'patient')?.meta?.senderUserId || null;
    const patNum = firstMessage?.row.PatNum;

    if (!patNum) {
      throw new NotFoundError('Patient context not found for this thread');
    }

    const payload: PortalMessageMeta = {
      type: 'portal_message',
      threadId: data.threadId,
      subject: data.subject?.trim() || latestMessage?.meta?.subject || 'Provider reply',
      message: data.message,
      senderUserId: userId,
      senderRole: 'doctor',
      recipientUserId: patientUserId,
      providerId: context.providerId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const commlogNum = await getNextId('commlog', 'CommlogNum');
    const created = await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: patNum,
        UserNum: BigInt(userId),
        CommDateTime: new Date(),
        DateTEntry: new Date(),
        SentOrReceived: 0,
        Mode_: 3,
        Note: JSON.stringify(payload),
      },
    });

    if (patientUserId) {
      await notificationService.createNotification({
        userId: patientUserId,
        type: 'portal_message',
        title: 'New provider message',
        message: payload.subject || 'Provider message',
        data: {
          threadId: data.threadId,
          providerId: context.providerId,
        },
      });
    }

    return {
      _id: created.CommlogNum.toString(),
      threadId: payload.threadId,
      subject: payload.subject || null,
      message: payload.message,
      senderUserId: payload.senderUserId,
      senderRole: payload.senderRole,
      recipientUserId: payload.recipientUserId || null,
      providerId: payload.providerId || null,
      patientId: patNum.toString(),
      isRead: payload.isRead ?? false,
      createdAt: created.CommDateTime,
    };
  }

  async getProviderPatientContext(userId: string, patientId: string) {
    const context = await this.getProviderContext(userId);
    await this.assertProviderPatientAccess(context.providerId, patientId);

    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const mappedPatient = mapPatientToApi(patient, {
      emergencyContact: patientMeta.emergencyContact ?? null,
      portalAccessEnabled: patientMeta.portalAccessEnabled ?? false,
      referralSource: patientMeta.referralSource ?? null,
      customFields: patientMeta.customFields ?? {},
    });

    const [appointmentsRes, formsRes, clinicalRows] = await Promise.all([
      this.appointmentSvc.getAllAppointments(1, 10, {
        patientId,
        providerId: context.providerId,
      }),
      patientFormService.getAllForms(1, 10, patientId),
      prisma.commlog.findMany({
        where: {
          PatNum: BigInt(patientId),
          Note: { contains: `"providerId":"${context.providerId}"` },
        },
        orderBy: { CommDateTime: 'desc' },
        take: 30,
      }),
    ]);

    const clinicalNotes = clinicalRows
      .map((row) => {
        const meta = parseJson<Record<string, unknown>>(row.Note);
        if (!meta || typeof meta !== 'object') return null;

        const noteType = typeof meta.noteType === 'string' ? meta.noteType : '';
        if (!noteType.trim()) return null;
        const chiefComplaint =
          typeof meta.chiefComplaint === 'string' ? meta.chiefComplaint : null;
        const appointmentId =
          typeof meta.appointmentId === 'string' ? meta.appointmentId : null;
        const providerId = typeof meta.providerId === 'string' ? meta.providerId : null;
        const signedAtRaw = typeof meta.signedAt === 'string' ? meta.signedAt : null;
        const signedAt = signedAtRaw ? new Date(signedAtRaw) : null;

        const summary =
          String(chiefComplaint || '').trim() ||
          String(meta.assessment || '').trim() ||
          String(meta.subjective || '').trim() ||
          String(meta.objective || '').trim() ||
          String(meta.plan || '').trim();

        return {
          _id: row.CommlogNum.toString(),
          patientId: row.PatNum?.toString() ?? null,
          appointmentId,
          providerId,
          noteType,
          chiefComplaint,
          isSigned: Boolean(meta.isSigned),
          signedAt,
          createdAt: row.CommDateTime ?? null,
          summary: summary || 'Clinical note',
        };
      })
      .filter((note): note is NonNullable<typeof note> => Boolean(note))
      .slice(0, 10);

    return {
      patient: mappedPatient,
      appointments: appointmentsRes.appointments || [],
      forms: formsRes.forms || [],
      clinicalNotes,
    };
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    return notificationService.getAllNotifications(userId, page, limit);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const row = await prisma.securitylog.findUnique({
      where: { SecurityLogNum: BigInt(notificationId) },
    });

    if (!row || row.UserNum?.toString() !== userId) {
      throw new NotFoundError('Notification not found');
    }

    await notificationService.markAsRead(notificationId);
    return { message: 'Notification marked as read' };
  }

  async getNotificationPreferences(userId: string) {
    const context = await this.getPatientContext(userId);
    const preferences = await this.getNotificationPreferencesByPatient(
      context.patient.PatNum,
      context.patientMeta
    );

    return { preferences };
  }

  async updateNotificationPreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ) {
    const context = await this.getPatientContext(userId);

    const existing = await prisma.commoptout.findFirst({
      where: { PatNum: context.patient.PatNum },
    });

    const nextEmailEnabled = updates.emailEnabled ?? (existing ? existing.OptOutEmail !== 1 : true);
    const nextSmsEnabled = updates.smsEnabled ?? (existing ? existing.OptOutSms !== 1 : true);

    if (existing) {
      await prisma.commoptout.update({
        where: { CommOptOutNum: existing.CommOptOutNum },
        data: {
          OptOutEmail: nextEmailEnabled ? 0 : 1,
          OptOutSms: nextSmsEnabled ? 0 : 1,
        },
      });
    } else {
      const nextId = await getNextId('commoptout', 'CommOptOutNum');
      await prisma.commoptout.create({
        data: {
          CommOptOutNum: nextId,
          PatNum: context.patient.PatNum,
          OptOutEmail: nextEmailEnabled ? 0 : 1,
          OptOutSms: nextSmsEnabled ? 0 : 1,
        },
      });
    }

    const currentMeta = await getPatientMeta(context.patient.PatNum);
    const currentPrefs = (currentMeta.notificationPreferences ?? {}) as Record<string, unknown>;

    await setPatientMeta(context.patient.PatNum, {
      ...currentMeta,
      notificationPreferences: {
        ...currentPrefs,
        inAppEnabled: updates.inAppEnabled ?? (currentPrefs.inAppEnabled ?? true),
        appointmentReminderHours:
          updates.appointmentReminderHours ??
          (typeof currentPrefs.appointmentReminderHours === 'number'
            ? currentPrefs.appointmentReminderHours
            : 24),
      },
    });

    return this.getNotificationPreferences(userId);
  }
}

export const portalService = new PortalService();
