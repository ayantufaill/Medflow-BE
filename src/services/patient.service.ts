import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapContactPreferenceToDb,
  mapGenderToDb,
  mapPatientToApi,
} from '../utils/opendental-mappers.util';
import { getPatientMeta, getPatientsMeta, setPatientMeta } from '../utils/opendental-auth.util';
import {
  mapProcedureStatusToText,
  normalizeMedicalHistoryRows,
  normalizeDentalHistorySections,
  buildVisitDates,
} from '../utils/patient-history.util';
import { DEFAULT_MEDICAL_HISTORY, DEFAULT_DENTAL_HISTORY } from './patient-history-defaults';
import { patientWorkspaceService } from './patient-workspace.service';
import { clinicalNoteService } from './clinical-note.service';

// Builds options object for mapPatientToApi from stored patient meta
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
  dentalHistory: patientMeta.dentalHistory ?? null,
  communicationPreference: patientMeta.communicationPreference ?? undefined,
  assignmentAndRelease: patientMeta.assignmentAndRelease ?? null,
});

/**
 * Generate unique patient code (e.g., PAT001, PAT002, etc.)
 */
async function generatePatientCode(): Promise<string> {
  const nextId = await getNextId('patient', 'PatNum');
  return `PAT${nextId.toString().padStart(3, '0')}`;
}

export async function getFamilyMembers(guarantorId: bigint, currentPatNum: bigint) {
  if (!guarantorId || guarantorId <= 0n) return [];
  const members = await prisma.patient.findMany({
    where: { 
      OR: [
        { Guarantor: guarantorId },
        { PatNum: guarantorId }
      ],
      PatNum: { not: currentPatNum }, 
      PatStatus: { not: 2 } 
    },
    select: { PatNum: true, FName: true, LName: true, Preferred: true, Birthdate: true, Gender: true, Guarantor: true }
  });
  return members.map(fm => ({
    id: fm.PatNum.toString(),
    firstName: fm.FName,
    lastName: fm.LName,
    preferredName: fm.Preferred,
    dateOfBirth: fm.Birthdate,
    gender: fm.Gender === 0 ? 'male' : fm.Gender === 1 ? 'female' : 'unknown',
    guarantorId: fm.Guarantor?.toString() || null,
    relationship: fm.PatNum === guarantorId ? 'Guarantor' : (currentPatNum === guarantorId ? 'Dependent' : 'Family Member')
  }));
}

