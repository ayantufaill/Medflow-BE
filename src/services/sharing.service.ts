import { prisma } from '../config/db';

export class SharingService {
  async getSharingPolicy(groupId: number): Promise<Record<string, string>> {
    const policies = await prisma.group_sharing_policy.findMany({
      where: { group_id: groupId },
    });
    
    const policyMap: Record<string, string> = {};
    for (const p of policies) {
      if (p.clinic_id === null) {
        policyMap[p.category] = p.mode;
      }
    }
    return policyMap;
  }

  async updateSharingPolicy(groupId: number, category: string, mode: string, updatedBy: string): Promise<void> {
    const existing = await prisma.group_sharing_policy.findFirst({
      where: { group_id: groupId, category, clinic_id: null },
    });

    if (existing) {
      await prisma.group_sharing_policy.update({
        where: { id: existing.id },
        data: { mode, updated_by: BigInt(updatedBy), updated_at: new Date() },
      });
    } else {
      await prisma.group_sharing_policy.create({
        data: {
          group_id: groupId,
          category,
          mode,
          clinic_id: null,
          updated_by: BigInt(updatedBy),
        },
      });
    }
  }
}

export const sharingService = new SharingService();

