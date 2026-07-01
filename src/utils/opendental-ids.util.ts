import { prisma } from '../config/db';

export const getNextId = async (table: string, column: string): Promise<bigint> => {
  const rows = await prisma.$queryRawUnsafe<{ nextId: bigint }[]>(
    `SELECT COALESCE(MAX("${column}"), 0) + 1 AS "nextId" FROM "${table}"`
  );

  const id = rows[0]?.nextId;
  return id ? BigInt(id) : 1n;
};
