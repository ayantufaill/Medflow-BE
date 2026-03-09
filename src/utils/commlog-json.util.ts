import { prisma } from '../config/db';
import { getNextId } from './opendental-ids.util';

export type CommlogJsonPayload = Record<string, unknown> & {
  type: string;
};

export const parseCommlogJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

export const buildCommlogJson = (value: Record<string, unknown>) => JSON.stringify(value);

export const createCommlogJson = async (data: {
  patientId?: string | null;
  userId?: string | null;
  payload: CommlogJsonPayload;
  note?: string | null;
  when?: Date;
}) => {
  const commlogNum = await getNextId('commlog', 'CommlogNum');
  const entryDate = data.when ?? new Date();
  return prisma.commlog.create({
    data: {
      CommlogNum: commlogNum,
      PatNum: data.patientId ? BigInt(data.patientId) : null,
      UserNum: data.userId ? BigInt(data.userId) : null,
      CommDateTime: entryDate,
      Note: buildCommlogJson({
        ...data.payload,
        type: data.payload.type,
        createdAt:
          typeof data.payload.createdAt === 'string'
            ? data.payload.createdAt
            : entryDate.toISOString(),
      }),
    },
  });
};

export const getCommlogJsonEntries = async <T extends { type?: string }>(filters: {
  patientId?: string;
  userId?: string;
  contains?: string;
  order?: 'asc' | 'desc';
}) => {
  const rows = await prisma.commlog.findMany({
    where: {
      PatNum: filters.patientId ? BigInt(filters.patientId) : undefined,
      UserNum: filters.userId ? BigInt(filters.userId) : undefined,
      Note: filters.contains
        ? {
            contains: filters.contains,
          }
        : undefined,
    },
    orderBy: {
      CommDateTime: filters.order ?? 'desc',
    },
  });

  return rows.map((row) => ({
    row,
    meta: parseCommlogJson<T>(row.Note),
  }));
};
