import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapContactPreferenceToDb,
  mapGenderToDb,
  mapPatientToApi,
} from '../utils/opendental-mappers.util';

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

    return {
      patients: patients.map(mapPatientToApi),
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

    const mapped = mapPatientToApi(patient);
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

    return mapPatientToApi(patient);
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

    return duplicates.map(mapPatientToApi);
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
      dateOfBirth: Date;
      gender?: string;
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
      notes?: string;
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
      dateOfBirth?: Date;
      gender?: string;
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
      notes?: string;
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

    const updated = await prisma.patient.update({
      where: { PatNum: BigInt(patientId) },
      data: {
        FName: updates.firstName ?? undefined,
        LName: updates.lastName ?? undefined,
        MiddleI: updates.middleName !== undefined ? (updates.middleName.trim() || null) : undefined,
        Preferred:
          updates.preferredName !== undefined ? (updates.preferredName.trim() || null) : undefined,
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
    }

    // Always return patient with SSN included
    return this.getPatientByIdWithSSN(updated.PatNum.toString());
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
    }

    return { message: 'Patient deactivated successfully' };
  }
}

export const patientService = new PatientService();
