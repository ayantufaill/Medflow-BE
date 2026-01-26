import { PatientInsuranceModel } from '../models/patient-insurance.model';
import { PatientModel } from '../models/patient.model';
import { InsuranceCompanyModel } from '../models/insurance-company.model';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

export class PatientInsuranceService {
  /**
   * Get all insurances for a patient
   */
  async getPatientInsurances(patientId: string, isActive?: boolean) {
    const query: any = { patientId };
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const insurances = await PatientInsuranceModel.find(query)
      .populate('insuranceCompanyId', 'name payerId')
      .sort({ insuranceType: 1, effectiveDate: -1 })
      .lean();

    return insurances;
  }

  /**
   * Get patient insurance by ID
   */
  async getPatientInsuranceById(patientInsuranceId: string) {
    const insurance = await PatientInsuranceModel.findById(patientInsuranceId)
      .populate('insuranceCompanyId')
      .populate('verifiedBy', 'firstName lastName')
      .lean();

    if (!insurance) {
      throw new NotFoundError('Patient insurance not found');
    }

    return insurance;
  }

  /**
   * Create patient insurance
   */
  async createPatientInsurance(
    patientId: string,
    data: {
      insuranceCompanyId: string;
      policyNumber: string;
      groupNumber?: string;
      subscriberName: string;
      subscriberDateOfBirth: Date;
      relationshipToPatient: string;
      insuranceType: string;
      effectiveDate: Date;
      expirationDate?: Date;
      copayAmount?: number;
      deductibleAmount?: number;
      autoVerify?: boolean;
      verificationStatus?: string;
      notes?: string;
    },
    createdBy?: string
  ) {
    // Verify patient exists
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Verify insurance company exists
    const insuranceCompany = await InsuranceCompanyModel.findById(data.insuranceCompanyId);
    if (!insuranceCompany) {
      throw new NotFoundError('Insurance company not found');
    }

    // Check if patient already has all three insurance types active
    const activeInsurances = await PatientInsuranceModel.find({
      patientId,
      isActive: true,
    });

    const activeTypes = activeInsurances.map((ins) => String(ins.insuranceType || '').toLowerCase());
    const allTypesPresent =
      activeTypes.includes('primary') &&
      activeTypes.includes('secondary') &&
      activeTypes.includes('tertiary');

    // Check if patient already has this specific insurance type active
    const existingInsuranceOfSameType = activeInsurances.find(
      (ins) => String(ins.insuranceType || '').toLowerCase() === data.insuranceType.toLowerCase()
    );

    if (allTypesPresent && !existingInsuranceOfSameType) {
      throw new ConflictError(
        'Patient already has all three insurance types (Primary, Secondary, and Tertiary). ' +
        'Please deactivate an existing insurance before adding a new one, or update an existing insurance instead.'
      );
    }

    if (existingInsuranceOfSameType) {
      // Deactivate existing insurance of same type
      (existingInsuranceOfSameType as any).isActive = false;
      await existingInsuranceOfSameType.save();
    }

    // Create new insurance
    const insurance = await PatientInsuranceModel.create({
      patientId,
      insuranceCompanyId: data.insuranceCompanyId,
      policyNumber: data.policyNumber,
      groupNumber: data.groupNumber,
      subscriberName: data.subscriberName,
      subscriberDateOfBirth: data.subscriberDateOfBirth,
      relationshipToPatient: data.relationshipToPatient,
      insuranceType: data.insuranceType,
      effectiveDate: data.effectiveDate,
      expirationDate: data.expirationDate,
      copayAmount: data.copayAmount,
      deductibleAmount: data.deductibleAmount,
      autoVerify: data.autoVerify !== undefined ? data.autoVerify : true,
      verificationStatus: data.verificationStatus || 'pending',
      isActive: true,
      notes: data.notes,
    });

    // Log activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'patient_insurance',
        insurance._id.toString(),
        undefined,
        { patientId, insuranceType: data.insuranceType, policyNumber: data.policyNumber },
        undefined,
        undefined,
        'low'
      );
    }

    return this.getPatientInsuranceById(insurance._id.toString());
  }

  /**
   * Update patient insurance
   */
  async updatePatientInsurance(
    patientInsuranceId: string,
    updates: {
      policyNumber?: string;
      groupNumber?: string;
      subscriberName?: string;
      subscriberDateOfBirth?: Date;
      relationshipToPatient?: string;
      insuranceType?: string;
      effectiveDate?: Date;
      expirationDate?: Date;
      copayAmount?: number;
      deductibleAmount?: number;
      isActive?: boolean;
      autoVerify?: boolean;
      verificationStatus?: string;
      notes?: string;
    },
    updatedBy?: string
  ) {
    const insurance = await PatientInsuranceModel.findById(patientInsuranceId);
    if (!insurance) {
      throw new NotFoundError('Patient insurance not found');
    }

    // If changing insurance type, check for conflicts
    if (updates.insuranceType && updates.insuranceType !== String(insurance.insuranceType || '')) {
      const existingInsurance = await PatientInsuranceModel.findOne({
        patientId: insurance.patientId,
        insuranceType: updates.insuranceType,
        isActive: true,
        _id: { $ne: patientInsuranceId },
      });

      if (existingInsurance) {
        throw new ConflictError(
          `Patient already has an active ${updates.insuranceType} insurance`
        );
      }
    }

    const oldValues = {
      policyNumber: insurance.policyNumber,
      insuranceType: insurance.insuranceType,
      isActive: insurance.isActive,
    };

    // Update fields
    if (updates.policyNumber !== undefined) (insurance as any).policyNumber = updates.policyNumber;
    if (updates.groupNumber !== undefined) (insurance as any).groupNumber = updates.groupNumber;
    if (updates.subscriberName !== undefined) (insurance as any).subscriberName = updates.subscriberName;
    if (updates.subscriberDateOfBirth !== undefined)
      (insurance as any).subscriberDateOfBirth = updates.subscriberDateOfBirth;
    if (updates.relationshipToPatient !== undefined)
      (insurance as any).relationshipToPatient = updates.relationshipToPatient;
    if (updates.insuranceType !== undefined) (insurance as any).insuranceType = updates.insuranceType;
    if (updates.effectiveDate !== undefined) (insurance as any).effectiveDate = updates.effectiveDate;
    if (updates.expirationDate !== undefined) (insurance as any).expirationDate = updates.expirationDate;
    if (updates.copayAmount !== undefined) (insurance as any).copayAmount = updates.copayAmount;
    if (updates.deductibleAmount !== undefined) (insurance as any).deductibleAmount = updates.deductibleAmount;
    if (updates.isActive !== undefined) (insurance as any).isActive = updates.isActive;
    if (updates.autoVerify !== undefined) (insurance as any).autoVerify = updates.autoVerify;
    if (updates.verificationStatus !== undefined)
      (insurance as any).verificationStatus = updates.verificationStatus;
    if (updates.notes !== undefined) (insurance as any).notes = updates.notes;

    // Update verification info if status changed
    if (updates.verificationStatus === 'verified' && updatedBy) {
      (insurance as any).verifiedBy = updatedBy;
      (insurance as any).verificationDate = new Date();
    }

    await insurance.save();

    // Log activity
    if (updatedBy) {
      await logActivity(
        updatedBy,
        'updated',
        'patient_insurance',
        patientInsuranceId,
        oldValues,
        updates,
        undefined,
        undefined,
        'low'
      );
    }

    return this.getPatientInsuranceById(patientInsuranceId);
  }

  /**
   * Delete patient insurance (soft delete)
   */
  async deletePatientInsurance(patientInsuranceId: string, deletedBy?: string) {
    const insurance = await PatientInsuranceModel.findById(patientInsuranceId);
    if (!insurance) {
      throw new NotFoundError('Patient insurance not found');
    }

    // Hard delete
    await PatientInsuranceModel.findByIdAndDelete(patientInsuranceId);

    // Log activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'patient_insurance',
        patientInsuranceId,
        insurance.toObject(), // before
        null,                 // after (deleted)
        undefined,
        undefined,
        'medium'
      );
    }

    return { message: 'Patient insurance deleted successfully' };
  }

}

export const patientInsuranceService = new PatientInsuranceService();

