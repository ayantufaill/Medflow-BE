import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class MedicationService {
  async getAllMedications(search?: string) {
    const where: any = {};
    if (search) {
      where.MedName = { contains: search, mode: 'insensitive' };
    }
    const medications = await prisma.medication.findMany({
      where,
      orderBy: { MedName: 'asc' },
    });

    return medications.map((med) => ({
      _id: med.MedicationNum?.toString() ?? med.MedName ?? '',
      name: med.MedName ?? '',
      genericName: med.GenericNum?.toString() ?? null,
      strength: med.Strength ?? null,
      isActive: med.IsHidden ? false : true,
    }));
  }

  async getMedicationById(medicationId: string) {
    const medication = await prisma.medication.findFirst({
      where: {
        OR: [
          ...( /^\d+$/.test(medicationId) ? [{ MedicationNum: BigInt(medicationId) }] : [] ),
          { MedName: medicationId },
        ],
      },
    });
    if (!medication) {
      throw new NotFoundError('Medication not found');
    }

    return {
      _id: medication.MedicationNum?.toString() ?? medication.MedName ?? '',
      name: medication.MedName ?? '',
      genericName: medication.GenericNum?.toString() ?? null,
      strength: medication.Strength ?? null,
      isActive: medication.IsHidden ? false : true,
    };
  }
}

export const medicationService = new MedicationService();
