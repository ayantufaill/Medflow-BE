/**
 * One-off: attach the Super Admin role to an existing user.
 * Usage: npx tsx scratch/makeSuperAdmin.ts
 */
import dotenv from 'dotenv';
import connectDB, { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

dotenv.config();

const EMAIL = 'admin@example.com';
const ROLE_NAME = 'Super Admin';

async function main() {
  await connectDB();

  const emailLower = EMAIL.toLowerCase();
  const user = await prisma.userod.findFirst({ where: { UserName: emailLower } });
  if (!user) {
    console.error(`No user found with email ${emailLower}`);
    process.exitCode = 1;
    return;
  }

  const role = await prisma.usergroup.findFirst({ where: { Description: ROLE_NAME } });
  if (!role) {
    console.error(`Role "${ROLE_NAME}" not found in usergroup!`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.usergroupattach.findFirst({
    where: { UserNum: user.UserNum, UserGroupNum: role.UserGroupNum },
  });

  if (existing) {
    console.log(`${emailLower} (UserNum ${user.UserNum}) already has role "${ROLE_NAME}". No change made.`);
    return;
  }

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: { UserGroupAttachNum: attachId, UserNum: user.UserNum, UserGroupNum: role.UserGroupNum },
  });

  const allRoles = await prisma.usergroupattach.findMany({
    where: { UserNum: user.UserNum },
    include: { usergroup: true },
  });

  console.log(`Attached "${ROLE_NAME}" to ${emailLower} (UserNum ${user.UserNum}).`);
  console.log('Roles now held:', allRoles.map((r) => r.usergroup?.Description).join(', '));
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
