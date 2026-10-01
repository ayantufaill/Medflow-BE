import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'member.member-9721cb7d@example.com';
  const user = await prisma.userod.findFirst({ where: { UserName: email }});
  
  if (user) {
    console.log("DB Hash:", user.Password);
    const valid = await bcrypt.compare('Password123!', user.Password || '');
    console.log("bcrypt.compare with 'Password123!':", valid);
    
    // Check meta
    const pref = await prisma.userodpref.findFirst({
        where: { UserNum: user.UserNum, Fkey: 0, FkeyType: 0 }
    });
    console.log("Meta json:", pref?.ValueString);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
