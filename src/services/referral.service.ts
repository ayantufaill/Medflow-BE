import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class ReferralService {
  async getAllReferrals(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { LName: { contains: search } },
        { FName: { contains: search } },
        { Title: { contains: search } },
      ];
    }

    const referrals = await prisma.referral.findMany({
      where,
      orderBy: { LName: 'asc' },
    });

    return referrals.map((ref) => ({
      _id: ref.ReferralNum.toString(),
      firstName: ref.FName ?? '',
      lastName: ref.LName ?? '',
      title: ref.Title ?? null,
      phone: ref.Telephone ?? null,
      email: ref.EMail ?? null,
      isActive: ref.IsHidden ? false : true,
    }));
  }

  async getReferralById(referralId: string) {
    const ref = await prisma.referral.findUnique({
      where: { ReferralNum: BigInt(referralId) },
    });
    if (!ref) {
      throw new NotFoundError('Referral not found');
    }

    return {
      _id: ref.ReferralNum.toString(),
      firstName: ref.FName ?? '',
      lastName: ref.LName ?? '',
      title: ref.Title ?? null,
      phone: ref.Telephone ?? null,
      email: ref.EMail ?? null,
      isActive: ref.IsHidden ? false : true,
    };
  }

  async createReferral(data: {
    firstName: string;
    lastName: string;
    title?: string;
    phone?: string;
    email?: string;
  }) {
    const nextId = await getNextId('referral', 'ReferralNum');
    const ref = await prisma.referral.create({
      data: {
        ReferralNum: nextId,
        FName: data.firstName,
        LName: data.lastName,
        Title: data.title ?? null,
        Telephone: data.phone ?? null,
        EMail: data.email ?? null,
        IsHidden: 0,
      },
    });

    return ref;
  }

  async updateReferral(
    referralId: string,
    updates: Partial<{ firstName: string; lastName: string; title: string; phone: string; email: string; isActive: boolean }>
  ) {
    const ref = await prisma.referral.findUnique({
      where: { ReferralNum: BigInt(referralId) },
    });
    if (!ref) {
      throw new NotFoundError('Referral not found');
    }

    const updated = await prisma.referral.update({
      where: { ReferralNum: ref.ReferralNum },
      data: {
        FName: updates.firstName ?? undefined,
        LName: updates.lastName ?? undefined,
        Title: updates.title ?? undefined,
        Telephone: updates.phone ?? undefined,
        EMail: updates.email ?? undefined,
        IsHidden: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
      },
    });

    return updated;
  }

  async deleteReferral(referralId: string) {
    const ref = await prisma.referral.findUnique({
      where: { ReferralNum: BigInt(referralId) },
    });
    if (!ref) {
      throw new NotFoundError('Referral not found');
    }

    await prisma.referral.delete({ where: { ReferralNum: ref.ReferralNum } });
    return { message: 'Referral deleted successfully' };
  }
}

export const referralService = new ReferralService();
