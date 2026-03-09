import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapContactPreferenceToDb,
  mapGenderToDb,
  mapPatientToApi,
} from '../utils/opendental-mappers.util';
import { getPatientMeta, setPatientMeta } from '../utils/opendental-auth.util';
import { parseCommlogJson } from '../utils/commlog-json.util';
import { patientWorkspaceService } from './patient-workspace.service';
import { clinicalNoteService } from './clinical-note.service';

const buildPatientMapperOptions = (patientMeta: Record<string, any>) => ({
  emergencyContact: patientMeta.emergencyContact ?? null,
  portalAccessEnabled: patientMeta.portalAccessEnabled ?? false,
  referralSource: patientMeta.referralSource ?? null,
  customFields: patientMeta.customFields ?? {},
  preferredDentistId: patientMeta.preferredDentistId ?? null,
  preferredHygienistId: patientMeta.preferredHygienistId ?? null,
  headOfCommunication: patientMeta.headOfCommunication ?? null,
  household: patientMeta.household ?? [],
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
  patientProfileType: patientMeta.patientProfileType ?? null,
  medicalHistory: patientMeta.medicalHistory ?? null,
});

const DEFAULT_MEDICAL_HISTORY = {
  generalInfo: {
    healthEstimate: '',
    physicianName: '',
    physicianSpecialty: '',
    lastExamDate: null,
    purpose: '',
    weight: '',
    weightUnit: 'LBS',
    height: '',
    heightUnit: 'FT/IN',
  },
  premed: {
    requiresPremed: false,
  },
  risk: {
    asaClass: 'ASA 1',
    level: 'low',
  },
  review: {
    reviewedWithPatient: false,
    reviewedAt: null,
    signatureUrl: null,
  },
  sections: [
    {
      id: 'hospitalization',
      number: 1,
      group: 'medical',
      question: 'hospitalization for illness or injury',
      answer: 'no',
      comment: '',
      doctorNote: '',
      additionalInfo: [],
    },
    {
      id: 'supplements',
      number: 50,
      group: 'medical',
      question: 'taking any of the following Supplements',
      answer: 'no',
      comment: '',
      doctorNote: '',
      additionalInfo: [],
    },
  ],
  medications: [],
  supplements: [],
};

