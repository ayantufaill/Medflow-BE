import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'member.member-9721cb7d@example.com';
  const email2 = 'member.member-7d2e32fc@example.com';
  
  const u1 = await prisma.userod.findFirst({ where: { UserName: email }});
  const u2 = await prisma.userod.findFirst({ where: { UserName: email2 }});
  
  if (u1) {
    const p1 = await prisma.user_access_profile.findFirst({ where: { user_num: u1.UserNum }});
    const c1 = await prisma.userclinic.findMany({ where: { UserNum: u1.UserNum }});
    console.log(`User 1 (${u1.UserNum}) Access Profile:`, p1, 'Clinics:', c1);
  }
  
  if (u2) {
    const p2 = await prisma.user_access_profile.findFirst({ where: { user_num: u2.UserNum }});
    const c2 = await prisma.userclinic.findMany({ where: { UserNum: u2.UserNum }});
    console.log(`User 2 (${u2.UserNum}) Access Profile:`, p2, 'Clinics:', c2);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
