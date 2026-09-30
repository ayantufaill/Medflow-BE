import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'member.member-9721cb7d@example.com';
  const email2 = 'member.member-7d2e32fc@example.com';
  const pw = 'Password123!';
  const hash = await bcrypt.hash(pw, 10);
  
  await prisma.userod.updateMany({
    where: { UserName: { in: [email, email2] } },
    data: { Password: hash, IsHidden: 0 }
  });
  
  const user = await prisma.userod.findFirst({ where: { UserName: email } });
  console.log(`Updated ${email} and ${email2} to have password '${pw}'`);
  console.log('User status:', user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
