/**
 * Reset admin user password - run when login fails due to corrupt/stale data.
 * Uses same .env and DB as the backend.
 *
 * Usage: npx tsx src/scripts/resetAdminPassword.ts
 */
import dotenv from 'dotenv';
import connectDB, { prisma } from '../config/db';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

dotenv.config();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';

async function resetAdminPassword() {
  try {
    await connectDB();

    const user = await prisma.userod.findFirst({
      where: { UserName: ADMIN_EMAIL },
    });

    if (!user) {
      console.error('Admin user not found. Run: npm run seed:all');
      process.exit(1);
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { Password: passwordHash, IsHidden: 0 },
    });

    await setUserMeta(user.UserNum, {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      preferredLanguage: 'en',
      isActive: true,
      tokenVersion: 0,
    });

    console.log('Admin password reset successfully!');
    console.log('Login with:', ADMIN_EMAIL, '/', ADMIN_PASSWORD);
    console.log('');
    console.log('If using Docker backend, run this inside the container:');
    console.log('  docker compose exec api-dev npx tsx src/scripts/resetAdminPassword.ts');
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
