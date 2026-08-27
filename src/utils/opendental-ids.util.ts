import { prisma } from '../config/db';

// medflow_sequences is now a real Prisma-managed model (see schema.prisma) —
// `prisma db push` creates/preserves it. It used to be bootstrapped here via
// an ad-hoc `CREATE TABLE IF NOT EXISTS`, which silently broke once the app
// started connecting as a restricted, non-superuser role (no CREATE on
// schema) instead of the postgres superuser.

export const getNextId = async (table: string, column: string): Promise<bigint> => {
  return await prisma.$transaction(async (tx) => {
    const model = (tx as any)[table];
    if (!model) {
      throw new Error(`Model ${table} does not exist on PrismaClient`);
    }

    const result = await model.aggregate({
      _max: { [column]: true },
    });
    const maxVal = result._max[column] ? BigInt(result._max[column]) : 0n;
    const targetNextId = maxVal + 1n;

    const inserted = await tx.$queryRawUnsafe<any[]>(`
      INSERT INTO medflow_sequences (table_name, next_id) 
      VALUES ($1, $2) 
      ON CONFLICT (table_name) DO UPDATE 
      SET next_id = GREATEST(medflow_sequences.next_id + 1, $2) 
      RETURNING next_id
    `, table, targetNextId);

    return BigInt(inserted[0].next_id);
  });
};