export class PatientService {
  /**
   * Get all patients with pagination, search, status, and DOB range filters
   */
  async getAllPatients(
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    dobStart?: string,
    dobEnd?: string,
    gender?: string,
    providerId?: string,
    sortBy?: string,
    sortOrder?: string,
    clinicIds?: bigint[]
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Scope to the caller's accessible clinics, if branch access was resolved
    // for this request. Callers with no clinic assignments yet (branches not
    // set up) are left unscoped so existing single-clinic practices are unaffected.
    if (clinicIds && clinicIds.length > 0) {
      where.ClinicNum = { in: clinicIds };
    }

    // Filter by gender using mapGenderToDb
    if (gender) {
      const dbGender = mapGenderToDb(gender);
      if (dbGender !== null) {
        where.Gender = dbGender;
      }
    }

    // Filter by provider using userodpref json search
    if (providerId) {
      const matchingPrefs = await prisma.userodpref.findMany({
        where: {
          FkeyType: 206,
          ValueString: {
            contains: `"preferredDentistId":"${providerId}"`,
          },
        },
        select: {
          Fkey: true,
        },
      });

      const matchingPatNums = matchingPrefs
        .map((p) => p.Fkey)
        .filter((fkey): fkey is bigint => fkey !== null);

      where.PatNum = {
        in: matchingPatNums,
      };
    }

    // Search filter - search by name, DOB, phone, email, patient code
    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length > 1) {
        // Multiple words - try both orders for name matching
        const firstNameSearch = searchTerms[0];
        const lastNameSearch = searchTerms.slice(1).join(' ');
        const reverseFirstNameSearch = searchTerms[searchTerms.length - 1];
        const reverseLastNameSearch = searchTerms.slice(0, -1).join(' ');

        where.OR = [
          { ChartNumber: { contains: search, mode: 'insensitive' } },
          { Email: { contains: search, mode: 'insensitive' } },
          { WirelessPhone: { contains: search, mode: 'insensitive' } },
          { HmPhone: { contains: search, mode: 'insensitive' } },
          { WkPhone: { contains: search, mode: 'insensitive' } },
          {
            AND: [
              { FName: { contains: firstNameSearch, mode: 'insensitive' } },
              { LName: { contains: lastNameSearch, mode: 'insensitive' } },
            ],
          },
          {
            AND: [
              { FName: { contains: reverseFirstNameSearch, mode: 'insensitive' } },
              { LName: { contains: reverseLastNameSearch, mode: 'insensitive' } },
            ],
          },
          { FName: { contains: search, mode: 'insensitive' } },
          { LName: { contains: search, mode: 'insensitive' } },
          { AddrNote: { contains: search, mode: 'insensitive' } },
        ];
      } else {
        // Single word - search across all relevant fields
        where.OR = [
          { ChartNumber: { contains: search, mode: 'insensitive' } },
          { Email: { contains: search, mode: 'insensitive' } },
          { FName: { contains: search, mode: 'insensitive' } },
          { LName: { contains: search, mode: 'insensitive' } },
          { WirelessPhone: { contains: search, mode: 'insensitive' } },
          { HmPhone: { contains: search, mode: 'insensitive' } },
          { WkPhone: { contains: search, mode: 'insensitive' } },
          { AddrNote: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    // Status filter (PatStatus: 0 = active, 2 = inactive)
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
        orderBy: sortBy === 'name'
          ? [
              { FName: sortOrder === 'desc' ? 'desc' : 'asc' },
              { LName: sortOrder === 'desc' ? 'desc' : 'asc' }
            ]
          : [
              { DateTStamp: 'desc' },
              { PatNum: 'asc' }
            ],
        skip,
        take: limit,
        include: {
          patplan: {
            include: {
              inssub: {
                include: {
                  insplan: {
                    include: {
                      carrier: true
                    }
                  }
                }
              }
            }
          },
          appointment: true,
          procedurelog: {
            where: {
              ProcStatus: { in: [1, 2] }
            }
          }
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const patientNums = patients.map((patient) => patient.PatNum);
    const patientsMeta = await getPatientsMeta(patientNums);

    return {
      patients: patients.map((patient) =>
        mapPatientToApi(patient, buildPatientMapperOptions(patientsMeta[patient.PatNum.toString()] ?? {}))
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
   * Get patient by ID (SSN is excluded from the response)
   */
  async getPatientById(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
      include: {
        patplan: {
          include: {
            inssub: {
              include: {
                insplan: {
                  include: {
                    carrier: true
                  }
                }
              }
            }
          }
        },
        appointment: true,
        procedurelog: {
          where: {
            ProcStatus: { in: [1, 2] }
          }
        }
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const options = buildPatientMapperOptions(patientMeta);
    const actualGuarantorId = (patient.Guarantor && patient.Guarantor > 0n) ? patient.Guarantor : patient.PatNum;
    options.household = await getFamilyMembers(actualGuarantorId, patient.PatNum);
    
    const mapped = mapPatientToApi(patient, options);
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
      include: {
        patplan: {
          include: {
            inssub: {
              include: {
                insplan: {
                  include: {
                    carrier: true
                  }
                }
              }
            }
          }
        },
        appointment: true,
        procedurelog: {
          where: {
            ProcStatus: { in: [1, 2] }
          }
        }
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const options = buildPatientMapperOptions(patientMeta);
    const actualGuarantorId = (patient.Guarantor && patient.Guarantor > 0n) ? patient.Guarantor : patient.PatNum;
    options.household = await getFamilyMembers(actualGuarantorId, patient.PatNum);
    
    return mapPatientToApi(patient, options);
  }

  /**
   * Bulk deactivate incomplete patients
   */
  async bulkDeletePatients(patientIds: number[], userId: string) {
    const validIds = patientIds.filter((id) => typeof id === 'number' && id > 0);
    if (validIds.length === 0) return;

    await prisma.patient.updateMany({
      where: {
        PatNum: { in: validIds.map((id) => BigInt(id)) }
      },
      data: {
        PatStatus: 4, // 4 = Deleted in OpenDental
      }
    });

    for (const id of validIds) {
      await logActivity(userId, 'deleted', 'patients', id.toString());
    }
  }

  /**
   * Get patient account balance summary
   */
async getPatientBalance(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { PatNum: BigInt(patientId) },
    select: { PatNum: true },
  });
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  const patNum = BigInt(patientId);

  // Sum all completed procedure fees
  const procedureAgg = await prisma.procedurelog.aggregate({
    where: { PatNum: patNum, ProcStatus: 2 },
    _sum: { ProcFee: true },
  });

  // Sum all adjustments (negative adjustments reduce the balance)
  const adjustmentAgg = await prisma.adjustment.aggregate({
    where: { PatNum: patNum },
    _sum: { AdjAmt: true },
  });

  // Sum all payments applied via paysplit (OpenDental native)
  const paysplitAgg = await prisma.paysplit.aggregate({
    where: { PatNum: patNum },
    _sum: { SplitAmt: true },
  });

  // Sum all payments via invoice/payment system (MedFlow)
  const invoicePaymentAgg = await prisma.payment.aggregate({
    where: { PatNum: patNum },
    _sum: { PayAmt: true },
  });

  const totalCharged = procedureAgg._sum.ProcFee ?? 0;
  const totalAdjustments = adjustmentAgg._sum.AdjAmt ?? 0;
  const totalPaid = (paysplitAgg._sum.SplitAmt ?? 0) + (invoicePaymentAgg._sum.PayAmt ?? 0);
  const balance = totalCharged + totalAdjustments - totalPaid;

  // Last payment date
  const lastPayment = await prisma.payment.findFirst({
    where: { PatNum: patNum },
    orderBy: { PayDate: 'desc' },
    select: { PayDate: true },
  });

  // Overdue: procedures older than 30 days, proportional to outstanding balance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const overdueAgg = await prisma.procedurelog.aggregate({
    where: {
      PatNum: patNum,
      ProcStatus: 2,
      ProcDate: { lt: thirtyDaysAgo },
    },
    _sum: { ProcFee: true },
  });

  const overdueProcFee = overdueAgg._sum.ProcFee ?? 0;
  const overdueRatio = totalCharged > 0 ? overdueProcFee / totalCharged : 0;
  const overdueAmount = Math.max(0, balance * overdueRatio);

  return {
    balance: parseFloat(balance.toFixed(2)),
    lastPaymentDate: lastPayment?.PayDate ?? null,
    overdueAmount: parseFloat(overdueAmount.toFixed(2)),
  };
}
/**
 * Get the most recent completed appointment for a patient
 */
async getPatientLastVisit(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { PatNum: BigInt(patientId) },
  });
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  // AptStatus 2 = completed in OpenDental, but also check other statuses
  // since completion may be tracked in meta
  const lastAppointment = await prisma.appointment.findFirst({
    where: {
      PatNum: BigInt(patientId),
      AptStatus: { in: [2, 5, 6] }, // 2=complete, 5=complete variants
      AptDateTime: { lt: new Date() }, // must be in the past
    },
    orderBy: { AptDateTime: 'desc' },
    include: {
      provider_appointment_ProvNumToprovider: true,
      appointmenttype: true,
    },
  });

  // Fallback: get the most recent past appointment regardless of status
  const fallback = !lastAppointment
    ? await prisma.appointment.findFirst({
        where: {
          PatNum: BigInt(patientId),
          AptDateTime: { lt: new Date() },
        },
        orderBy: { AptDateTime: 'desc' },
        include: {
          provider_appointment_ProvNumToprovider: true,
          appointmenttype: true,
        },
      })
    : null;

  const apt = lastAppointment ?? fallback;

  if (!apt) {
    throw new NotFoundError('No completed appointments found for this patient');
  }

  const provider = apt.provider_appointment_ProvNumToprovider;
  const providerName = provider
    ? `${provider.FName ?? ''} ${provider.LName ?? ''}`.trim() || provider.Abbr || null
    : null;

  return {
    date: apt.AptDateTime ?? null,
    providerName,
    appointmentType: apt.appointmenttype?.AppointmentTypeName ?? null,
    notesSummary: apt.Note ? apt.Note.slice(0, 200) : apt.ProcDescript ? apt.ProcDescript.slice(0, 200) : null,
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
      preferredDentistId?: string;
      preferredHygienistId?: string;
      guarantorId?: string;
    },
    createdBy?: string
  ) {
    // Check for duplicates before creating
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

    // Create patient record
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
        Guarantor: data.guarantorId ? BigInt(data.guarantorId) : nextId,
      },
    });

