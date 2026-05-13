import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('Database Connected');
  } catch (error) {
    console.error(`Database connection error: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
