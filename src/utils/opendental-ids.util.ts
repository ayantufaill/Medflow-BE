import { prisma } from '../config/db';

export const getNextId = async (table: string, column: string): Promise<bigint> => {
  const model = (prisma as any)[table];
  
  if (!model) {
    throw new Error(`Model ${table} does not exist on PrismaClient`);
  }

  const result = await model.aggregate({
    _max: {
      [column]: true,
    },
  });

  const maxVal = result._max[column];
  return maxVal ? BigInt(maxVal) + 1n : 1n;
};
