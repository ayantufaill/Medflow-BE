import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

// Maps each dental role to the usergroup Description it belongs to
const ROLE_GROUP_MAP: Record<string, string> = {
  Dentist: 'Provider',
  Hygienist: 'Provider',
  Assistant: 'Staff',
  Staff: 'Staff',
  Owner: 'Admin',
  Manager: 'Staff',
  FrontDesk: 'Staff',
};

const roleUsers = [
  {
    email: 'dentist@medflow.com',
    firstName: 'Alex',
    lastName: 'Carter',
    role: 'Dentist',
    password: 'Dentist123!',
  },
  {
    email: 'hygienist@medflow.com',
    firstName: 'Jordan',
    lastName: 'Brooks',
    role: 'Hygienist',
    password: 'Hygienist123!',
  },
  {
    email: 'assistant@medflow.com',
    firstName: 'Morgan',
    lastName: 'Reed',
    role: 'Assistant',
    password: 'Assistant123!',
  },
  {
    email: 'staff@medflow.com',
    firstName: 'Taylor',
    lastName: 'Hayes',
    role: 'Staff',
    password: 'Staff123!',
  },
  {
    email: 'owner@medflow.com',
    firstName: 'Casey',
    lastName: 'Morgan',
    role: 'Owner',
    password: 'Owner123!',
  },
  {
    email: 'manager@medflow.com',
    firstName: 'Riley',
    lastName: 'Nguyen',
    role: 'Manager',
    password: 'Manager123!',
  },
  {
    email: 'frontdesk@medflow.com',
    firstName: 'Avery',
    lastName: 'Simmons',
    role: 'FrontDesk',
    password: 'FrontDesk123!',
  },
];

const ensureRoleAttached = async (userNum: bigint, groupDescription: string) => {
  const group = await prisma.usergroup.findFirst({
    where: { Description: groupDescription },
  });
  if (!group) {
    console.warn(`  Usergroup "${groupDescription}" not found — skipping role attachment.`);
    return;
  }

  const existing = await prisma.usergroupattach.findFirst({
    where: { UserNum: userNum, UserGroupNum: group.UserGroupNum },
  });
  if (existing) return;

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: {
      UserGroupAttachNum: attachId,
      UserNum: userNum,
      UserGroupNum: group.UserGroupNum,
    },
  });
};

const seedRoleUsers = async () => {
  let created = 0;
  let skipped = 0;

  for (const u of roleUsers) {
    const groupDescription = ROLE_GROUP_MAP[u.role];

    let userRecord = await prisma.userod.findFirst({ where: { UserName: u.email } });

    if (!userRecord) {
      const nextId = await getNextId('userod', 'UserNum');
      const passwordHash = await hashPassword(u.password);

      userRecord = await prisma.userod.create({
        data: { UserNum: nextId, UserName: u.email, Password: passwordHash, IsHidden: 0 },
      });

      await setUserMeta(userRecord.UserNum, {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        preferredLanguage: 'en',
        isActive: true,
        tokenVersion: 0,
      });

      console.log(`  Created [${u.role}]: ${u.firstName} ${u.lastName} <${u.email}>`);
      created++;
    } else {
      console.log(`  Skipped (existing) [${u.role}]: ${u.email}`);
      skipped++;
    }

    await ensureRoleAttached(userRecord.UserNum, groupDescription);
  }

  console.log(`\nRole user seeding complete. Created: ${created}, Skipped: ${skipped}`);
};

seedRoleUsers()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
