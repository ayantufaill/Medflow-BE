import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class AllergyService {
  async createAllergy(data: {
    patientId: string;
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
    documentedBy: string;
    documentedDate?: Date;
    isActive?: boolean;
  }) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(data.patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const allergyDefNum = await getNextId('allergydef', 'AllergyDefNum');
    const allergyNum = await getNextId('allergy', 'AllergyNum');

    await prisma.allergydef.create({
      data: {
        AllergyDefNum: allergyDefNum,
        Description: data.allergen,
        IsHidden: 0,
      },
    });

    const allergy = await prisma.allergy.create({
      data: {
        AllergyNum: allergyNum,
        AllergyDefNum: allergyDefNum,
        PatNum: BigInt(data.patientId),
        DateTStamp: new Date(),
      },
    });

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: data.patientId,
      allergen: data.allergen,
      reaction: data.reaction,
      severity: data.severity,
      isActive: true,
      documentedBy: data.documentedBy,
      documentedDate: new Date(),
    };
  }

  async getAllergiesByPatient(patientId: string) {
    const allergies = await prisma.allergy.findMany({
      where: { PatNum: BigInt(patientId) },
      include: { allergydef: true },
    });

    return allergies.map((allergy) => ({
      _id: allergy.AllergyNum.toString(),
      patientId,
      allergen: allergy.allergydef?.Description ?? 'Allergy',
      reaction: null,
      severity: 'mild',
      isActive: true,
      documentedBy: null,
      documentedDate: null,
    }));
  }

  async getAllergyById(allergyId: string) {
    const allergy = await prisma.allergy.findUnique({
      where: { AllergyNum: BigInt(allergyId) },
      include: { allergydef: true },
    });
    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: allergy.PatNum?.toString() ?? null,
      allergen: allergy.allergydef?.Description ?? 'Allergy',
      reaction: null,
      severity: 'mild',
      isActive: true,
      documentedBy: null,
      documentedDate: null,
    };
  }

  async updateAllergy(allergyId: string, updates: {
    allergen?: string;
    reaction?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    documentedBy?: string;
    documentedDate?: Date;
    isActive?: boolean;
  }) {
    const allergy = await prisma.allergy.findUnique({
      where: { AllergyNum: BigInt(allergyId) },
      include: { allergydef: true },
    });
    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    if (updates.allergen && allergy.AllergyDefNum) {
      await prisma.allergydef.update({
        where: { AllergyDefNum: allergy.AllergyDefNum },
        data: { Description: updates.allergen },
      });
    }

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: allergy.PatNum?.toString() ?? null,
      allergen: updates.allergen ?? allergy.allergydef?.Description ?? 'Allergy',
      reaction: updates.reaction ?? null,
      severity: updates.severity ?? 'mild',
      isActive: true,
      documentedBy: null,
      documentedDate: null,
    };
  }

  async deleteAllergy(allergyId: string) {
    const allergy = await prisma.allergy.findUnique({
      where: { AllergyNum: BigInt(allergyId) },
    });
    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    await prisma.allergy.delete({ where: { AllergyNum: allergy.AllergyNum } });
    return { message: 'Allergy deleted successfully' };
  }

  async getAllergies(patientId: string) {
    return this.getAllergiesByPatient(patientId);
  }
}

export const allergyService = new AllergyService();
