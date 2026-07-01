import { prisma } from '../config/db';

let tableCreated = false;

export const getNextId = async (table: string, column: string): Promise<bigint> => {
  if (!tableCreated) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS medflow_sequences (
          table_name VARCHAR(255) PRIMARY KEY,
          next_id BIGINT NOT NULL
        )
      `);
    } catch (e) {
      // If 15 concurrent threads hit this, Postgres might throw a constraint error on its internal catalogs. Safe to ignore.
    }
    tableCreated = true;
  }

  // Fast optimistic update (atomic increment)
  const updated = await prisma.$queryRawUnsafe<any[]>(`
    UPDATE medflow_sequences 
    SET next_id = next_id + 1 
    WHERE table_name = $1 
    RETURNING next_id
  `, table);

  if (updated && updated.length > 0) {
    return BigInt(updated[0].next_id);
  }

  // Initialization fallback
  return await prisma.$transaction(async (tx) => {
    const model = (tx as any)[table];
    if (!model) {
      throw new Error(`Model ${table} does not exist on PrismaClient`);
    }

    const result = await model.aggregate({
      _max: { [column]: true },
    });
    const maxVal = result._max[column] ? BigInt(result._max[column]) : 0n;
    const nextId = maxVal + 1n;

    // Atomic upsert: If another thread inserted while we calculated max, increment theirs instead!
    const inserted = await tx.$queryRawUnsafe<any[]>(`
      INSERT INTO medflow_sequences (table_name, next_id) 
      VALUES ($1, $2) 
      ON CONFLICT (table_name) DO UPDATE 
      SET next_id = medflow_sequences.next_id + 1 
      RETURNING next_id
    `, table, nextId);

    return BigInt(inserted[0].next_id);
  });
};
