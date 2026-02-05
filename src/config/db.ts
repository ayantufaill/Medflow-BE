import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaMssql(databaseUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('SQL Server Connected');
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
