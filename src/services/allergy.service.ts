import { AllergyModel } from '../models/allergy.model';
import { PatientModel } from '../models/patient.model';
import { UserModel } from '../models/user.model';
import { NotFoundError } from '../utils/error.util';

export class AllergyService {
  /**
   * Create a new allergy
   */
  async createAllergy(
    data: {
      patientId: string;
      allergen: string;
      reaction: string;
      severity: 'mild' | 'moderate' | 'severe';
      documentedBy: string;
      documentedDate: Date;
      isActive?: boolean;
    }
  ) {
    // Validate patient exists
    const patient = await PatientModel.findById(data.patientId);
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Validate documented_by user exists
    const user = await UserModel.findById(data.documentedBy);
    if (!user) {
      throw new NotFoundError('Invalid documented_by');
    }

    const allergy = new AllergyModel({
      patientId: data.patientId,
      allergen: data.allergen.trim(),
      reaction: data.reaction.trim(),
      severity: data.severity,
      documentedBy: data.documentedBy,
      documentedDate: data.documentedDate,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    await allergy.save();
    return allergy;
  }

  /**
   * Get all allergies for a patient
   */
  async getAllergies(patientId: string) {
    // Validate patient exists
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const allergies = await AllergyModel.find({ patientId })
      .populate('documentedBy', 'firstName lastName email')
      .sort({ documentedDate: -1 })
      .lean();

    return allergies;
  }

  /**
   * Get allergy by ID
   */
  async getAllergyById(allergyId: string) {
    const allergy = await AllergyModel.findById(allergyId)
      .populate('patientId', 'firstName lastName patientCode')
      .populate('documentedBy', 'firstName lastName email')
      .lean();

    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    return allergy;
  }

  /**
   * Update allergy
   */
  async updateAllergy(
    allergyId: string,
    updates: {
      allergen?: string;
      reaction?: string;
      severity?: 'mild' | 'moderate' | 'severe';
      documentedBy?: string;
      documentedDate?: Date;
      isActive?: boolean;
    }
  ) {
    const allergy = await AllergyModel.findById(allergyId);
    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    // If documentedBy is being updated, validate user exists
    if (updates.documentedBy) {
      const user = await UserModel.findById(updates.documentedBy);
      if (!user) {
        throw new NotFoundError('Invalid documented_by');
      }
    }

    // Update fields
    if (updates.allergen !== undefined) {
      allergy.allergen = updates.allergen.trim();
    }
    if (updates.reaction !== undefined) {
      allergy.reaction = updates.reaction.trim();
    }
    if (updates.severity !== undefined) {
      (allergy as any).severity = updates.severity;
    }
    if (updates.documentedBy !== undefined) {
      (allergy as any).documentedBy = updates.documentedBy;
    }
    if (updates.documentedDate !== undefined) {
      (allergy as any).documentedDate = updates.documentedDate;
    }
    if (updates.isActive !== undefined) {
      (allergy as any).isActive = updates.isActive;
    }

    await allergy.save();
    return allergy;
  }

  /**
   * Delete allergy (soft delete: set isActive = false)
   */
  async deleteAllergy(allergyId: string) {
    const allergy = await AllergyModel.findByIdAndDelete(allergyId);

    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    return { message: 'Allergy deleted successfully' };
  }

}

export const allergyService = new AllergyService();
