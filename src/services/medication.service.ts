import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class MedicationService {
  async getAllMedications(search?: string) {
    const where: any = {};
    if (search) {
      where.MedName = { contains: search };
    }
    const medications = await prisma.medication.findMany({
      where,
      orderBy: { MedName: 'asc' },
    });

    return medications.map((med) => ({
      _id: med.MedicationNum?.toString() ?? med.MedName ?? '',
      name: med.MedName ?? '',
      genericName: med.GenericNum?.toString() ?? null,
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
      isActive: medication.IsHidden ? false : true,
      notes: medication.Notes ?? null,
      rxCui: medication.RxCui?.toString() ?? null,
    };
  }

  async createMedication(data: {
    name: string;
    genericName?: string | null;
    notes?: string | null;
    rxCui?: number | string | null;
    isActive?: boolean;
  }) {
    // Check if medication with same name already exists
    const existing = await prisma.medication.findFirst({
      where: { MedName: data.name },
    });
    if (existing) {
      throw new ConflictError('Medication with this name already exists');
    }

    let genericNum: bigint | null = null;
    if (data.genericName) {
      const genericMed = await prisma.medication.findFirst({
        where: {
          OR: [
            ...( /^\d+$/.test(data.genericName) ? [{ MedicationNum: BigInt(data.genericName) }] : [] ),
            { MedName: data.genericName },
          ]
        }
      });
      if (genericMed) {
        genericNum = genericMed.MedicationNum;
      }
    }

    const nextId = await getNextId('medication', 'MedicationNum');
    const medication = await prisma.medication.create({
      data: {
        MedicationNum: nextId,
        MedName: data.name,
        GenericNum: genericNum,
        Notes: data.notes ?? null,
        RxCui: data.rxCui ? BigInt(data.rxCui) : null,
        IsHidden: data.isActive === false ? 1 : 0,
        DateTStamp: new Date(),
      },
    });

    return {
      _id: medication.MedicationNum.toString(),
      name: medication.MedName ?? '',
      genericName: medication.GenericNum?.toString() ?? null,
      isActive: medication.IsHidden ? false : true,
      notes: medication.Notes ?? null,
      rxCui: medication.RxCui?.toString() ?? null,
    };
  }

  async updateMedication(
    medicationId: string,
    data: {
      name?: string;
      genericName?: string | null;
      notes?: string | null;
      rxCui?: number | string | null;
      isActive?: boolean;
    }
  ) {
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

    if (data.name && data.name !== medication.MedName) {
      const existing = await prisma.medication.findFirst({
        where: { MedName: data.name },
      });
      if (existing) {
        throw new ConflictError('Medication with this name already exists');
      }
    }

    let genericNum: bigint | null | undefined = undefined;
    if (data.genericName !== undefined) {
      if (data.genericName === null || data.genericName === '') {
        genericNum = null;
      } else {
        const genericMed = await prisma.medication.findFirst({
          where: {
            OR: [
              ...( /^\d+$/.test(data.genericName) ? [{ MedicationNum: BigInt(data.genericName) }] : [] ),
              { MedName: data.genericName },
            ]
          }
        });
        genericNum = genericMed ? genericMed.MedicationNum : null;
      }
    }

    const updated = await prisma.medication.update({
      where: { MedicationNum: medication.MedicationNum },
      data: {
        MedName: data.name ?? undefined,
        GenericNum: genericNum,
        Notes: data.notes !== undefined ? (data.notes ?? null) : undefined,
        RxCui: data.rxCui !== undefined ? (data.rxCui ? BigInt(data.rxCui) : null) : undefined,
        IsHidden: data.isActive !== undefined ? (data.isActive ? 0 : 1) : undefined,
        DateTStamp: new Date(),
      },
    });

    return {
      _id: updated.MedicationNum.toString(),
      name: updated.MedName ?? '',
      genericName: updated.GenericNum?.toString() ?? null,
      isActive: updated.IsHidden ? false : true,
      notes: updated.Notes ?? null,
      rxCui: updated.RxCui?.toString() ?? null,
    };
  }
}

export const medicationService = new MedicationService();
