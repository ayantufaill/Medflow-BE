import { prisma } from '../config/db';

export const getNextId = async (table: string, column: string): Promise<bigint> => {
  const rows = await prisma.$queryRawUnsafe<{ nextId: bigint }[]>(
    `SELECT ISNULL(MAX([${column}]), 0) + 1 AS nextId FROM [${table}]`
  );

  return rows[0]?.nextId ?? 1n;
};
