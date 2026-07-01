import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    });
  }
  return _prisma;
};

// Lazy proxy — avoids instantiating PrismaClient at module load time.
// This prevents crashes when DATABASE_URL is not set before the module is imported.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});

const connectDB = async (): Promise<void> => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('');
    console.error('┌─────────────────────────────────────────────────────────┐');
    console.error('│  FATAL: DATABASE_URL environment variable is not set.   │');
    console.error('│                                                          │');
    console.error('│  Railway:  go to your project → Variables tab and add  │');
    console.error('│            DATABASE_URL = sqlserver://host:1433;...     │');
    console.error('│                                                          │');
    console.error('│  Render:   Settings → Environment → Add Env Var         │');
    console.error('│            DATABASE_URL = postgresql://user:pass@host/db │');
    console.error('└─────────────────────────────────────────────────────────┘');
    console.error('');
    process.exit(1);
  }

  try {
    await getPrisma().$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    console.error('   Check that DATABASE_URL points to a reachable database.');
    process.exit(1);
  }
};

export default connectDB;
