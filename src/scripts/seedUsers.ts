import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { getUserMeta, setUserMeta } from '../utils/opendental-auth.util';

const ensureAdminRoleAttached = async (userNum: bigint) => {
  const adminRole = await prisma.usergroup.findFirst({
    where: { Description: 'Admin' },
  });

  if (!adminRole) return;

  const existingAttach = await prisma.usergroupattach.findFirst({
    where: { UserNum: userNum, UserGroupNum: adminRole.UserGroupNum },
  });
  if (existingAttach) return;

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: {
      UserGroupAttachNum: attachId,
      UserNum: userNum,
      UserGroupNum: adminRole.UserGroupNum,
    },
  });
};

const seedUsers = async () => {
  try {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const adminAccounts = [
      {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@medflow.com',
        firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
        lastName: process.env.SEED_ADMIN_LAST_NAME || 'Medflow',
      },
      {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      },
      {
        email: 'jessica.wong@medflow.com',
        firstName: 'Jessica',
        lastName: 'Wong',
      },
    ];

    for (const acc of adminAccounts) {
      const existing = await prisma.userod.findFirst({
        where: { UserName: acc.email },
      });

      if (!existing) {
        const nextId = await getNextId('userod', 'UserNum');
        const passwordHash = await hashPassword(adminPassword);

        const user = await prisma.userod.create({
          data: {
            UserNum: nextId,
            UserName: acc.email,
            Password: passwordHash,
            IsHidden: 0,
          },
        });

        await setUserMeta(user.UserNum, {
          email: acc.email,
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          preferredLanguage: 'en',
          isActive: true,
          tokenVersion: 0,
        });
        await ensureAdminRoleAttached(user.UserNum);
        console.log(`Created admin user: ${acc.email}`);
      } else {
        const meta = await getUserMeta(existing.UserNum);
        const passwordHash =
          meta.passwordHash ??
          existing.Password ??
          (await hashPassword(adminPassword));

        await setUserMeta(existing.UserNum, {
          email: meta.email ?? acc.email,
          passwordHash,
          firstName: meta.firstName ?? acc.firstName,
          lastName: meta.lastName ?? acc.lastName,
          phone: meta.phone ?? null,
          preferredLanguage: meta.preferredLanguage ?? 'en',
          isActive: meta.isActive ?? true,
          tokenVersion: meta.tokenVersion ?? 0,
        });

        await ensureAdminRoleAttached(existing.UserNum);
        console.log(`Ensured admin role attached to: ${acc.email}`);
      }
    }

    console.log('Users seeded successfully!');
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedUsers();
