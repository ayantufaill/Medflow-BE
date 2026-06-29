import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class PatientMembershipService {
  private FKEY_TYPE = 220; // Type identifier for patient memberships

  async getPatientMemberships(patientId: string) {
    const patNum = BigInt(patientId);
    const prefs = await prisma.userodpref.findMany({
      where: {
        Fkey: patNum,
        FkeyType: this.FKEY_TYPE,
      },
    });

    return prefs.map((pref) => {
      try {
        const payload = JSON.parse(pref.ValueString || '{}');
        return {
          id: pref.UserOdPrefNum.toString(),
          patientId: pref.Fkey?.toString() ?? '',
          ...payload,
        };
      } catch {
        return {
          id: pref.UserOdPrefNum.toString(),
          patientId: pref.Fkey?.toString() ?? '',
          raw: pref.ValueString,
        };
      }
    });
  }

  async createPatientMembership(patientId: string, data: any) {
    const patNum = BigInt(patientId);
    const nextPrefId = await getNextId('userodpref', 'UserOdPrefNum');

    const serializedData = {
      ...data,
      createdAt: new Date().toISOString(),
    };

    const created = await prisma.userodpref.create({
      data: {
        UserOdPrefNum: nextPrefId,
        Fkey: patNum,
        FkeyType: this.FKEY_TYPE,
        ValueString: JSON.stringify(serializedData),
      },
    });

    return {
      id: created.UserOdPrefNum.toString(),
      patientId: patientId,
      ...serializedData,
    };
  }

  async deletePatientMembership(patientId: string, membershipId: string) {
    const prefId = BigInt(membershipId);
    const patNum = BigInt(patientId);

    const existing = await prisma.userodpref.findFirst({
      where: {
        UserOdPrefNum: prefId,
        Fkey: patNum,
        FkeyType: this.FKEY_TYPE,
      },
    });

    if (!existing) {
      throw new NotFoundError('Patient membership not found');
    }

    await prisma.userodpref.delete({
      where: { UserOdPrefNum: prefId },
    });

    return { success: true };
  }
}

export const patientMembershipService = new PatientMembershipService();