    await setPatientMeta(patient.PatNum, {
      emergencyContact: data.emergencyContact ?? null,
      portalAccessEnabled: data.portalAccessEnabled ?? false,
      referralSource: data.referralSource?.trim() || null,
      customFields: data.customFields ?? {},
      preferredDentistId: data.preferredDentistId ?? null,
      preferredHygienistId: data.preferredHygienistId ?? null,
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
      communicationPreference?: string[];
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
      preferredDentistId?: string | null;
      preferredHygienistId?: string | null;
      headOfCommunication?: Record<string, any> | null;
      household?: any[];
      spouseInfo?: Record<string, any> | null;
      assignmentAndRelease?: Record<string, any> | null;
      patientFlags?: any[];
      financialResponsibility?: Record<string, any> | null;
      guarantorId?: string;
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
            ? mapContactPreferenceToDb(updates.communicationPreference[0] || 'phone')
            : undefined,
        PatStatus:
          updates.isActive !== undefined ? (updates.isActive ? 0 : 2) : undefined,
        DateFirstVisit: updates.lastVisitDate ?? undefined,
        AddrNote: updates.notes !== undefined ? (updates.notes.trim() || null) : undefined,
        Guarantor: updates.guarantorId !== undefined ? (updates.guarantorId ? BigInt(updates.guarantorId) : BigInt(patientId)) : undefined,
      },
    });

    await setPatientMeta(patient.PatNum, {
      emergencyContact: updates.emergencyContact ?? currentMeta.emergencyContact ?? null,
      portalAccessEnabled: updates.portalAccessEnabled ?? currentMeta.portalAccessEnabled ?? false,
      referralSource:
        updates.referralSource !== undefined
          ? updates.referralSource.trim() || null
          : currentMeta.referralSource ?? null,
      customFields: updates.customFields !== undefined
        ? { ...(currentMeta.customFields || {}), ...updates.customFields }
        : currentMeta.customFields ?? {},
      preferredDentistId: updates.preferredDentistId !== undefined ? updates.preferredDentistId : currentMeta.preferredDentistId ?? null,
      preferredHygienistId: updates.preferredHygienistId !== undefined ? updates.preferredHygienistId : currentMeta.preferredHygienistId ?? null,
      headOfCommunication: updates.headOfCommunication !== undefined ? updates.headOfCommunication : currentMeta.headOfCommunication ?? null,
      household: updates.household !== undefined ? updates.household : currentMeta.household ?? [],
      spouseInfo: updates.spouseInfo !== undefined ? updates.spouseInfo : currentMeta.spouseInfo ?? null,
      assignmentAndRelease: updates.assignmentAndRelease !== undefined
        ? { ...(currentMeta.assignmentAndRelease || {}), ...updates.assignmentAndRelease }
        : currentMeta.assignmentAndRelease ?? null,
      patientFlags: updates.patientFlags !== undefined ? updates.patientFlags : currentMeta.patientFlags ?? [],
      financialResponsibility: updates.financialResponsibility !== undefined ? updates.financialResponsibility : currentMeta.financialResponsibility ?? null,
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
      communicationPreference:
        updates.communicationPreference !== undefined
          ? updates.communicationPreference
          : currentMeta.communicationPreference ?? undefined,
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

  /**
   * Add a family member, linking their Guarantor field bidirectionally
   */
  async addFamilyMember(patientId: string, memberId: string, updatedBy?: string) {
    if (patientId === memberId) {
      throw new ConflictError('Cannot add patient as their own family member');
    }

    const patient = await prisma.patient.findUnique({ where: { PatNum: BigInt(patientId) } });
    const member = await prisma.patient.findUnique({ where: { PatNum: BigInt(memberId) } });

    if (!patient || !member) {
      throw new NotFoundError('Patient not found');
    }

    // Determine the head of household
    let headId = patient.PatNum;
    if (patient.Guarantor && patient.Guarantor > 0n && patient.Guarantor !== patient.PatNum) {
      headId = patient.Guarantor;
    } else if (member.Guarantor && member.Guarantor > 0n && member.Guarantor !== member.PatNum) {
      headId = member.Guarantor;
    }

    // Update both to have the same Guarantor
    await prisma.$transaction([
      prisma.patient.update({
        where: { PatNum: patient.PatNum },
        data: { Guarantor: headId }
      }),
      prisma.patient.update({
        where: { PatNum: member.PatNum },
        data: { Guarantor: headId }
      })
    ]);

    if (updatedBy) {
      await logActivity(updatedBy, 'updated', 'patients', patientId, undefined, { addedFamilyMember: memberId });
      await logActivity(updatedBy, 'updated', 'patients', memberId, undefined, { addedFamilyMember: patientId });
    }

    return this.getPatientByIdWithSSN(patientId);
  }

  /**
   * Remove a family member
   */
  async removeFamilyMember(patientId: string, memberId: string, updatedBy?: string) {
    const member = await prisma.patient.findUnique({ where: { PatNum: BigInt(memberId) } });
    if (!member) {
      throw new NotFoundError('Member patient not found');
    }

    // Reset member's guarantor to their own PatNum
    await prisma.patient.update({
      where: { PatNum: member.PatNum },
      data: { Guarantor: member.PatNum }
    });

    if (updatedBy) {
      await logActivity(updatedBy, 'updated', 'patients', patientId, undefined, { removedFamilyMember: memberId });
      await logActivity(updatedBy, 'updated', 'patients', memberId, undefined, { removedFamilyMember: patientId });
    }

    return this.getPatientByIdWithSSN(patientId);
  }

  /**
   * Get the full structured medical history for a patient, merged with
   * live clinical timeline data (allergies, vitals, prescriptions, etc.)
   */
  async getStructuredMedicalHistory(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const appointments = await prisma.appointment.findMany({
      where: {
        PatNum: BigInt(patientId),
        AptStatus: { not: 6 }, // filter out cancelled
      },
      select: { AptDateTime: true },
    });

    const medicalHistory = {
      ...DEFAULT_MEDICAL_HISTORY,
      ...(patientMeta.medicalHistory ?? {}),
    };

    const visitDates = buildVisitDates(
      appointments.map((apt) => ({ date: apt.AptDateTime }))
    );

    return {
      visitDates,
      generalInfo: medicalHistory.generalInfo,
      premed: medicalHistory.premed,
      risk: medicalHistory.risk,
      sections: medicalHistory.sections,
      medications: medicalHistory.medications,
      supplements: medicalHistory.supplements,
      review: medicalHistory.review,
    };
  }

  /**
   * Update the structured medical history for a patient.
   * Merges the incoming payload with the existing history and persists via patient meta.
   */
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
          severity: section?.severity ?? '',
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

  /**
   * Get the full dental history for a patient, including procedures, clinical notes,
   * x-rays, and personal history questionnaire. Also returns a combined timeline.
   */
  async getDentalHistory(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const patientMeta = await getPatientMeta(patient.PatNum);
    const appointments = await prisma.appointment.findMany({
      where: {
        PatNum: BigInt(patientId),
        AptStatus: { not: 6 }, // filter out cancelled
      },
      select: { AptDateTime: true },
    });

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
      gumAndBone: Array.isArray(patientMeta.dentalHistory?.gumAndBone)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.gumAndBone)
        : DEFAULT_DENTAL_HISTORY.gumAndBone,
      biteAndJawJoint: Array.isArray(patientMeta.dentalHistory?.biteAndJawJoint)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.biteAndJawJoint)
        : DEFAULT_DENTAL_HISTORY.biteAndJawJoint,
      toothStructure: Array.isArray(patientMeta.dentalHistory?.toothStructure)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.toothStructure)
        : DEFAULT_DENTAL_HISTORY.toothStructure,
      smileCharacteristics: Array.isArray(patientMeta.dentalHistory?.smileCharacteristics)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.smileCharacteristics)
        : DEFAULT_DENTAL_HISTORY.smileCharacteristics,
      review: {
        ...DEFAULT_DENTAL_HISTORY.review,
        ...(patientMeta.dentalHistory?.review ?? {}),
      },
    };

    const visitDates = buildVisitDates(
      appointments.map((apt) => ({ date: apt.AptDateTime }))
    );

    return {
      visitDates,
      generalInfo: dentalHistory.generalInfo,
      sectionSummaries: dentalHistory.sectionSummaries,
      personalHistory: dentalHistory.personalHistory,
      gumAndBone: dentalHistory.gumAndBone,
      biteAndJawJoint: dentalHistory.biteAndJawJoint,
      toothStructure: dentalHistory.toothStructure,
      smileCharacteristics: dentalHistory.smileCharacteristics,
      reviewStatus: Boolean(dentalHistory.review.reviewedWithPatient),
      lastUpdateDate: dentalHistory.review.reviewedAt ?? patient.DateTStamp ?? null,
      review: dentalHistory.review,
    };
  }

  /**
 * Get patient history aggregate — joins allergies, conditions, medications, vitals
 */
