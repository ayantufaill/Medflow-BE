import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

const seedUsers = async () => {
  try {
    const adminEmail = 'admin@example.com';
    const existing = await prisma.userod.findFirst({
      where: { UserName: adminEmail },
    });

    if (!existing) {
      const nextId = await getNextId('userod', 'UserNum');
      const passwordHash = await hashPassword('Admin123!');

      const user = await prisma.userod.create({
        data: {
          UserNum: nextId,
          UserName: adminEmail,
          Password: passwordHash,
          IsHidden: 0,
        },
      });

      await setUserMeta(user.UserNum, {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        preferredLanguage: 'en',
        isActive: true,
        tokenVersion: 0,
      });

      const adminRole = await prisma.usergroup.findFirst({
        where: { Description: 'Admin' },
      });

      if (adminRole) {
        const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
        await prisma.usergroupattach.create({
          data: {
            UserGroupAttachNum: attachId,
            UserNum: user.UserNum,
            UserGroupNum: adminRole.UserGroupNum,
          },
        });
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
