import { prisma } from './src/config/db.js';

console.log('Keys of prisma:', Object.keys(prisma).filter(k => k.toLowerCase().includes('setting') || k.toLowerCase().includes('clinical')));
process.exit(0);
