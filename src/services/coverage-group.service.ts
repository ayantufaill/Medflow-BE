import { createCommlogJson, getCommlogJsonEntries } from '../utils/commlog-json.util';
import { prisma } from '../config/db';

export interface CoverageGroupMeta {
  [key: string]: any;
  type: 'coverage_group';
  groupId: string;
  name: string;
  codes: string[];
  frequency?: { count?: string; period?: string } | null;
  limitations?: { lifeLimit?: string; ageLimit?: string } | null;
  downgrades?: { subCheck?: boolean; code?: string } | null;
  patientId?: string | null;
  planId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export class CoverageGroupService {
  async createCoverageGroup(
    data: {
      name: string;
      codes?: string[];
      frequency?: { count?: string; period?: string } | null;
      limitations?: { lifeLimit?: string; ageLimit?: string } | null;
      downgrades?: { subCheck?: boolean; code?: string } | null;
      patientId?: string | null;
      planId?: string | null;
    },
    userId?: string
  ) {
    const groupId = `cg-${Date.now()}`;
    const payload: CoverageGroupMeta = {
      type: 'coverage_group',
      groupId,
      name: data.name,
      codes: data.codes ?? [],
      frequency: data.frequency ?? null,
      limitations: data.limitations ?? null,
      downgrades: data.downgrades ?? null,
      patientId: data.patientId ?? null,
      planId: data.planId ?? null,
      createdBy: userId ?? null,
      createdAt: new Date().toISOString(),
    };

    await createCommlogJson({
      patientId: data.patientId ?? null,
      userId: userId ?? null,
      payload,
    });

    return payload;
  }

  async getCoverageGroups(filters?: { patientId?: string; planId?: string }) {
    const entries = await getCommlogJsonEntries<CoverageGroupMeta>({
      patientId: filters?.patientId,
      contains: 'coverage_group',
    });

    return entries
      .map(({ meta }) => meta)
      .filter((meta) => meta && (meta.type === 'coverage_group' || meta.groupId))
      .filter((meta) => (filters?.planId ? meta.planId === filters.planId : true));
  }

  async deleteCoverageGroup(groupId: string) {
    const entries = await getCommlogJsonEntries<CoverageGroupMeta>({
      contains: `"${groupId}"`,
    });

    for (const { row } of entries) {
      await prisma.commlog.delete({
        where: { CommlogNum: row.CommlogNum },
      });
    }

    return { message: 'Coverage group deleted successfully' };
  }
}

export const coverageGroupService = new CoverageGroupService();
