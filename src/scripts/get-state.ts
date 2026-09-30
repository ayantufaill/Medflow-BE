import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clinics = await prisma.clinic.findMany();
  console.log('Clinics:', clinics.map(c => ({ id: Number(c.ClinicNum), desc: c.Description })));

  const roles = await prisma.usergroup.findMany();
  console.log('Roles:', roles.map(r => ({ id: Number(r.UserGroupNum), desc: r.Description })));

  const users = await prisma.userod.findMany({ select: { UserNum: true, UserName: true }});
  console.log('Users:', users.map(u => ({ id: Number(u.UserNum), name: u.UserName })));

  const userGroupAttach = await prisma.usergroupattach.findMany();
  console.log('User Roles:', userGroupAttach.map(uga => ({ user: Number(uga.UserNum), role: Number(uga.UserGroupNum) })));
  
  const patients = await prisma.patient.findMany({ take: 5, select: { PatNum: true, ClinicNum: true, FName: true, LName: true }});
  console.log('Patients:', patients.map(p => ({ id: Number(p.PatNum), clinic: Number(p.ClinicNum), name: `${p.FName} ${p.LName}` })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