const DEFAULT_DENTAL_HISTORY = {
  generalInfo: {
    mouthCondition: '',
    previousDentist: '',
    recentExamDate: null,
    recentTreatmentDate: null,
    immediateConcern: '',
    patientSince: '',
    recentXrayDate: null,
    dentistVisitFrequency: '6mo',
  },
  personalHistory: [
    {
      id: 'fearful-treatment',
      number: 1,
      question: 'Are you fearful of dental treatment?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
    {
      id: 'unfavorable-experience',
      number: 2,
      question: 'Have you had an unfavorable dental experience?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
    {
      id: 'treatment-complications',
      number: 3,
      question: 'Have you ever had complications from past dental treatment?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
    {
      id: 'grind-clench',
      number: 4,
      question: 'Do you grind or clench your teeth?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
    {
      id: 'oral-surgery',
      number: 5,
      question: 'Have you had any oral surgery?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
    {
      id: 'missing-teeth-trauma',
      number: 6,
      question: 'Have you had any teeth removed or missing teeth due to trauma?',
      answer: 'No',
      scale: '',
      note: '',
      additionalInfo: '',
    },
  ],
  review: {
    reviewedWithPatient: false,
    reviewedAt: null,
    signatureDataUrl: null,
  },
};

const mapProcedureStatusToText = (status?: number | null) => {
  switch (status) {
    case 1:
      return 'Completed';
    case 2:
      return 'Treatment Planned';
    case 3:
      return 'Existing Current';
    case 4:
      return 'Existing Other';
    case 5:
      return 'Referred Out';
    case 6:
      return 'Deleted';
    case 7:
      return 'Condition';
    default:
      return 'Unknown';
  }
};

const normalizeMedicalHistoryRows = (rows: any[] = []) =>
  rows.map((row, index) => ({
    id: row?.id ?? String(index + 1),
    drug: typeof row?.drug === 'string' ? row.drug : '',
    dosage: typeof row?.dosage === 'string' ? row.dosage : '',
    purpose: typeof row?.purpose === 'string' ? row.purpose : '',
  }));

const normalizeDentalHistorySections = (rows: any[] = []) =>
  rows.map((row, index) => ({
    id: row?.id ?? `section-${index + 1}`,
    number: row?.number ?? index + 1,
    question: typeof row?.question === 'string' ? row.question : '',
    answer: typeof row?.answer === 'string' ? row.answer : '',
    scale:
      typeof row?.scale === 'string' || typeof row?.scale === 'number'
        ? String(row.scale)
        : '',
    note: typeof row?.note === 'string' ? row.note : '',
    additionalInfo: typeof row?.additionalInfo === 'string' ? row.additionalInfo : '',
  }));

const getReadableCommlogNote = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return null;
  if (!raw.startsWith('{')) return raw;

  const meta = parseCommlogJson<Record<string, unknown> & { type?: string }>(raw);
  if (!meta?.type) return raw;

  switch (meta.type) {
    case 'patient_audit_event':
    case 'patient_report_snapshot':
      return null;
    case 'patient_update_request':
      return typeof meta.note === 'string' && meta.note.trim()
        ? meta.note
        : 'Patient update request';
    case 'patient_communication':
      return (
        (typeof meta.subject === 'string' && meta.subject.trim()) ||
        (typeof meta.message === 'string' && meta.message.trim()) ||
        'Patient communication'
      );
    default:
      return (
        (typeof meta.message === 'string' && meta.message.trim()) ||
        (typeof meta.note === 'string' && meta.note.trim()) ||
        (typeof meta.action === 'string' && meta.action.trim()) ||
        raw
      );
  }
};

/**
 * Generate unique patient code (e.g., PAT001, PAT002, etc.)
 */
async function generatePatientCode(): Promise<string> {
  const nextId = await getNextId('patient', 'PatNum');
  return `PAT${nextId.toString().padStart(3, '0')}`;
}

export class PatientService {
  /**
   * Get all patients with pagination and search
   */
  async getAllPatients(
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    dobStart?: string,
    dobEnd?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Search filter - search by name, DOB, phone, email, patient code
    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length > 1) {
        // Multiple words - try both orders for name
        const firstNameSearch = searchTerms[0];
        const lastNameSearch = searchTerms.slice(1).join(' ');
        const reverseFirstNameSearch = searchTerms[searchTerms.length - 1];
        const reverseLastNameSearch = searchTerms.slice(0, -1).join(' ');

        where.OR = [
          { ChartNumber: { contains: search } },
          { Email: { contains: search } },
          { WirelessPhone: { contains: search } },
          { HmPhone: { contains: search } },
          { WkPhone: { contains: search } },
          {
            AND: [
              { FName: { contains: firstNameSearch } },
              { LName: { contains: lastNameSearch } },
            ],
          },
          {
            AND: [
              { FName: { contains: reverseFirstNameSearch } },
              { LName: { contains: reverseLastNameSearch } },
            ],
          },
          { FName: { contains: search } },
          { LName: { contains: search } },
          { AddrNote: { contains: search } },
        ];
      } else {
        // Single word - search in all fields
        where.OR = [
          { ChartNumber: { contains: search } },
          { Email: { contains: search } },
          { FName: { contains: search } },
          { LName: { contains: search } },
          { WirelessPhone: { contains: search } },
          { HmPhone: { contains: search } },
          { WkPhone: { contains: search } },
          { AddrNote: { contains: search } },
        ];
      }
    }

    // Status filter
    if (status !== undefined && status !== '') {
      if (status === 'active') {
        where.PatStatus = 0;
      } else if (status === 'inactive') {
        where.PatStatus = 2;
      }
    }

    // Date of birth range filter
    if (dobStart || dobEnd) {
      where.Birthdate = {};
      if (dobStart) {
        const startDate = new Date(dobStart);
        startDate.setHours(0, 0, 0, 0);
        where.Birthdate.gte = startDate;
      }
      if (dobEnd) {
        const endDate = new Date(dobEnd);
        endDate.setHours(23, 59, 59, 999);
        where.Birthdate.lte = endDate;
      }
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { DateTStamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    const patientMetaMap = new Map(
      await Promise.all(
        patients.map(async (patient) => [patient.PatNum.toString(), await getPatientMeta(patient.PatNum)] as const)
      )
    );

    return {
      patients: patients.map((patient) =>
        mapPatientToApi(patient, buildPatientMapperOptions(patientMetaMap.get(patient.PatNum.toString()) ?? {}))
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
   * Get patient by ID
   */
  async getPatientById(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const mapped = mapPatientToApi(patient, buildPatientMapperOptions(patientMeta));
    return {
      ...mapped,
      ssn: null,
    };
  }

  /**
   * Get patient by ID including SSN (for authorized users only)
   */
  async getPatientByIdWithSSN(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    return mapPatientToApi(patient, buildPatientMapperOptions(patientMeta));
  }

  /**
   * Get patient account balance summary
   */
  async getPatientBalance(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
      select: { PatNum: true, BalTotal: true },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return {
      patientId,
      totalBalance: Number(patient.BalTotal || 0),
      openInvoices: 0,
    };
  }

  /**
   * Search for duplicate patients based on name, DOB, phone, email
   */
  async findDuplicatePatients(data: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    phonePrimary?: string;
    email?: string;
  }) {
    const where: any = {
      FName: { equals: data.firstName },
      LName: { equals: data.lastName },
      Birthdate: data.dateOfBirth,
    };

    if (data.phonePrimary || data.email) {
      where.OR = [];
      if (data.phonePrimary) {
        where.OR.push({ WirelessPhone: data.phonePrimary });
        where.OR.push({ HmPhone: data.phonePrimary });
        where.OR.push({ WkPhone: data.phonePrimary });
      }
      if (data.email) {
        where.OR.push({ Email: data.email.toLowerCase() });
      }
    }

    const duplicates = await prisma.patient.findMany({ where });

    return duplicates.map((patient) => mapPatientToApi(patient));
  }

  /**
   * Create new patient
   */
  async createPatient(
    data: {
      firstName: string;
      lastName: string;
      middleName?: string;
      preferredName?: string;
      title?: string;
      dateOfBirth: Date;
      gender?: string;
      sexAtBirth?: string;
      genderIdentity?: string;
      ssn?: string;
      phonePrimary?: string;
      phoneSecondary?: string;
      email?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      emergencyContact?: {
        name?: string;
        relationship?: string;
        phone?: string;
      };
      preferredLanguage?: string;
      communicationPreference?: string;
      portalAccessEnabled?: boolean;
      userAccountId?: string;
      lastVisitDate?: Date;
      referralSource?: string;
      maritalStatus?: string;
      occupation?: string;
      employer?: string;
      guardianEmployer?: string;
      patientProfileType?: string;
      workAddress?: {
        country?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      notes?: string;
      customFields?: Record<string, unknown>;
    },
    createdBy?: string
  ) {
    // Check for duplicates
    const duplicateData: {
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      phonePrimary?: string;
      email?: string;
    } = {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
    };
    if (data.phonePrimary) duplicateData.phonePrimary = data.phonePrimary;
    if (data.email) duplicateData.email = data.email;

    const duplicates = await this.findDuplicatePatients(duplicateData);

    if (duplicates.length > 0) {
      throw new ConflictError(
        `A patient already exist with given details. Existing patient code is:  ${String(duplicates[0]?.patientCode || '')}`
      );
    }

    // Generate unique patient code
    const patientCode = await generatePatientCode();
    const nextId = await getNextId('patient', 'PatNum');

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        PatNum: nextId,
        ChartNumber: patientCode,
        FName: data.firstName,
        LName: data.lastName,
        MiddleI: data.middleName?.trim() || null,
        Preferred: data.preferredName?.trim() || null,
        Title: data.title?.trim() || null,
        Birthdate: data.dateOfBirth,
        Gender: mapGenderToDb(data.gender),
        SSN: data.ssn && data.ssn.trim() ? data.ssn.replace(/-/g, '').trim() : null,
        WirelessPhone: data.phonePrimary?.trim() || null,
        HmPhone: data.phonePrimary?.trim() || null,
        WkPhone: data.phoneSecondary?.trim() || null,
        Email: data.email?.toLowerCase() || null,
        Address: data.address?.line1?.trim() || null,
        Address2: data.address?.line2?.trim() || null,
        City: data.address?.city?.trim() || null,
        State: data.address?.state?.trim() || null,
        Zip: data.address?.postalCode?.trim() || null,
        Language: data.preferredLanguage?.trim() || 'en',
        PreferContactMethod: mapContactPreferenceToDb(data.communicationPreference),
        PatStatus: 0,
        DateFirstVisit: data.lastVisitDate ?? null,
        AddrNote: data.notes?.trim() || null,
      },
    });

    await setPatientMeta(patient.PatNum, {
      emergencyContact: data.emergencyContact ?? null,
      portalAccessEnabled: data.portalAccessEnabled ?? false,
      referralSource: data.referralSource?.trim() || null,
      customFields: data.customFields ?? {},
      preferredDentistId: null,
      preferredHygienistId: null,
      headOfCommunication: null,
      household: [],
      spouseInfo: null,
      patientFlags: [],
      financialResponsibility: null,
      sexAtBirth: data.sexAtBirth ?? data.gender ?? null,
      genderIdentity: data.genderIdentity ?? data.gender ?? null,
      maritalStatus: data.maritalStatus?.trim() || null,
      occupation: data.occupation?.trim() || null,
      employer: data.employer?.trim() || null,
      guardianEmployer: data.guardianEmployer?.trim() || null,
      patientProfileType: data.patientProfileType ?? 'adult',
      workAddress: data.workAddress ?? null,
      medicalHistory: null,
      dentalHistory: null,
    });

    // Log activity
    if (createdBy) {
      const patientApi = mapPatientToApi(patient);
      await logActivity(
        createdBy,
        'created',
        'patients',
        patientApi._id,
        undefined,
        { patientCode: patientApi.patientCode, firstName: patientApi.firstName, lastName: patientApi.lastName },
        undefined,
        undefined,
        'low'
      );
      await patientWorkspaceService.recordAuditEvent(patientApi._id, {
        action: 'patient_created',
        source: 'office',
        actorUserId: createdBy,
        section: 'patient_profile',
        newValue: patientApi,
      });
    }

    return this.getPatientByIdWithSSN(patient.PatNum.toString());
  }

  /**
   * Update patient
   */
  async updatePatient(
    patientId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      preferredName?: string;
      title?: string;
      dateOfBirth?: Date;
      gender?: string;
      sexAtBirth?: string;
      genderIdentity?: string;
      ssn?: string;
      phonePrimary?: string;
      phoneSecondary?: string;
      email?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      emergencyContact?: {
        name?: string;
        relationship?: string;
        phone?: string;
      };
      preferredLanguage?: string;
      communicationPreference?: string;
      portalAccessEnabled?: boolean;
      isActive?: boolean;
      lastVisitDate?: Date;
      referralSource?: string;
      maritalStatus?: string;
      occupation?: string;
      employer?: string;
      guardianEmployer?: string;
      patientProfileType?: string;
      workAddress?: {
        country?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      };
      notes?: string;
      customFields?: Record<string, unknown>;
    },
    updatedBy?: string
  ) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const oldValues = {
      firstName: patient.FName,
      lastName: patient.LName,
      phonePrimary: patient.WirelessPhone ?? patient.HmPhone,
      email: patient.Email,
      isActive: patient.PatStatus === null ? true : patient.PatStatus !== 2,
    };
    const currentMeta = await getPatientMeta(patient.PatNum);

    const updated = await prisma.patient.update({
      where: { PatNum: BigInt(patientId) },
      data: {
        FName: updates.firstName ?? undefined,
        LName: updates.lastName ?? undefined,
        MiddleI: updates.middleName !== undefined ? (updates.middleName.trim() || null) : undefined,
        Preferred:
          updates.preferredName !== undefined ? (updates.preferredName.trim() || null) : undefined,
        Title: updates.title !== undefined ? (updates.title.trim() || null) : undefined,
        Birthdate: updates.dateOfBirth ?? undefined,
        Gender: updates.gender !== undefined ? mapGenderToDb(updates.gender) : undefined,
        SSN:
          updates.ssn !== undefined
            ? updates.ssn && updates.ssn.trim()
              ? updates.ssn.replace(/-/g, '').trim()
              : null
            : undefined,
        WirelessPhone:
          updates.phonePrimary !== undefined ? (updates.phonePrimary.trim() || null) : undefined,
        HmPhone:
          updates.phonePrimary !== undefined ? (updates.phonePrimary.trim() || null) : undefined,
        WkPhone:
          updates.phoneSecondary !== undefined ? (updates.phoneSecondary.trim() || null) : undefined,
        Email: updates.email !== undefined ? (updates.email.trim().toLowerCase() || null) : undefined,
        Address:
          updates.address !== undefined ? (updates.address.line1?.trim() || null) : undefined,
        Address2:
          updates.address !== undefined ? (updates.address.line2?.trim() || null) : undefined,
        City: updates.address !== undefined ? (updates.address.city?.trim() || null) : undefined,
        State: updates.address !== undefined ? (updates.address.state?.trim() || null) : undefined,
        Zip:
          updates.address !== undefined ? (updates.address.postalCode?.trim() || null) : undefined,
        Language:
          updates.preferredLanguage !== undefined
            ? updates.preferredLanguage.trim() || 'en'
            : undefined,
        PreferContactMethod:
          updates.communicationPreference !== undefined
            ? mapContactPreferenceToDb(updates.communicationPreference)
            : undefined,
        PatStatus:
          updates.isActive !== undefined ? (updates.isActive ? 0 : 2) : undefined,
        DateFirstVisit: updates.lastVisitDate ?? undefined,
        AddrNote: updates.notes !== undefined ? (updates.notes.trim() || null) : undefined,
      },
    });

    await setPatientMeta(patient.PatNum, {
      emergencyContact: updates.emergencyContact ?? currentMeta.emergencyContact ?? null,
      portalAccessEnabled: updates.portalAccessEnabled ?? currentMeta.portalAccessEnabled ?? false,
      referralSource:
        updates.referralSource !== undefined
          ? updates.referralSource.trim() || null
          : currentMeta.referralSource ?? null,
      customFields: updates.customFields ?? currentMeta.customFields ?? {},
      preferredDentistId: currentMeta.preferredDentistId ?? null,
      preferredHygienistId: currentMeta.preferredHygienistId ?? null,
      headOfCommunication: currentMeta.headOfCommunication ?? null,
      household: currentMeta.household ?? [],
      spouseInfo: currentMeta.spouseInfo ?? null,
      patientFlags: currentMeta.patientFlags ?? [],
      financialResponsibility: currentMeta.financialResponsibility ?? null,
      sexAtBirth:
        updates.sexAtBirth !== undefined ? updates.sexAtBirth : currentMeta.sexAtBirth ?? null,
      genderIdentity:
        updates.genderIdentity !== undefined
          ? updates.genderIdentity
          : currentMeta.genderIdentity ?? null,
      maritalStatus:
        updates.maritalStatus !== undefined
          ? updates.maritalStatus.trim() || null
          : currentMeta.maritalStatus ?? null,
      occupation:
        updates.occupation !== undefined
          ? updates.occupation.trim() || null
          : currentMeta.occupation ?? null,
      employer:
        updates.employer !== undefined
          ? updates.employer.trim() || null
          : currentMeta.employer ?? null,
      guardianEmployer:
        updates.guardianEmployer !== undefined
          ? updates.guardianEmployer.trim() || null
          : currentMeta.guardianEmployer ?? null,
      patientProfileType:
        updates.patientProfileType !== undefined
          ? updates.patientProfileType
          : currentMeta.patientProfileType ?? 'adult',
      workAddress:
        updates.workAddress !== undefined
          ? updates.workAddress
          : currentMeta.workAddress ?? null,
      medicalHistory: currentMeta.medicalHistory ?? null,
      dentalHistory: currentMeta.dentalHistory ?? null,
    });

    // Log activity
    if (updatedBy) {
      await logActivity(
        updatedBy,
        'updated',
        'patients',
        patientId,
        oldValues,
        updates,
        undefined,
        undefined,
        updates.isActive !== undefined ? 'medium' : 'low'
      );
      await patientWorkspaceService.recordAuditEvent(patientId, {
        action: 'patient_updated',
        source: 'office',
        actorUserId: updatedBy,
        section: 'patient_profile',
        oldValue: oldValues,
        newValue: updates,
      });
    }

    // Always return patient with SSN included
    return this.getPatientByIdWithSSN(updated.PatNum.toString());
  }

  async getStructuredMedicalHistory(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const timelineData = await clinicalNoteService.getPatientMedicalHistory(patientId, {
      includeAllergies: true,
      includeVitals: true,
      includePrescriptions: true,
      includeLabOrders: true,
      includeLabResults: true,
      includeDocuments: true,
      includeNotes: true,
      limit: 100,
    });

    const medicalHistory = {
      ...DEFAULT_MEDICAL_HISTORY,
      ...(patientMeta.medicalHistory ?? {}),
    };

    const visitDates = (Array.from(
      new Set(
        (timelineData.timeline || [])
          .map((item: any) => item?.date)
          .filter((date: string | null | undefined) => date)
          .map((date: string) => new Date(date).toISOString().split('T')[0])
      )
    ) as string[])
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date: string) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }),
      }));

    return {
      patient: mapPatientToApi(patient, buildPatientMapperOptions(patientMeta)),
      visitDates,
      generalInfo: medicalHistory.generalInfo,
      premed: medicalHistory.premed,
      risk: medicalHistory.risk,
      sections: medicalHistory.sections,
      medications: medicalHistory.medications,
      supplements: medicalHistory.supplements,
      review: medicalHistory.review,
      timeline: timelineData.timeline || [],
      summary: timelineData.summary || {},
    };
  }

  async updateStructuredMedicalHistory(
    patientId: string,
    payload: Record<string, any>,
    userId?: string | null
  ) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const currentMedicalHistory = {
      ...DEFAULT_MEDICAL_HISTORY,
      ...(patientMeta.medicalHistory ?? {}),
    };

    const nextMedicalHistory = {
      ...currentMedicalHistory,
      generalInfo: {
        ...currentMedicalHistory.generalInfo,
        ...(payload.generalInfo ?? {}),
      },
      premed: {
        ...currentMedicalHistory.premed,
        ...(payload.premed ?? {}),
      },
      risk: {
        ...currentMedicalHistory.risk,
        ...(payload.risk ?? {}),
      },
      sections: Array.isArray(payload.sections)
        ? payload.sections.map((section: any, index: number) => ({
            id: section?.id ?? `section-${index + 1}`,
            number: section?.number ?? index + 1,
            group: section?.group ?? 'medical',
            question: section?.question ?? '',
            answer: section?.answer ?? '',
            comment: section?.comment ?? '',
            doctorNote: section?.doctorNote ?? '',
            additionalInfo: Array.isArray(section?.additionalInfo) ? section.additionalInfo : [],
          }))
        : currentMedicalHistory.sections,
      medications: Array.isArray(payload.medications)
        ? normalizeMedicalHistoryRows(payload.medications)
        : currentMedicalHistory.medications,
      supplements: Array.isArray(payload.supplements)
        ? normalizeMedicalHistoryRows(payload.supplements)
        : currentMedicalHistory.supplements,
      review: {
        ...currentMedicalHistory.review,
        ...(payload.review ?? {}),
      },
    };

    await setPatientMeta(patient.PatNum, {
      ...patientMeta,
      medicalHistory: nextMedicalHistory,
    });

    await patientWorkspaceService.recordAuditEvent(patientId, {
      action: 'medical_history_updated',
      source: 'office',
      actorUserId: userId ?? null,
      section: 'medical_history',
      oldValue: currentMedicalHistory,
      newValue: nextMedicalHistory,
    });

    return this.getStructuredMedicalHistory(patientId);
  }

  async getDentalHistory(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const [procedures, clinicalNotesResult, documents, providers] = await Promise.all([
      prisma.procedurelog.findMany({
        where: { PatNum: BigInt(patientId) },
        include: { procedurecode_procedurelog_CodeNumToprocedurecode: true },
        orderBy: [{ ProcDate: 'desc' }, { ProcNum: 'desc' }],
        take: 100,
      }),
      clinicalNoteService.getAllClinicalNotes(1, 50, { patientId }),
      prisma.document.findMany({
        where: { PatNum: BigInt(patientId) },
        orderBy: { DateCreated: 'desc' },
        take: 50,
      }),
      prisma.provider.findMany(),
    ]);

    const providerMap = new Map(
      providers.map((provider) => [
        provider.ProvNum.toString(),
        `${provider.FName || ''} ${provider.LName || ''}`.trim() || provider.Abbr || 'Provider',
      ])
    );

    const mappedProcedures = procedures
      .map((proc) => {
        const procedureCode =
          proc.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode ?? proc.OldCode ?? '';
        const description =
          proc.procedurecode_procedurelog_CodeNumToprocedurecode?.Descript ??
          proc.procedurecode_procedurelog_CodeNumToprocedurecode?.LaymanTerm ??
          '';
        const procedureName = [procedureCode, description].filter(Boolean).join(' - ').trim() || 'Procedure';
        return {
          _id: proc.ProcNum.toString(),
          date: proc.ProcDate ?? proc.DateEntryC ?? null,
          procedureCode,
          procedureName,
          tooth: proc.ToothNum ?? proc.ToothRange ?? '–',
          status: mapProcedureStatusToText(proc.ProcStatus),
          provider: proc.ProvNum
            ? {
                _id: proc.ProvNum.toString(),
                name: providerMap.get(proc.ProvNum.toString()) ?? 'Provider',
              }
            : null,
          isPlaceholder: !procedureCode && !description,
        };
      })
      .filter((proc) => !proc.isPlaceholder);

    const clinicalNotes = Array.isArray(clinicalNotesResult?.clinicalNotes)
      ? clinicalNotesResult.clinicalNotes
      : [];

    const mappedNotes = clinicalNotes
      .map((note: any) => {
        const readableNote =
          note.chiefComplaint ||
          note.subjective ||
          note.objective ||
          note.assessment ||
          note.plan ||
          note.historyOfPresentIllness ||
          note.physicalExam ||
          '';
        if (!readableNote.trim()) return null;
        return {
          _id: String(note._id),
          date: note.createdAt ?? null,
          note: readableNote.trim(),
          noteType: note.noteType || 'clinical',
        };
      })
      .filter((note): note is { _id: string; date: Date | string | null; note: string; noteType: string } => Boolean(note));

    const xrays = documents
      .filter((doc) => {
        const name = `${doc.Description || ''} ${doc.FileName || ''}`.toLowerCase();
        return name.includes('xray') || name.includes('x-ray') || name.includes('radiograph');
      })
      .map((doc) => ({
        _id: doc.DocNum.toString(),
        date: doc.DateCreated ?? null,
        name: doc.Description ?? doc.FileName ?? 'X-Ray',
        url: doc.FileName ?? null,
      }));

    const timeline = [
      ...mappedProcedures.map((item) => ({
        _id: `procedure-${item._id}`,
        date: item.date,
        type: 'procedure',
        title: item.procedureName,
      })),
      ...mappedNotes.map((item) => ({
        _id: `note-${item._id}`,
        date: item.date,
        type: 'note',
        title: `${item.noteType}: ${item.note.slice(0, 100)}`,
      })),
      ...xrays.map((item) => ({
        _id: `xray-${item._id}`,
        date: item.date,
        type: 'xray',
        title: item.name,
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const patientMeta = await getPatientMeta(patient.PatNum);
    const dentalHistory = {
      ...DEFAULT_DENTAL_HISTORY,
      ...(patientMeta.dentalHistory ?? {}),
      generalInfo: {
        ...DEFAULT_DENTAL_HISTORY.generalInfo,
        ...(patientMeta.dentalHistory?.generalInfo ?? {}),
      },
      personalHistory: Array.isArray(patientMeta.dentalHistory?.personalHistory)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.personalHistory)
        : DEFAULT_DENTAL_HISTORY.personalHistory,
      review: {
        ...DEFAULT_DENTAL_HISTORY.review,
        ...(patientMeta.dentalHistory?.review ?? {}),
      },
    };

    const normalizedVisitDates = timeline
      .map((item) => item?.date)
      .filter((date): date is string | Date => Boolean(date))
      .map((date) => new Date(date).toISOString().split('T')[0]);

    const uniqueVisitDates = Array.from(new Set(normalizedVisitDates)).filter(
      (date): date is string => typeof date === 'string' && date.length > 0
    );

    const visitDates = uniqueVisitDates
      .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())
      .map((date: string) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }),
      }));

    return {
      patient: mapPatientToApi(patient, buildPatientMapperOptions(patientMeta)),
      visitDates,
      generalInfo: dentalHistory.generalInfo,
      personalHistory: dentalHistory.personalHistory,
      reviewStatus: Boolean(dentalHistory.review.reviewedWithPatient),
      lastUpdateDate:
        dentalHistory.review.reviewedAt ??
        patient.DateTStamp ??
        mappedProcedures[0]?.date ??
        null,
      review: dentalHistory.review,
      summary: {
        totalProcedures: mappedProcedures.length,
        lastVisitDate: mappedProcedures[0]?.date ?? null,
        clinicalNotesCount: mappedNotes.length,
        xrayCount: xrays.length,
      },
      procedures: mappedProcedures,
      timeline,
      clinicalNotes: mappedNotes,
      xrays,
    };
  }

  async updateDentalHistory(
    patientId: string,
    payload: Record<string, any>,
    userId?: string | null
  ) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const currentDentalHistory = {
      ...DEFAULT_DENTAL_HISTORY,
      ...(patientMeta.dentalHistory ?? {}),
      generalInfo: {
        ...DEFAULT_DENTAL_HISTORY.generalInfo,
        ...(patientMeta.dentalHistory?.generalInfo ?? {}),
      },
      personalHistory: Array.isArray(patientMeta.dentalHistory?.personalHistory)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.personalHistory)
        : DEFAULT_DENTAL_HISTORY.personalHistory,
      review: {
        ...DEFAULT_DENTAL_HISTORY.review,
        ...(patientMeta.dentalHistory?.review ?? {}),
      },
    };

    const nextDentalHistory = {
      ...currentDentalHistory,
      generalInfo: {
        ...currentDentalHistory.generalInfo,
        ...(payload.generalInfo ?? {}),
      },
      personalHistory: Array.isArray(payload.personalHistory)
        ? normalizeDentalHistorySections(payload.personalHistory)
        : currentDentalHistory.personalHistory,
      review: {
        ...currentDentalHistory.review,
        ...(payload.review ?? {}),
      },
    };

    await setPatientMeta(patient.PatNum, {
      ...patientMeta,
      dentalHistory: nextDentalHistory,
    });

    await patientWorkspaceService.recordAuditEvent(patientId, {
      action: 'dental_history_updated',
      source: 'office',
      actorUserId: userId ?? null,
      section: 'dental_history',
      oldValue: currentDentalHistory,
      newValue: nextDentalHistory,
    });

    return this.getDentalHistory(patientId);
  }

  /**
   * Delete patient (soft delete by setting isActive to false)
   */
  async deletePatient(patientId: string, deletedBy?: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    await prisma.patient.update({
      where: { PatNum: BigInt(patientId) },
      data: { PatStatus: 2 },
    });

    // Log activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'patients',
        patientId,
        { isActive: true },
        { isActive: false },
        undefined,
        undefined,
        'medium'
      );
      await patientWorkspaceService.recordAuditEvent(patientId, {
        action: 'patient_deactivated',
        source: 'office',
        actorUserId: deletedBy,
        section: 'patient_profile',
        oldValue: { isActive: true },
        newValue: { isActive: false },
      });
    }

    return { message: 'Patient deactivated successfully' };
  }
}

export const patientService = new PatientService();
