import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pw = 'Password123!';
  const hash = await bcrypt.hash(pw, 10);
  
  const result = await prisma.userod.updateMany({
    where: { 
      UserName: { 
        in: [
          'superadmin@medflow.com',
          'groupadmin@medflow.com',
          'branchadmin@medflow.com',
          'patient@medflow.com',
          'provider@medflow.com',
          'assistant@medflow.com',
          'hygienist@medflow.com',
          'frontdesk@medflow.com',
          'biller@medflow.com',
          'lab@medflow.com',
          'admin@example.com'
        ] 
      }
    },
    data: { Password: hash, IsHidden: 0 }
  });
  
  console.log(`Updated ${result.count} core users to have password '${pw}'`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
