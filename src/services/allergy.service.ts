import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  getAllergyMeta,
  setAllergyMeta,
  mapUser,
  getAllergiesMeta,
} from '../utils/opendental-auth.util';

export class AllergyService {
  private async mapDocumentedBy(documentedBy?: string | null) {
    if (!documentedBy) return null;
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(documentedBy) },
    });
    if (!user) {
      return {
        _id: documentedBy,
        firstName: '',
        lastName: '',
        email: null,
      };
    }
    const mappedUser = await mapUser(user);
    return {
      _id: mappedUser._id,
      firstName: mappedUser.firstName,
      lastName: mappedUser.lastName,
      email: mappedUser.email ?? null,
    };
  }

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

    const documentedDate = data.documentedDate ?? new Date();
    const allergyMeta = {
      reaction: data.reaction ?? null,
      severity: data.severity ?? 'mild',
      documentedBy: data.documentedBy ?? null,
      documentedDate: documentedDate.toISOString(),
      isActive: data.isActive ?? true,
    };
    await setAllergyMeta(allergyNum, allergyMeta);

    const documentedByUser = await this.mapDocumentedBy(allergyMeta.documentedBy);

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: data.patientId,
      allergen: data.allergen,
      reaction: allergyMeta.reaction,
      severity: allergyMeta.severity,
      isActive: allergyMeta.isActive,
      documentedBy: documentedByUser,
      documentedDate,
    };
  }

  async getAllergiesByPatient(patientId: string, isActive?: boolean) {
    const allergies = await prisma.allergy.findMany({
      where: { PatNum: BigInt(patientId) },
      include: { allergydef: true },
    });

    const allergyNums = allergies.map((a) => a.AllergyNum);
    const metaMapData = await getAllergiesMeta(allergyNums);
    const metaMap = {
      get: (id: string) => metaMapData[id] || {}
    };

    const documentedByUserIds = Array.from(
      new Set(
        allergies
          .map((allergy) => metaMap.get(allergy.AllergyNum.toString())?.documentedBy)
          .filter((value): value is string => Boolean(value) && /^\d+$/.test(value))
      )
    );

    let documentedByMap = new Map<string, { _id: string; firstName: string; lastName: string; email: string | null }>();
    if (documentedByUserIds.length > 0) {
      const { getUsersMeta } = await import('../utils/opendental-auth.util');
      const users = await prisma.userod.findMany({
        where: { UserNum: { in: documentedByUserIds.map((id) => BigInt(id)) } },
      });
      const usersMeta = await getUsersMeta(users.map((u) => u.UserNum));

      const entries = await Promise.all(
        documentedByUserIds.map(async (docId) => {
          const user = users.find((u) => u.UserNum.toString() === docId);
          if (!user) {
            return [
              docId,
              { _id: docId, firstName: '', lastName: '', email: null },
            ] as const;
          }
          const mappedUser = await mapUser(user, usersMeta[user.UserNum.toString()]);
          return [
            docId,
            {
              _id: mappedUser._id,
              firstName: mappedUser.firstName,
              lastName: mappedUser.lastName,
              email: mappedUser.email ?? null,
            },
          ] as const;
        })
      );
      documentedByMap = new Map(entries);
    }

    const mappedAllergies = allergies.map((allergy) => ({
     id: allergy.AllergyNum.toString(),
    _id: allergy.AllergyNum.toString(),
    patientId,
  allergen: allergy.allergydef?.Description ?? 'Allergy',
  reaction: metaMap.get(allergy.AllergyNum.toString())?.reaction ?? null,
  severity: metaMap.get(allergy.AllergyNum.toString())?.severity ?? 'mild',
  isActive: metaMap.get(allergy.AllergyNum.toString())?.isActive ?? true,
  documentedBy:
    documentedByMap.get(metaMap.get(allergy.AllergyNum.toString())?.documentedBy ?? '') ??
    null,
  documentedDate: metaMap.get(allergy.AllergyNum.toString())?.documentedDate ?? null,
  onsetDate: metaMap.get(allergy.AllergyNum.toString())?.documentedDate ?? null,
}));

    if (isActive === undefined) return mappedAllergies;
    return mappedAllergies.filter((allergy) => allergy.isActive === isActive);
  }

  async getAllergyById(allergyId: string) {
    const allergy = await prisma.allergy.findUnique({
      where: { AllergyNum: BigInt(allergyId) },
      include: { allergydef: true },
    });
    if (!allergy) {
      throw new NotFoundError('Allergy not found');
    }

    const allergyMeta = await getAllergyMeta(allergy.AllergyNum);

    const documentedByUser = await this.mapDocumentedBy(allergyMeta.documentedBy);

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: allergy.PatNum?.toString() ?? null,
      allergen: allergy.allergydef?.Description ?? 'Allergy',
      reaction: allergyMeta.reaction ?? null,
      severity: allergyMeta.severity ?? 'mild',
      isActive: allergyMeta.isActive ?? true,
      documentedBy: documentedByUser,
      documentedDate: allergyMeta.documentedDate ?? null,
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

    const existingMeta = await getAllergyMeta(allergy.AllergyNum);
    const nextMeta = {
      reaction: updates.reaction ?? existingMeta.reaction ?? null,
      severity: updates.severity ?? existingMeta.severity ?? 'mild',
      documentedBy: updates.documentedBy ?? existingMeta.documentedBy ?? null,
      documentedDate:
        updates.documentedDate?.toISOString() ??
        existingMeta.documentedDate ??
        null,
      isActive: updates.isActive ?? existingMeta.isActive ?? true,
    };
    await setAllergyMeta(allergy.AllergyNum, nextMeta);

    const documentedByUser = await this.mapDocumentedBy(nextMeta.documentedBy);

    return {
      _id: allergy.AllergyNum.toString(),
      patientId: allergy.PatNum?.toString() ?? null,
      allergen: updates.allergen ?? allergy.allergydef?.Description ?? 'Allergy',
      reaction: nextMeta.reaction,
      severity: nextMeta.severity,
      isActive: nextMeta.isActive,
      documentedBy: documentedByUser,
      documentedDate: nextMeta.documentedDate,
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

  async getAllergies(patientId: string, isActive?: boolean) {
    return this.getAllergiesByPatient(patientId, isActive);
  }
}

export const allergyService = new AllergyService();
