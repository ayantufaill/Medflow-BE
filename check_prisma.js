import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('Keys of prisma client:', Object.keys(p).filter(k => k.toLowerCase().includes('exam') || k.toLowerCase().includes('biomechanical') || k.toLowerCase().includes('functional')));
process.exit(0);
