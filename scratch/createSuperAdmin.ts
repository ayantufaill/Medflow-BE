/**
 * One-off: create a new Super Admin user on the local dev DB.
 * Mirrors the pattern in src/scripts/seedUsers.ts.
 *
 * Usage: npx tsx scratch/createSuperAdmin.ts
 */
import dotenv from 'dotenv';
import connectDB, { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import { hashPassword } from '../src/utils/password.util';
import { setUserMeta } from '../src/utils/opendental-auth.util';

dotenv.config();

const EMAIL = 'super.admin@medflow.local';
const PASSWORD = 'SuperAdmin#2026';
const FIRST_NAME = 'Super';
const LAST_NAME = 'Admin';
const ROLE_NAME = 'Super Admin';

async function ensureRoleAttached(userNum: bigint, roleName: string) {
  const role = await prisma.usergroup.findFirst({ where: { Description: roleName } });
  if (!role) throw new Error(`Role "${roleName}" not found in usergroup!`);

  const existing = await prisma.usergroupattach.findFirst({
    where: { UserNum: userNum, UserGroupNum: role.UserGroupNum },
  });
  if (existing) return;

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: { UserGroupAttachNum: attachId, UserNum: userNum, UserGroupNum: role.UserGroupNum },
  });
}

async function main() {
  await connectDB();

  const emailLower = EMAIL.toLowerCase();
  const existing = await prisma.userod.findFirst({ where: { UserName: emailLower } });
  if (existing) {
    console.error(`A user with email ${emailLower} already exists (UserNum ${existing.UserNum}). Aborting — not overwriting.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  const nextId = await getNextId('userod', 'UserNum');

  const user = await prisma.userod.create({
    data: {
      UserNum: nextId,
      UserName: emailLower,
      Password: passwordHash,
      IsHidden: 0,
    },
  });

  await setUserMeta(user.UserNum, {
    email: emailLower,
    passwordHash,
    firstName: FIRST_NAME,
    lastName: LAST_NAME,
    preferredLanguage: 'en',
    isActive: true,
    failedLoginAttempts: 0,
    accountLockedUntil: null,
    tokenVersion: 0,
  });

  await ensureRoleAttached(user.UserNum, ROLE_NAME);

  console.log('Super Admin created:');
  console.log('  UserNum:', user.UserNum.toString());
  console.log('  Email:  ', emailLower);
  console.log('  Password:', PASSWORD);
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
