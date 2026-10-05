// Unrestricted tenant context for RLS — must be imported before any query.
import '../config/seed-context';
import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { getUserMeta, setUserMeta } from '../utils/opendental-auth.util';

const ensureRoleAttached = async (userNum: bigint, roleName: string) => {
  const role = await prisma.usergroup.findFirst({
    where: { Description: roleName },
  });

  if (!role) {
    console.warn(`Role "${roleName}" not found in usergroup!`);
    return;
  }

  const existingAttach = await prisma.usergroupattach.findFirst({
    where: { UserNum: userNum, UserGroupNum: role.UserGroupNum },
  });
  if (existingAttach) return;

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: {
      UserGroupAttachNum: attachId,
      UserNum: userNum,
      UserGroupNum: role.UserGroupNum,
    },
  });
};

const ensureClinicAttached = async (userNum: bigint, clinicNum: bigint = 1n) => {
  await prisma.userod.update({
    where: { UserNum: userNum },
    data: { ClinicNum: clinicNum },
  });

  const existingClinic = await prisma.userclinic.findFirst({
    where: { UserNum: userNum, ClinicNum: clinicNum },
  });
  if (!existingClinic) {
    const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
    await prisma.userclinic.create({
      data: {
        UserClinicNum: userClinicNum,
        UserNum: userNum,
        ClinicNum: clinicNum,
      },
    });
  }
};

// Legacy admin accounts keep the SEED_ADMIN_PASSWORD / 'Admin123!' contract
// that src/server.ts's seedIfEmpty and tests/helpers/auth.ts both read. Seeding
// them with the roster-wide SEED_PASSWORD instead locks those callers out.
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

type SampleAccount = {
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
  /** Overrides SEED_PASSWORD for this account only. */
  password?: string;
};

const sampleAccounts: SampleAccount[] = [
  // ─── 10 Canonical Roles ───────────────────────────────────────────────
  {
    email: 'superadmin@medflow.com',
    firstName: 'Super',
    lastName: 'Admin',
    roleName: 'Super Admin',
  },
  {
    email: 'groupadmin@medflow.com',
    firstName: 'Group',
    lastName: 'Admin',
    roleName: 'Group Admin',
  },
  {
    email: 'branchadmin@medflow.com',
    firstName: 'Branch',
    lastName: 'Admin',
    roleName: 'Branch Admin',
  },
  {
    email: 'provider@medflow.com',
    firstName: 'Doctor',
    lastName: 'Provider',
    roleName: 'Provider',
  },
  {
    email: 'hygienist@medflow.com',
    firstName: 'Sarah',
    lastName: 'Hygienist',
    roleName: 'Hygienist',
  },
  {
    email: 'assistant@medflow.com',
    firstName: 'Dental',
    lastName: 'Assistant',
    roleName: 'Assistant',
  },
  {
    email: 'frontdesk@medflow.com',
    firstName: 'Front',
    lastName: 'Desk',
    roleName: 'Front Desk',
  },
  {
    email: 'biller@medflow.com',
    firstName: 'Financial',
    lastName: 'Biller',
    roleName: 'Biller',
  },
  {
    email: 'patient@medflow.com',
    firstName: 'John',
    lastName: 'Patient',
    roleName: 'Patient',
  },
  {
    email: 'lab@medflow.com',
    firstName: 'Apex',
    lastName: 'Lab',
    roleName: 'Lab',
  },
  // ─── Legacy Admin Accounts ────────────────────────────────────────────
  {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@medflow.com',
    firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
    lastName: process.env.SEED_ADMIN_LAST_NAME || 'Medflow',
    roleName: 'Admin',
    password: adminPassword,
  },
  {
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    roleName: 'Admin',
    password: adminPassword,
  },
  {
    email: 'jessica.wong@medflow.com',
    firstName: 'Jessica',
    lastName: 'Wong',
    roleName: 'Admin',
    password: adminPassword,
  },
];

const seedUsers = async () => {
  try {
    const defaultPassword = process.env.SEED_PASSWORD || 'Password123!';

    // bcrypt at 12 rounds is deliberately slow — hash each distinct password
    // once rather than per account.
    const hashCache = new Map<string, string>();
    const hashFor = async (plain: string) => {
      let hash = hashCache.get(plain);
      if (!hash) {
        hash = await hashPassword(plain);
        hashCache.set(plain, hash);
      }
      return hash;
    };

    for (const acc of sampleAccounts) {
      const emailLower = acc.email.toLowerCase();
      const passwordHash = await hashFor(acc.password || defaultPassword);
      let user = await prisma.userod.findFirst({
        where: { UserName: emailLower },
      });

      if (!user) {
        const nextId = await getNextId('userod', 'UserNum');
        user = await prisma.userod.create({
          data: {
            UserNum: nextId,
            UserName: emailLower,
            Password: passwordHash,
            ClinicNum: 1n,
            IsHidden: 0,
          },
        });

        await setUserMeta(user.UserNum, {
          email: emailLower,
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          preferredLanguage: 'en',
          isActive: true,
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          tokenVersion: 0,
        });

        console.log(`Created user: ${emailLower} (${acc.roleName})`);
      } else {
        // Reset password & clear lockouts to guarantee login
        await prisma.userod.update({
          where: { UserNum: user.UserNum },
          data: {
            Password: passwordHash,
            ClinicNum: 1n,
            IsHidden: 0,
          },
        });

        const meta = await getUserMeta(user.UserNum);
        await setUserMeta(user.UserNum, {
          ...meta,
          email: emailLower,
          passwordHash,
          firstName: acc.firstName,
          lastName: acc.lastName,
          isActive: true,
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          tokenVersion: (meta.tokenVersion || 0) + 1,
        });

        console.log(`Updated user: ${emailLower} (${acc.roleName})`);
      }

      await ensureRoleAttached(user.UserNum, acc.roleName);
      await ensureClinicAttached(user.UserNum, 1n);
    }

    console.log(`\nAll sample users seeded successfully with password: "${defaultPassword}"!`);
    console.log(`Legacy admin accounts use: "${adminPassword}" (SEED_ADMIN_PASSWORD)`);
  } catch (error) {
    // Exit non-zero so seedAll.ts stops and surfaces the output. This used to
    // return normally, so a failure here (e.g. the ClinicNum 1 foreign key)
    // left the database with no users while `npm run seed:all` still reported
    // success — every login-based test then failed with an unexplained 401.
    console.error('Error seeding users:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

seedUsers();

