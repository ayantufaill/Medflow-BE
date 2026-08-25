import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { createCommlogJson, getCommlogJsonEntries } from '../utils/commlog-json.util';
import { getPatientMeta, mapUser, setPatientMeta } from '../utils/opendental-auth.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';
import { patientFormService } from './patient-form.service';
import { clinicalNoteService } from './clinical-note.service';
import { documentService } from './document.service';
import { getFamilyMembers } from './patient.service';

type UpdateRequestSection =
  | 'demographics'
  | 'medical-history'
  | 'dental-history'
  | 'hipaa'
  | 'consent'
  | 'custom-form';

type UpdateRequestMeta = {
  type: 'patient_update_request';
  requestId: string;
  patientId: string;
  sections: UpdateRequestSection[];
  status: 'pending' | 'submitted' | 'partially_applied' | 'applied';
  sentAt: string;
  sentBy: string;
  note?: string | null;
  formIds?: string[];
  appliedAt?: string | null;
  appliedBy?: string | null;
  submittedAt?: string | null;
};

type PatientAuditMeta = {
  type: 'patient_audit_event';
  eventId: string;
  patientId: string;
  action: string;
  source: 'office' | 'portal' | 'reconciliation' | 'system';
  actorUserId?: string | null;
  section: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedAt: string;
};

type CommunicationMeta = {
  type: 'patient_communication';
  communicationId: string;
  patientId: string;
  appointmentId?: string | null;
  channel: 'text' | 'email' | 'call_note' | 'review_request' | 'welcome' | 'portal_invite' | 'quick_payment' | 'update_request';
  subject?: string | null;
  message: string;
  status: 'queued' | 'sent' | 'delivered' | 'read';
  createdBy: string;
  createdAt: string;
};

type ReportSnapshotMeta = {
  type: 'patient_report_snapshot';
  patientId: string;
  snapshotId: string;
  reportType: 'summary' | 'showcase' | 'concerns';
  createdAt: string;
  data: Record<string, unknown>;
};

const normalizeText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const toIsoString = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const uniq = <T>(values: T[]) => Array.from(new Set(values));