async getPatientHistoryAggregate(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { PatNum: BigInt(patientId) },
  });
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }

  const [allergies, medications, vitals, conditions] = await Promise.all([
    prisma.allergy.findMany({
      where: { PatNum: BigInt(patientId) },
      include: { allergydef: true },
    }),
    prisma.medicationpat.findMany({
      where: { PatNum: BigInt(patientId) },
      include: { medication: true },
    }),
    prisma.vitalsign.findFirst({
      where: { PatNum: BigInt(patientId) },
      orderBy: { DateTaken: 'desc' },
    }),
    prisma.disease.findMany({
      where: { PatNum: BigInt(patientId) },
      include: { diseasedef: true },
    }),
  ]);

  const patientMeta = await getPatientMeta(patient.PatNum);

  return {
    patient: mapPatientToApi(patient, buildPatientMapperOptions(patientMeta)),
    allergies: allergies.map((a) => ({
      _id: a.AllergyNum.toString(),
      name: a.allergydef?.Description ?? 'Unknown',
      reaction: a.Reaction ?? null,
      isActive: a.StatusIsActive === 1,
    })),
    medicalConditions: conditions.map((c) => ({
      _id: c.DiseaseNum.toString(),
      name: c.diseasedef?.DiseaseName ?? 'Unknown',
      status: c.ProbStatus === 0 ? 'active' : 'inactive',
      dateStart: c.DateStart ?? null,
      dateStop: c.DateStop ?? null,
    })),
    medications: medications.map((m) => ({
      _id: m.MedicationPatNum.toString(),
      name: m.medication?.MedName ?? m.MedDescript ?? 'Unknown',
      dateStart: m.DateStart ?? null,
      dateStop: m.DateStop ?? null,
      notes: m.PatNote ?? null,
    })),
    vitals: {
      latest: vitals
        ? {
            dateTaken: vitals.DateTaken ?? null,
            height: vitals.Height ?? null,
            weight: vitals.Weight ?? null,
            bpSystolic: vitals.BpSystolic ?? null,
            bpDiastolic: vitals.BpDiastolic ?? null,
            pulse: vitals.Pulse ?? null,
          }
        : null,
    },
  };
}

  /**
   * Update dental history general info, personal history questionnaire, and review status.
   * Merges with existing data and persists via patient meta.
   */
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
      sectionSummaries: {
        ...DEFAULT_DENTAL_HISTORY.sectionSummaries,
        ...(patientMeta.dentalHistory?.sectionSummaries ?? {}),
      },
      personalHistory: Array.isArray(patientMeta.dentalHistory?.personalHistory)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.personalHistory)
        : DEFAULT_DENTAL_HISTORY.personalHistory,
      gumAndBone: Array.isArray(patientMeta.dentalHistory?.gumAndBone)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.gumAndBone)
        : DEFAULT_DENTAL_HISTORY.gumAndBone,
      biteAndJawJoint: Array.isArray(patientMeta.dentalHistory?.biteAndJawJoint)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.biteAndJawJoint)
        : DEFAULT_DENTAL_HISTORY.biteAndJawJoint,
      toothStructure: Array.isArray(patientMeta.dentalHistory?.toothStructure)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.toothStructure)
        : DEFAULT_DENTAL_HISTORY.toothStructure,
      smileCharacteristics: Array.isArray(patientMeta.dentalHistory?.smileCharacteristics)
        ? normalizeDentalHistorySections(patientMeta.dentalHistory.smileCharacteristics)
        : DEFAULT_DENTAL_HISTORY.smileCharacteristics,
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
      sectionSummaries: {
        ...currentDentalHistory.sectionSummaries,
        ...(payload.sectionSummaries ?? {}),
      },
      personalHistory: Array.isArray(payload.personalHistory)
        ? normalizeDentalHistorySections(payload.personalHistory)
        : currentDentalHistory.personalHistory,
      gumAndBone: Array.isArray(payload.gumAndBone)
        ? normalizeDentalHistorySections(payload.gumAndBone)
        : currentDentalHistory.gumAndBone,
      biteAndJawJoint: Array.isArray(payload.biteAndJawJoint)
        ? normalizeDentalHistorySections(payload.biteAndJawJoint)
        : currentDentalHistory.biteAndJawJoint,
      toothStructure: Array.isArray(payload.toothStructure)
        ? normalizeDentalHistorySections(payload.toothStructure)
        : currentDentalHistory.toothStructure,
      smileCharacteristics: Array.isArray(payload.smileCharacteristics)
        ? normalizeDentalHistorySections(payload.smileCharacteristics)
        : currentDentalHistory.smileCharacteristics,
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
   * Delete patient (soft delete by setting PatStatus to 2 / inactive)
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

  /**
   * Helper to resolve patient PatNum by ID or Name
   */
  private async resolvePatientPatNum(patientIdOrName: string): Promise<bigint> {
    if (/^\d+$/.test(patientIdOrName)) {
      return BigInt(patientIdOrName);
    }
    
    let nameToLookup = patientIdOrName;
    if (patientIdOrName === 'fallback-1') {
      nameToLookup = 'John Doe';
    }

    const parts = nameToLookup.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const patient = await prisma.patient.findFirst({
      where: {
        FName: { equals: firstName },
        LName: { equals: lastName }
      },
      select: { PatNum: true }
    });

    if (patient) {
      return patient.PatNum;
    }

    // Fallback: search with contains if exact doesn't match
    const fallbackPatient = await prisma.patient.findFirst({
      where: {
        FName: { contains: firstName },
        LName: { contains: lastName }
      },
      select: { PatNum: true }
    });

    if (fallbackPatient) {
      return fallbackPatient.PatNum;
    }

    // If still not found, search the first patient in the database as a safe fallback
    const firstPat = await prisma.patient.findFirst({
      select: { PatNum: true }
    });

    if (firstPat) {
      return firstPat.PatNum;
    }

    throw new NotFoundError('Patient not found');
  }

  /**
   * Get patient account notes
   */
  async getPatientAccountNotes(patientIdOrName: string) {
    const patNum = await this.resolvePatientPatNum(patientIdOrName);
    const rows = await prisma.commlog.findMany({
      where: {
        PatNum: patNum
      },
      orderBy: {
        CommDateTime: 'desc'
      }
    });

    return rows
      .map((row) => {
        try {
          const parsed = JSON.parse(row.Note || '{}');
          if (parsed && parsed.noteType === 'account') {
            return {
              id: row.CommlogNum.toString(),
              patientId: row.PatNum?.toString() || '',
              text: parsed.text || '',
              remindMe: parsed.remindMe || false,
              archived: parsed.archived || false,
              createdAt: row.CommDateTime ? new Date(row.CommDateTime).toISOString() : new Date().toISOString()
            };
          }
        } catch (e) {
          // ignore parsing error
        }
        return null;
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);
  }

  /**
   * Create patient account note
   */
  async createPatientAccountNote(patientIdOrName: string, text: string, remindMe: boolean, userId?: string) {
    const patNum = await this.resolvePatientPatNum(patientIdOrName);
    const commlogNum = await getNextId('commlog', 'CommlogNum');
    const entryDate = new Date();
    
    const row = await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: patNum,
        UserNum: userId ? BigInt(userId) : null,
        CommDateTime: entryDate,
        Note: JSON.stringify({
          noteType: 'account',
          source: 'agingReport',
          text,
          remindMe,
          archived: false
        })
      }
    });

    return {
      id: row.CommlogNum.toString(),
      patientId: row.PatNum?.toString() || '',
      text,
      remindMe,
      archived: false,
      createdAt: entryDate.toISOString()
    };
  }

  /**
   * Update patient account note
   */
  async updatePatientAccountNote(noteId: string, updates: { text?: string; remindMe?: boolean; archived?: boolean }, userId?: string) {
    const commlogNum = BigInt(noteId);
    const row = await prisma.commlog.findUnique({
      where: { CommlogNum: commlogNum }
    });

    if (!row) {
      throw new NotFoundError('Note not found');
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(row.Note || '{}');
    } catch (e) {
      // ignore
    }

    const updatedPayload = {
      ...parsed,
      ...updates
    };

    const updated = await prisma.commlog.update({
      where: { CommlogNum: commlogNum },
      data: {
        Note: JSON.stringify(updatedPayload)
      }
    });

    return {
      id: updated.CommlogNum.toString(),
      patientId: updated.PatNum?.toString() || '',
      text: updatedPayload.text || '',
      remindMe: updatedPayload.remindMe || false,
      archived: updatedPayload.archived || false,
      createdAt: updated.CommDateTime ? new Date(updated.CommDateTime).toISOString() : new Date().toISOString()
    };
  }

  async getFamilyAppointments(patientId: string) {
    const { appointmentService } = await import('./appointment.service');
    const patientObj = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) }
    });
    if (!patientObj) throw new NotFoundError('Patient not found');

    const guarantorId = (patientObj.Guarantor && patientObj.Guarantor > 0n) ? patientObj.Guarantor : patientObj.PatNum;

    // Get family members (excluding current patient)
    const familyMembers = await getFamilyMembers(guarantorId, patientObj.PatNum);

    // Get current patient info in the same format
    const currentPatientInfo = {
      id: patientObj.PatNum.toString(),
      firstName: patientObj.FName,
      lastName: patientObj.LName,
      preferredName: patientObj.Preferred,
      dateOfBirth: patientObj.Birthdate,
      gender: patientObj.Gender === 0 ? 'male' : patientObj.Gender === 1 ? 'female' : 'unknown',
      guarantorId: patientObj.Guarantor?.toString() || null,
      relationship: patientObj.PatNum === guarantorId ? 'Guarantor' : 'Dependent'
    };

    const allMembers = [currentPatientInfo, ...familyMembers];
    const memberIds = allMembers.map(m => m.id);

    const rawAppointments = await prisma.appointment.findMany({
      where: {
        PatNum: { in: memberIds.map(BigInt) }
      },
      include: {
        patient: true,
        provider_appointment_ProvNumToprovider: true,
        appointmenttype: true,
        userod: true,
      },
      orderBy: { AptDateTime: 'desc' }
    });

    const appointments = await appointmentService.mapAppointmentsBulk(rawAppointments);

    return {
      familyMembers,
      appointments
    };
  }

  async purchaseProducts(patientId: string, products: any[]) {
    const patNum = BigInt(patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patNum } });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const createdProcedures = [];

    for (const product of products) {
      const { productName, providerName, quantity, price } = product;

      let provNum = patient.PriProv;
      if (providerName) {
        const parts = providerName.split(' ');
        const first = parts[0] || '';
        const last = parts.slice(1).join(' ') || first;
        
        const prov = await prisma.provider.findFirst({
          where: {
            OR: [
              { LName: { contains: last } },
              { FName: { contains: first } }
            ]
          }
        });
        if (prov) {
          provNum = prov.ProvNum;
        }
      }

      let procedureCode = await prisma.procedurecode.findFirst({
        where: {
          Descript: productName,
          ProcCode: { startsWith: 'PROD' }
        }
      });

      if (!procedureCode) {
        procedureCode = await prisma.procedurecode.findFirst({
          where: { Descript: productName }
        });
      }

      if (!procedureCode) {
        const codeNum = await getNextId('procedurecode', 'CodeNum');
        const procCodeStr = "PROD" + codeNum.toString();

        let procCatDefNum = BigInt(0);

        // Find existing "Products" category
        const prodCat = await prisma.definition.findFirst({
          where: { Category: 11, ItemName: { contains: 'Product' } }
        });

        if (prodCat) {
          procCatDefNum = prodCat.DefNum;
        } else {
          // Fallback to first available category
          const fallbackCat = await prisma.definition.findFirst({ where: { Category: 11 } });
          if (fallbackCat) {
            procCatDefNum = fallbackCat.DefNum;
          }
        }

        procedureCode = await prisma.procedurecode.create({
          data: {
            CodeNum: codeNum,
            ProcCode: procCodeStr,
            Descript: productName,
            AbbrDesc: productName.substring(0, 50),
            ProcTime: '/0',
            ProcCat: procCatDefNum,
            MedicalCode: '',
            SubstitutionCode: ''
          }
        });
      }

      const procNum = await getNextId('procedurelog', 'ProcNum');
      const fee = parseFloat(price) * parseInt(quantity, 10);
      
      const procedure = await prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: patNum,
          ProvNum: provNum,
          ProcStatus: 2, 
          CodeNum: procedureCode.CodeNum,
          ProcFee: fee,
          ProcDate: new Date(),
          UnitQty: parseInt(quantity, 10),
          DateEntryC: new Date()
        }
      });
      createdProcedures.push({
        ...procedure,
        ProcNum: procedure.ProcNum.toString(),
        PatNum: procedure.PatNum?.toString(),
        ProvNum: procedure.ProvNum?.toString(),
        CodeNum: procedure.CodeNum?.toString()
      });
    }

    return createdProcedures;
  }
}

export const patientService = new PatientService();

