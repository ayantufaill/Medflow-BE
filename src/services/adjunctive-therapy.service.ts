import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

// OpenDental userodpref.FkeyType tinyint range
const ADJUNCTIVE_THERAPY_FKEYTYPE = 213;

export class AdjunctiveTherapyService {
  private async getSetting(patientId: bigint) {
    const pref = await prisma.userodpref.findFirst({
      where: {
        Fkey: patientId,
        FkeyType: ADJUNCTIVE_THERAPY_FKEYTYPE,
      },
    });
    if (!pref || !pref.ValueString) {
      return {
        products: [],
        labFees: [],
        hygieneTools: [],
        fluoride: { selected: '', frequency: '' },
        toothbrush: { selected: '', type: '' },
        notes: '',
      };
    }
    try {
      return JSON.parse(pref.ValueString);
    } catch {
      return {};
    }
  }

  private async saveSetting(patientId: bigint, value: any) {
    const stringValue = JSON.stringify(value);
    const existing = await prisma.userodpref.findFirst({
      where: {
        Fkey: patientId,
        FkeyType: ADJUNCTIVE_THERAPY_FKEYTYPE,
      },
    });

    if (existing) {
      await prisma.userodpref.update({
        where: { UserOdPrefNum: existing.UserOdPrefNum },
        data: { ValueString: stringValue },
      });
    } else {
      // Direct raw query to get next UserOdPrefNum sequence key
      const nextIdResult = await prisma.$queryRawUnsafe<[{ nextId: bigint }]>(
        'SELECT COALESCE(MAX("UserOdPrefNum"), 0) + 1 AS "nextId" FROM "userodpref"'
      );
      const nextId = nextIdResult[0]?.nextId ?? BigInt(1);

      await prisma.userodpref.create({
        data: {
          UserOdPrefNum: nextId,
          Fkey: patientId,
          FkeyType: ADJUNCTIVE_THERAPY_FKEYTYPE,
          ValueString: stringValue,
        },
      });
    }
    return value;
  }

  async getPatientAdjunctiveTherapy(patientId: string) {
    const patNum = BigInt(patientId);
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patNum },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return await this.getSetting(patNum);
  }

  async savePatientAdjunctiveTherapy(patientId: string, data: any) {
    const patNum = BigInt(patientId);
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patNum },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const payload = {
      products: data.products ?? [],
      labFees: data.labFees ?? [],
      hygieneTools: data.hygieneTools ?? [],
      fluoride: data.fluoride ?? { selected: '', frequency: '' },
      toothbrush: data.toothbrush ?? { selected: '', type: '' },
      notes: data.notes ?? '',
    };

    return await this.saveSetting(patNum, payload);
  }
}

export const adjunctiveTherapyService = new AdjunctiveTherapyService();