export class PatientWorkspaceService {
  private async requirePatient(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
      include: {
        patplan: {
          include: {
            inssub: {
              include: {
                insplan: {
                  include: {
                    carrier: true,
                  },
                },
              },
            },
          },
        },
        appointment: true,
        procedurelog: {
          where: {
            ProcStatus: { in: [1, 2] },
          },
        },
      },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }
    return patient;
  }

  private async resolveActor(userId?: string | null) {
    if (!userId) return null;
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) return null;
    const mapped = await mapUser(user);
    return {
      _id: mapped._id,
      firstName: mapped.firstName || mapped.email || '',
      lastName: mapped.lastName || '',
      email: mapped.email || null,
    };
  }

  private async resolveActors(userIds: string[]) {
    if (userIds.length === 0) return new Map();
    const bigintIds = userIds.map((id) => BigInt(id));
    const users = await prisma.userod.findMany({
      where: { UserNum: { in: bigintIds } },
    });
    const userNums = users.map((u) => u.UserNum);
    const { getUsersMeta } = await import('../utils/opendental-auth.util');
    const usersMeta = await getUsersMeta(userNums);

    const mappedActors = await Promise.all(
      users.map(async (user) => {
        const mapped = await mapUser(user, usersMeta[user.UserNum.toString()]);
        return [
          user.UserNum.toString(),
          {
            _id: mapped._id,
            firstName: mapped.firstName || mapped.email || '',
            lastName: mapped.lastName || '',
            email: mapped.email || null,
          },
        ] as const;
      })
    );
    return new Map(mappedActors);
  }

  async getPatientWorkspace(patientId: string) {
    const patient = await this.requirePatient(patientId);
    const patientMeta = await getPatientMeta(patient.PatNum);
    const actualGuarantorId = (patient.Guarantor && patient.Guarantor > 0n) ? patient.Guarantor : patient.PatNum;
    const household = await getFamilyMembers(actualGuarantorId, patient.PatNum);
    return mapPatientToApi(patient, {
      emergencyContact: patientMeta.emergencyContact ?? null,
      portalAccessEnabled: patientMeta.portalAccessEnabled ?? false,
      referralSource: patientMeta.referralSource ?? null,
      customFields: patientMeta.customFields ?? {},
      preferredDentistId: patientMeta.preferredDentistId ?? null,
      preferredHygienistId: patientMeta.preferredHygienistId ?? null,
      headOfCommunication: patientMeta.headOfCommunication ?? null,
      household: household,
      spouseInfo: patientMeta.spouseInfo ?? null,
      patientFlags: patientMeta.patientFlags ?? [],
      medicalAlerts: patientMeta.medicalAlerts ?? [],
      financialResponsibility: patientMeta.financialResponsibility ?? null,
      sexAtBirth: patientMeta.sexAtBirth ?? null,
      genderIdentity: patientMeta.genderIdentity ?? null,
      maritalStatus: patientMeta.maritalStatus ?? null,
      occupation: patientMeta.occupation ?? null,
      employer: patientMeta.employer ?? null,
      guardianEmployer: patientMeta.guardianEmployer ?? null,
      workAddress: patientMeta.workAddress ?? null,
      patientProfileType: patientMeta.patientProfileType ?? 'adult',
      medicalHistory: patientMeta.medicalHistory ?? null,
      communicationPreference: patientMeta.communicationPreference ?? undefined,
      assignmentAndRelease: patientMeta.assignmentAndRelease ?? null,
    } as any);
  }

  async updatePatientWorkspaceMeta(
    patientId: string,
    updates: {
      preferredDentistId?: string | null;
      preferredHygienistId?: string | null;
      headOfCommunication?: Record<string, unknown> | null;
      household?: Array<Record<string, unknown>>;
      spouseInfo?: Record<string, unknown> | null;
      patientFlags?: string[];
      medicalAlerts?: string[];
      financialResponsibility?: Record<string, unknown> | null;
      referralSource?: string | null;
      sexAtBirth?: string | null;
      genderIdentity?: string | null;
      maritalStatus?: string | null;
      occupation?: string | null;
      employer?: string | null;
      guardianEmployer?: string | null;
      workAddress?: Record<string, unknown> | null;
      patientProfileType?: string | null;
    },
    updatedBy: string
  ) {
    const patient = await this.requirePatient(patientId);
    const currentMeta = await getPatientMeta(patient.PatNum);
    const nextMeta = {
      ...currentMeta,
      preferredDentistId:
        updates.preferredDentistId !== undefined
          ? updates.preferredDentistId
          : currentMeta.preferredDentistId ?? null,
      preferredHygienistId:
        updates.preferredHygienistId !== undefined
          ? updates.preferredHygienistId
          : currentMeta.preferredHygienistId ?? null,
      headOfCommunication:
        updates.headOfCommunication !== undefined
          ? updates.headOfCommunication
          : currentMeta.headOfCommunication ?? null,
      household: updates.household ?? currentMeta.household ?? [],
      spouseInfo:
        updates.spouseInfo !== undefined ? updates.spouseInfo : currentMeta.spouseInfo ?? null,
      patientFlags: updates.patientFlags ?? currentMeta.patientFlags ?? [],
      medicalAlerts: updates.medicalAlerts ?? currentMeta.medicalAlerts ?? [],
      financialResponsibility:
        updates.financialResponsibility !== undefined
          ? updates.financialResponsibility
          : currentMeta.financialResponsibility ?? null,
      referralSource:
        updates.referralSource !== undefined
          ? normalizeText(updates.referralSource)
          : currentMeta.referralSource ?? null,
      sexAtBirth:
        updates.sexAtBirth !== undefined ? updates.sexAtBirth : currentMeta.sexAtBirth ?? null,
      genderIdentity:
        updates.genderIdentity !== undefined
          ? updates.genderIdentity
          : currentMeta.genderIdentity ?? null,
      maritalStatus:
        updates.maritalStatus !== undefined
          ? normalizeText(updates.maritalStatus)
          : currentMeta.maritalStatus ?? null,
      occupation:
        updates.occupation !== undefined
          ? normalizeText(updates.occupation)
          : currentMeta.occupation ?? null,
      employer:
        updates.employer !== undefined ? normalizeText(updates.employer) : currentMeta.employer ?? null,
      guardianEmployer:
        updates.guardianEmployer !== undefined
          ? normalizeText(updates.guardianEmployer)
          : currentMeta.guardianEmployer ?? null,
      workAddress:
        updates.workAddress !== undefined ? updates.workAddress : currentMeta.workAddress ?? null,
      patientProfileType:
        updates.patientProfileType !== undefined
          ? updates.patientProfileType
          : currentMeta.patientProfileType ?? 'adult',
    };
    await setPatientMeta(patient.PatNum, nextMeta);

    await this.recordAuditEvent(patientId, {
      action: 'workspace_meta_updated',
      source: 'office',
      actorUserId: updatedBy,
      section: 'workspace_meta',
      oldValue: {
        preferredDentistId: currentMeta.preferredDentistId ?? null,
        preferredHygienistId: currentMeta.preferredHygienistId ?? null,
        headOfCommunication: currentMeta.headOfCommunication ?? null,
        household: currentMeta.household ?? [],
        spouseInfo: currentMeta.spouseInfo ?? null,
        patientFlags: currentMeta.patientFlags ?? [],
        medicalAlerts: currentMeta.medicalAlerts ?? [],
        financialResponsibility: currentMeta.financialResponsibility ?? null,
        referralSource: currentMeta.referralSource ?? null,
        sexAtBirth: currentMeta.sexAtBirth ?? null,
        genderIdentity: currentMeta.genderIdentity ?? null,
        maritalStatus: currentMeta.maritalStatus ?? null,
        occupation: currentMeta.occupation ?? null,
        employer: currentMeta.employer ?? null,
        guardianEmployer: currentMeta.guardianEmployer ?? null,
        workAddress: currentMeta.workAddress ?? null,
        patientProfileType: currentMeta.patientProfileType ?? 'adult',
      },
      newValue: {
        preferredDentistId: nextMeta.preferredDentistId,
        preferredHygienistId: nextMeta.preferredHygienistId,
        headOfCommunication: nextMeta.headOfCommunication,
        household: nextMeta.household,
        spouseInfo: nextMeta.spouseInfo,
        patientFlags: nextMeta.patientFlags,
        medicalAlerts: nextMeta.medicalAlerts,
        financialResponsibility: nextMeta.financialResponsibility,
        referralSource: nextMeta.referralSource,
        sexAtBirth: nextMeta.sexAtBirth,
        genderIdentity: nextMeta.genderIdentity,
        maritalStatus: nextMeta.maritalStatus,
        occupation: nextMeta.occupation,
        employer: nextMeta.employer,
        guardianEmployer: nextMeta.guardianEmployer,
        workAddress: nextMeta.workAddress,
        patientProfileType: nextMeta.patientProfileType,
      },
    });

    return this.getPatientWorkspace(patientId);
  }

  async createUpdateRequest(
    patientId: string,
    data: {
      sections: UpdateRequestSection[];
      note?: string;
    },
    sentBy: string
  ) {
    await this.requirePatient(patientId);
    const requestId = `pur-${Date.now()}`;
    const payload: UpdateRequestMeta = {
      type: 'patient_update_request',
      requestId,
      patientId,
      sections: uniq((data.sections || []).filter(Boolean)),
      status: 'pending',
      sentAt: new Date().toISOString(),
      sentBy,
      note: normalizeText(data.note),
      formIds: [],
      appliedAt: null,
      appliedBy: null,
      submittedAt: null,
    };

    await createCommlogJson({
      patientId,
      userId: sentBy,
      payload,
      note: payload.note,
    });

    await this.recordAuditEvent(patientId, {
      action: 'update_request_sent',
      source: 'office',
      actorUserId: sentBy,
      section: 'update_request',
      newValue: payload,
    });

    return this.getUpdateRequests(patientId);
  }

  async markUpdateRequestSubmitted(
    patientId: string,
    requestId: string,
    formId: string,
    submittedBy: string
  ) {
    await this.requirePatient(patientId);
    const requestEntries = await getCommlogJsonEntries<UpdateRequestMeta>({
      patientId,
      contains: `"requestId":"${requestId}"`,
    });
    const requestEntry = requestEntries.find(({ meta }) => meta.requestId === requestId);
    if (!requestEntry) {
      throw new NotFoundError('Update request not found');
    }

    const currentFormIds = requestEntry.meta.formIds ?? [];
    const nextStatus =
      requestEntry.meta.sections.length <= 1 ||
      currentFormIds.includes(formId) ||
      currentFormIds.length + 1 >= requestEntry.meta.sections.length
        ? 'submitted'
        : 'pending';

    await prisma.commlog.update({
      where: { CommlogNum: requestEntry.row.CommlogNum },
      data: {
        Note: JSON.stringify({
          ...requestEntry.meta,
          status: nextStatus,
          submittedAt: new Date().toISOString(),
          formIds: uniq([...currentFormIds, formId]),
        } satisfies UpdateRequestMeta),
      },
    });

    await this.recordAuditEvent(patientId, {
      action: 'update_request_submitted',
      source: 'portal',
      actorUserId: submittedBy,
      section: 'update_request',
      newValue: {
        requestId,
        formId,
        status: nextStatus,
      },
    });
  }

  async getUpdateRequests(patientId: string) {
    await this.requirePatient(patientId);
    const entries = await getCommlogJsonEntries<UpdateRequestMeta>({
      patientId,
      contains: '"type":"patient_update_request"',
    });

    const actorIds = uniq(
      entries
        .flatMap(({ meta }) => [meta.sentBy, meta.appliedBy].filter(Boolean) as string[])
    );
    const actorMap = await this.resolveActors(actorIds);

    return {
      updateRequests: entries.map(({ meta, row }) => ({
        _id: meta.requestId,
        patientId,
        sections: meta.sections ?? [],
        status: meta.status ?? 'pending',
        note: meta.note ?? null,
        sentAt: meta.sentAt ?? toIsoString(row.CommDateTime),
        sentBy: meta.sentBy ? actorMap.get(meta.sentBy) ?? { _id: meta.sentBy } : null,
        formIds: meta.formIds ?? [],
        submittedAt: meta.submittedAt ?? null,
        appliedAt: meta.appliedAt ?? null,
        appliedBy: meta.appliedBy ? actorMap.get(meta.appliedBy) ?? { _id: meta.appliedBy } : null,
      })),
    };
  }

  async getReconciliation(patientId: string, requestId: string) {
    const patient = await this.requirePatient(patientId);
    const patientMeta = await getPatientMeta(patient.PatNum);
    const requestEntries = await getCommlogJsonEntries<UpdateRequestMeta>({
      patientId,
      contains: `"requestId":"${requestId}"`,
    });
    const request = requestEntries.find(({ meta }) => meta.requestId === requestId)?.meta;
    if (!request) {
      throw new NotFoundError('Update request not found');
    }

    const forms = await patientFormService.getAllForms(1, 200, patientId);
    const matchingForms = (forms.forms || []).filter((form: any) => {
      const templateId = String(form.templateId || '').toLowerCase();
      return request.sections.some((section) => templateId.includes(section.replace(/-/g, '')));
    });

    return {
      request: {
        _id: request.requestId,
        sections: request.sections ?? [],
        status: request.status ?? 'pending',
        note: request.note ?? null,
        sentAt: request.sentAt,
      },
      officeProfile: mapPatientToApi(patient, {
        emergencyContact: patientMeta.emergencyContact ?? null,
        portalAccessEnabled: patientMeta.portalAccessEnabled ?? false,
        referralSource: patientMeta.referralSource ?? null,
        customFields: patientMeta.customFields ?? {},
        preferredDentistId: patientMeta.preferredDentistId ?? null,
        preferredHygienistId: patientMeta.preferredHygienistId ?? null,
        headOfCommunication: patientMeta.headOfCommunication ?? null,
        household: await getFamilyMembers((patient.Guarantor && patient.Guarantor > 0n) ? patient.Guarantor : patient.PatNum, patient.PatNum),
        spouseInfo: patientMeta.spouseInfo ?? null,
        patientFlags: patientMeta.patientFlags ?? [],
        financialResponsibility: patientMeta.financialResponsibility ?? null,
        sexAtBirth: patientMeta.sexAtBirth ?? null,
        genderIdentity: patientMeta.genderIdentity ?? null,
        maritalStatus: patientMeta.maritalStatus ?? null,
        occupation: patientMeta.occupation ?? null,
        employer: patientMeta.employer ?? null,
        guardianEmployer: patientMeta.guardianEmployer ?? null,
        workAddress: patientMeta.workAddress ?? null,
        patientProfileType: patientMeta.patientProfileType ?? 'adult',
        medicalHistory: patientMeta.medicalHistory ?? null,
        communicationPreference: patientMeta.communicationPreference ?? undefined,
        assignmentAndRelease: patientMeta.assignmentAndRelease ?? null,
      } as any),
      submittedForms: matchingForms,
    };
  }

  async applyReconciliation(
    patientId: string,
    requestId: string,
    data: {
      fields: Record<string, unknown>;
    },
    appliedBy: string
  ) {
    const patient = await this.requirePatient(patientId);
    const requestEntries = await getCommlogJsonEntries<UpdateRequestMeta>({
      patientId,
      contains: `"requestId":"${requestId}"`,
    });
    const requestEntry = requestEntries.find(({ meta }) => meta.requestId === requestId);
    if (!requestEntry) {
      throw new NotFoundError('Update request not found');
    }

    const allowedRootFields = new Set([
      'preferredName',
      'phonePrimary',
      'phoneSecondary',
      'email',
      'notes',
      'referralSource',
    ]);
    const nextPatientData: Record<string, unknown> = {};
    const nextAddress: Record<string, unknown> = {};
    const nextEmergencyContact: Record<string, unknown> = {};

    Object.entries(data.fields || {}).forEach(([key, value]) => {
      if (allowedRootFields.has(key)) {
        nextPatientData[key] = value;
        return;
      }
      if (['addressLine1', 'addressLine2', 'city', 'state', 'postalCode'].includes(key)) {
        const fieldMap: Record<string, string> = {
          addressLine1: 'line1',
          addressLine2: 'line2',
          city: 'city',
          state: 'state',
          postalCode: 'postalCode',
        };
        const mappedKey = fieldMap[key as keyof typeof fieldMap];
        if (mappedKey) {
          nextAddress[mappedKey] = value;
        }
        return;
      }
      if (['emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone'].includes(key)) {
        const fieldMap: Record<string, string> = {
          emergencyContactName: 'name',
          emergencyContactRelationship: 'relationship',
          emergencyContactPhone: 'phone',
        };
        const mappedKey = fieldMap[key as keyof typeof fieldMap];
        if (mappedKey) {
          nextEmergencyContact[mappedKey] = value;
        }
      }
    });

    const updatedPatient = await prisma.patient.update({
      where: { PatNum: patient.PatNum },
      data: {
        Preferred:
          nextPatientData.preferredName !== undefined
            ? normalizeText(String(nextPatientData.preferredName ?? ''))
            : undefined,
        WirelessPhone:
          nextPatientData.phonePrimary !== undefined
            ? normalizeText(String(nextPatientData.phonePrimary ?? ''))
            : undefined,
        HmPhone:
          nextPatientData.phonePrimary !== undefined
            ? normalizeText(String(nextPatientData.phonePrimary ?? ''))
            : undefined,
        WkPhone:
          nextPatientData.phoneSecondary !== undefined
            ? normalizeText(String(nextPatientData.phoneSecondary ?? ''))
            : undefined,
        Email:
          nextPatientData.email !== undefined
            ? normalizeText(String(nextPatientData.email ?? ''))?.toLowerCase() ?? null
            : undefined,
        AddrNote:
          nextPatientData.notes !== undefined
            ? normalizeText(String(nextPatientData.notes ?? ''))
            : undefined,
        Address: nextAddress.line1 !== undefined ? normalizeText(String(nextAddress.line1 ?? '')) : undefined,
        Address2: nextAddress.line2 !== undefined ? normalizeText(String(nextAddress.line2 ?? '')) : undefined,
        City: nextAddress.city !== undefined ? normalizeText(String(nextAddress.city ?? '')) : undefined,
        State: nextAddress.state !== undefined ? normalizeText(String(nextAddress.state ?? '')) : undefined,
        Zip:
          nextAddress.postalCode !== undefined
            ? normalizeText(String(nextAddress.postalCode ?? ''))
            : undefined,
      },
    });

    if (Object.keys(nextEmergencyContact).length > 0 || nextPatientData.referralSource !== undefined) {
      const currentMeta = await getPatientMeta(patient.PatNum);
      await setPatientMeta(patient.PatNum, {
        ...currentMeta,
        emergencyContact:
          Object.keys(nextEmergencyContact).length > 0
            ? {
                ...(currentMeta.emergencyContact ?? {}),
                ...nextEmergencyContact,
              }
            : currentMeta.emergencyContact ?? null,
        referralSource:
          nextPatientData.referralSource !== undefined
            ? normalizeText(String(nextPatientData.referralSource ?? ''))
            : currentMeta.referralSource ?? null,
      });
    }

    await prisma.commlog.update({
      where: { CommlogNum: requestEntry.row.CommlogNum },
      data: {
        Note: JSON.stringify({
          ...requestEntry.meta,
          status: 'applied',
          appliedAt: new Date().toISOString(),
          appliedBy,
        }),
      },
    });

    await this.recordAuditEvent(patientId, {
      action: 'reconciliation_applied',
      source: 'reconciliation',
      actorUserId: appliedBy,
      section: 'patient_profile',
      oldValue: mapPatientToApi(patient),
      newValue: mapPatientToApi(updatedPatient),
    });

    return this.getReconciliation(patientId, requestId);
  }

  async recordAuditEvent(
    patientId: string,
    data: {
      action: string;
      source: PatientAuditMeta['source'];
      actorUserId?: string | null;
      section: string;
      oldValue?: unknown;
      newValue?: unknown;
    }
  ) {
    const eventId = `pae-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await createCommlogJson({
      patientId,
      userId: data.actorUserId ?? null,
      payload: {
        type: 'patient_audit_event',
        eventId,
        patientId,
        action: data.action,
        source: data.source,
        actorUserId: data.actorUserId ?? null,
        section: data.section,
        oldValue: data.oldValue ?? null,
        newValue: data.newValue ?? null,
        changedAt: new Date().toISOString(),
      } satisfies PatientAuditMeta,
    });
  }

  async getAuditHistory(patientId: string) {
    await this.requirePatient(patientId);
    const entries = await getCommlogJsonEntries<PatientAuditMeta>({
      patientId,
      contains: '"type":"patient_audit_event"',
    });
    const actorIds = uniq(
      entries
        .map(({ meta }) => meta.actorUserId)
        .filter((value): value is string => Boolean(value))
    );
    const actorMap = await this.resolveActors(actorIds);

    return {
      auditEvents: entries.map(({ meta }) => ({
        _id: meta.eventId,
        patientId,
        action: meta.action,
        source: meta.source,
        section: meta.section,
        oldValue: meta.oldValue ?? null,
        newValue: meta.newValue ?? null,
        changedAt: meta.changedAt,
        actor: meta.actorUserId ? actorMap.get(meta.actorUserId) ?? { _id: meta.actorUserId } : null,
      })),
    };
  }

  async createCommunication(
    patientId: string,
    data: {
      channel: CommunicationMeta['channel'];
      message: string;
      subject?: string;
      appointmentId?: string;
    },
    createdBy: string
  ) {
    await this.requirePatient(patientId);
    const communicationId = `pcm-${Date.now()}`;
    const payload: CommunicationMeta = {
      type: 'patient_communication',
      communicationId,
      patientId,
      appointmentId: data.appointmentId ?? null,
      channel: data.channel,
      subject: normalizeText(data.subject),
      message: data.message,
      status: 'sent',
      createdBy,
      createdAt: new Date().toISOString(),
    };
    await createCommlogJson({
      patientId,
      userId: createdBy,
      payload,
      note: payload.message,
    });
    return this.getCommunications(patientId);
  }

  async getCommunications(patientId: string) {
    await this.requirePatient(patientId);
    const entries = await getCommlogJsonEntries<CommunicationMeta>({
      patientId,
      contains: '"type":"patient_communication"',
    });
    const actorIds = uniq(
      entries
        .map(({ meta }) => meta.createdBy)
        .filter((value): value is string => Boolean(value))
    );
    const actorMap = await this.resolveActors(actorIds);

    return {
      communications: entries.map(({ meta }) => ({
        _id: meta.communicationId,
        patientId,
        appointmentId: meta.appointmentId ?? null,
        channel: meta.channel,
        subject: meta.subject ?? null,
        message: meta.message,
        status: meta.status ?? 'sent',
        createdAt: meta.createdAt,
        createdBy: actorMap.get(meta.createdBy) ?? { _id: meta.createdBy },
      })),
    };
  }

  async getReportSummary(patientId: string) {
    const patient = await this.getPatientWorkspace(patientId);
    const [forms, notes, documents] = await Promise.all([
      patientFormService.getAllForms(1, 200, patientId),
      clinicalNoteService.getClinicalNotesByPatient(patientId, 1, 50),
      documentService.getDocumentsByPatient(patientId, 1, 100),
    ]);

    return {
      patient,
      summary: {
        formsSubmitted: forms.pagination.total,
        clinicalNotes: notes.pagination.total,
        documents: documents.pagination.total,
        latestFormTemplates: (forms.forms || []).slice(0, 5).map((form: any) => ({
          _id: form._id,
          templateId: form.templateId,
          submittedAt: form.submittedAt,
        })),
      },
    };
  }

  async getReportShowcase(patientId: string) {
    const patient = await this.getPatientWorkspace(patientId);
    const [forms, notes, documents] = await Promise.all([
      patientFormService.getAllForms(1, 100, patientId),
      clinicalNoteService.getClinicalNotesByPatient(patientId, 1, 20),
      documentService.getDocumentsByPatient(patientId, 1, 50),
    ]);
    const imageDocuments = (documents.documents || []).filter((doc: any) =>
      String(doc.mimeType || '').startsWith('image/')
    );

    return {
      patient,
      sections: [
        {
          id: 'intake',
          title: 'Submitted forms',
          items: (forms.forms || []).map((form: any) => ({
            _id: form._id,
            title: form.templateId || 'Form submission',
            submittedAt: form.submittedAt,
            data: form.formData || {},
          })),
        },
        {
          id: 'clinical',
          title: 'Clinical notes',
          items: (notes.clinicalNotes || []).map((note: any) => ({
            _id: note._id,
            title: note.noteType || 'Clinical note',
            createdAt: note.createdAt,
            summary: note.assessment || note.plan || note.chiefComplaint || '',
          })),
        },
        {
          id: 'images',
          title: 'Patient images',
          items: imageDocuments.map((doc: any) => ({
            _id: doc._id,
            title: doc.documentName,
            storagePath: doc.storagePath,
            createdAt: doc.createdAt,
          })),
        },
      ],
    };
  }

  async getReportConcerns(patientId: string) {
    const [summary, showcase] = await Promise.all([
      this.getReportSummary(patientId),
      this.getReportShowcase(patientId),
    ]);
    const concerns = uniq(
      [
        ...(showcase.sections?.[0]?.items || []).map((item: any) => item.title),
        ...(showcase.sections?.[1]?.items || []).map((item: any) => item.title),
      ].filter(Boolean)
    );

    return {
      patient: summary.patient,
      concerns: concerns.map((concern, index) => ({
        _id: `concern-${index + 1}`,
        title: concern,
        content: `Review ${concern} with the patient and use attached forms, notes, and images as supporting context.`,
      })),
    };
  }

  async refreshReportSnapshots(patientId: string, userId: string) {
    const [summary, showcase, concerns] = await Promise.all([
      this.getReportSummary(patientId),
      this.getReportShowcase(patientId),
      this.getReportConcerns(patientId),
    ]);
    const snapshots = [
      { reportType: 'summary' as const, data: summary },
      { reportType: 'showcase' as const, data: showcase },
      { reportType: 'concerns' as const, data: concerns },
    ];
    await Promise.all(
      snapshots.map((snapshot) =>
        createCommlogJson({
          patientId,
          userId,
          payload: {
            type: 'patient_report_snapshot',
            patientId,
            snapshotId: `prs-${Date.now()}-${snapshot.reportType}`,
            reportType: snapshot.reportType,
            createdAt: new Date().toISOString(),
            data: snapshot.data as Record<string, unknown>,
          } satisfies ReportSnapshotMeta,
        })
      )
    );
    return { refreshedAt: new Date().toISOString() };
  }
}

export const patientWorkspaceService = new PatientWorkspaceService();
