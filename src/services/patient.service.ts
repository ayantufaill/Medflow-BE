import { PatientModel } from '../models/patient.model';
import { InvoiceModel } from '../models/invoice.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

/**
 * Generate unique patient code (e.g., PAT001, PAT002, etc.)
 */
async function generatePatientCode(): Promise<string> {
  // Find the highest numbered patient code
  const lastPatient = await PatientModel.findOne()
    .sort({ patientCode: -1 })
    .select('patientCode')
    .lean();

  if (!lastPatient || !lastPatient.patientCode) {
    return 'PAT001';
  }

  // Extract number from code (e.g., "PAT001" -> 1)
  const patientCodeStr = String(lastPatient.patientCode || '');
  const match = patientCodeStr.match(/\d+$/);
  if (!match) {
    return 'PAT001';
  }

  const lastNumber = parseInt(match[0], 10);
  const nextNumber = lastNumber + 1;

  // Format as PAT001, PAT002, etc. (3 digits minimum)
  return `PAT${nextNumber.toString().padStart(3, '0')}`;
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
    const query: any = {};

    // Search filter - search by name, DOB, phone, email, patient code
    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);

      if (searchTerms.length > 1) {
        // Multiple words - try both orders for name
        const firstNameSearch = searchTerms[0];
        const lastNameSearch = searchTerms.slice(1).join(' ');
        const reverseFirstNameSearch = searchTerms[searchTerms.length - 1];
        const reverseLastNameSearch = searchTerms.slice(0, -1).join(' ');

        query.$or = [
          { patientCode: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phonePrimary: { $regex: search, $options: 'i' } },
          { phoneSecondary: { $regex: search, $options: 'i' } },
          {
            $and: [
              { firstName: { $regex: firstNameSearch, $options: 'i' } },
              { lastName: { $regex: lastNameSearch, $options: 'i' } },
            ],
          },
          {
            $and: [
              { firstName: { $regex: reverseFirstNameSearch, $options: 'i' } },
              { lastName: { $regex: reverseLastNameSearch, $options: 'i' } },
            ],
          },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { referralSource: { $regex: search, $options: 'i' } },
        ];
      } else {
        // Single word - search in all fields
        query.$or = [
          { patientCode: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { phonePrimary: { $regex: search, $options: 'i' } },
          { phoneSecondary: { $regex: search, $options: 'i' } },
          { referralSource: { $regex: search, $options: 'i' } },
        ];
      }
    }

    // Status filter
    if (status !== undefined && status !== '') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    // Date of birth range filter
    if (dobStart || dobEnd) {
      query.dateOfBirth = {};
      if (dobStart) {
        const startDate = new Date(dobStart);
        startDate.setHours(0, 0, 0, 0);
        query.dateOfBirth.$gte = startDate;
      }
      if (dobEnd) {
        const endDate = new Date(dobEnd);
        endDate.setHours(23, 59, 59, 999);
        query.dateOfBirth.$lte = endDate;
      }
    }

    const [patients, total] = await Promise.all([
      PatientModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PatientModel.countDocuments(query),
    ]);

    return {
      patients,
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
    const patient = await PatientModel.findById(patientId).lean();

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  /**
   * Get patient by ID including SSN (for authorized users only)
   */
  async getPatientByIdWithSSN(patientId: string) {
    const patient = await PatientModel.findById(patientId).lean();

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  /**
   * Get patient account balance summary
   */
  async getPatientBalance(patientId: string) {
    const patient = await PatientModel.findById(patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const invoices = await InvoiceModel.find({
      patientId,
      status: { $in: ['draft', 'submitted', 'partially_paid', 'denied'] },
    })
      .select('balanceDue')
      .lean();

    const totalBalance = invoices.reduce((sum, invoice) => sum + (Number(invoice.balanceDue) || 0), 0);

    return {
      patientId,
      totalBalance,
      openInvoices: invoices.length,
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
    const query: any = {
      firstName: { $regex: new RegExp(`^${data.firstName}$`, 'i') },
      lastName: { $regex: new RegExp(`^${data.lastName}$`, 'i') },
      dateOfBirth: data.dateOfBirth,
    };

    // Also check phone or email if provided
    if (data.phonePrimary || data.email) {
      query.$or = [];
      if (data.phonePrimary) {
        query.$or.push({ phonePrimary: data.phonePrimary });
        query.$or.push({ phoneSecondary: data.phonePrimary });
      }
      if (data.email) {
        query.$or.push({ email: data.email.toLowerCase() });
      }
    }

    const duplicates = await PatientModel.find(query)
      .select('_id patientCode firstName lastName dateOfBirth phonePrimary email')
      .lean();

    return duplicates;
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

    // Create patient
    const patient = await PatientModel.create({
      patientCode,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      preferredName: data.preferredName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender || 'unknown',
      ssn: data.ssn && data.ssn.trim() ? data.ssn.replace(/-/g, '').trim() : undefined, // Store as digits only, undefined if empty
      phonePrimary: data.phonePrimary,
      phoneSecondary: data.phoneSecondary,
      email: data.email?.toLowerCase(),
      address: data.address,
      emergencyContact: data.emergencyContact,
      preferredLanguage: data.preferredLanguage || 'en',
      communicationPreference: data.communicationPreference || 'phone',
      portalAccessEnabled: data.portalAccessEnabled !== undefined ? data.portalAccessEnabled : false,
      userAccountId: data.userAccountId,
      lastVisitDate: data.lastVisitDate,
      referralSource: data.referralSource,
      notes: data.notes,
      isActive: true,
    });

    // Log activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'patients',
        patient._id.toString(),
        undefined,
        { patientCode: patient.patientCode, firstName: patient.firstName, lastName: patient.lastName },
        undefined,
        undefined,
        'low'
      );
    }

    return this.getPatientByIdWithSSN(patient._id.toString());
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
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const oldValues = {
      firstName: patient.firstName,
      lastName: patient.lastName,
      phonePrimary: patient.phonePrimary,
      email: patient.email,
      isActive: patient.isActive,
    };

    // Update fields - handle empty strings to clear optional fields
    if (updates.firstName !== undefined) patient.firstName = updates.firstName;
    if (updates.lastName !== undefined) patient.lastName = updates.lastName;
    if (updates.middleName !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.middleName.trim();
      patient.middleName = trimmed ? trimmed : null;
    }
    if (updates.preferredName !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.preferredName.trim();
      patient.preferredName = trimmed ? trimmed : null;
    }
    if (updates.dateOfBirth !== undefined) (patient as any).dateOfBirth = updates.dateOfBirth;
    if (updates.gender !== undefined) (patient as any).gender = updates.gender;
    if (updates.ssn !== undefined) {
      // Store SSN as digits only (remove hyphens if present)
      // If empty string, set to null to clear the field (Mongoose uses null, not undefined)
      const ssnValue = updates.ssn && updates.ssn.trim()
        ? updates.ssn.replace(/-/g, '').trim()
        : null;
      patient.ssn = ssnValue;
      // Explicitly mark SSN as modified to ensure it's saved (important for fields with select: false)
      patient.markModified('ssn');
    }
    if (updates.phonePrimary !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.phonePrimary.trim();
      patient.phonePrimary = trimmed ? trimmed : null;
    }
    if (updates.phoneSecondary !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.phoneSecondary.trim();
      patient.phoneSecondary = trimmed ? trimmed : null;
    }
    if (updates.email !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.email.trim();
      patient.email = trimmed ? trimmed.toLowerCase() : null;
    }
    if (updates.address !== undefined) {
      // Handle address object - if all fields are empty, set to null
      const address = updates.address;
      if (
        (!address.line1 || !address.line1.trim()) &&
        (!address.line2 || !address.line2.trim()) &&
        (!address.city || !address.city.trim()) &&
        (!address.state || !address.state.trim()) &&
        (!address.postalCode || !address.postalCode.trim())
      ) {
        patient.address = null;
      } else {
        // Update address fields, empty strings clear individual fields (use null for Mongoose)
        patient.address = {
          line1: address.line1?.trim() ? address.line1.trim() : null,
          line2: address.line2?.trim() ? address.line2.trim() : null,
          city: address.city?.trim() ? address.city.trim() : null,
          state: address.state?.trim() ? address.state.trim() : null,
          postalCode: address.postalCode?.trim() ? address.postalCode.trim() : null,
        };
      }
    }
    if (updates.emergencyContact !== undefined) {
      // Handle emergency contact - if all fields are empty, set to null
      const ec = updates.emergencyContact;
      if (
        (!ec.name || !ec.name.trim()) &&
        (!ec.relationship || !ec.relationship.trim()) &&
        (!ec.phone || !ec.phone.trim())
      ) {
        patient.emergencyContact = null;
      } else {
        // Update emergency contact fields, empty strings clear individual fields (use null for Mongoose)
        patient.emergencyContact = {
          name: ec.name?.trim() ? ec.name.trim() : null,
          relationship: ec.relationship?.trim() ? ec.relationship.trim() : null,
          phone: ec.phone?.trim() ? ec.phone.trim() : null,
        };
      }
    }
    if (updates.preferredLanguage !== undefined) {
      patient.preferredLanguage = updates.preferredLanguage.trim() || 'en';
    }
    if (updates.communicationPreference !== undefined) {
      (patient as any).communicationPreference = updates.communicationPreference;
    }
    if (updates.portalAccessEnabled !== undefined) (patient as any).portalAccessEnabled = updates.portalAccessEnabled;
    if (updates.isActive !== undefined) (patient as any).isActive = updates.isActive;
    if (updates.lastVisitDate !== undefined) {
      // Empty/null date clears the field (use null for Mongoose)
      (patient as any).lastVisitDate = updates.lastVisitDate || null;
    }
    if (updates.referralSource !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.referralSource.trim();
      patient.referralSource = trimmed ? trimmed : null;
    }
    if (updates.notes !== undefined) {
      // Empty string clears the field (use null for Mongoose)
      const trimmed = updates.notes.trim();
      patient.notes = trimmed ? trimmed : null;
    }

    await patient.save();

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
    return this.getPatientByIdWithSSN(patientId);
  }

  /**
   * Delete patient (soft delete by setting isActive to false)
   */
  async deletePatient(patientId: string, deletedBy?: string) {
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    (patient as any).isActive = false;
    await patient.save();

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
