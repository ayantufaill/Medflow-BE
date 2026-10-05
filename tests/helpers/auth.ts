import request from 'supertest';
import app from '../../src/app';

type LoginResult = {
  token: string;
  refreshToken: string;
  userId: string;
};

let lastLoginSecond = 0;

export const loginAsAdmin = async (): Promise<LoginResult> => {
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec === lastLoginSecond) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  lastLoginSecond = Math.floor(Date.now() / 1000);

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const token = response.body?.data?.tokens?.accessToken;
  const refreshToken = response.body?.data?.tokens?.refreshToken;
  const userId = response.body?.data?.user?._id;

  if (!token || !refreshToken || !userId) {
    throw new Error(
      `Failed to login as admin. Status: ${response.status}. ` +
        'Ensure seeds have been run (npm run seed:all) and credentials match.'
    );
  }

  return { token, refreshToken, userId };
};

/**
 * Logs in the seeded Super Admin (src/scripts/seedUsers.ts). Needed for the
 * platform-level endpoints behind `requirePlatformAdmin` — role management and
 * practice-group administration — which a plain 'Admin' is deliberately not
 * allowed to reach.
 */
export const loginAsSuperAdmin = async (): Promise<LoginResult> => {
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec === lastLoginSecond) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  lastLoginSecond = Math.floor(Date.now() / 1000);

  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@medflow.com';
  const password = process.env.SEED_PASSWORD || 'Password123!';

  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const token = response.body?.data?.tokens?.accessToken;
  const refreshToken = response.body?.data?.tokens?.refreshToken;
  const userId = response.body?.data?.user?._id;

  if (!token || !refreshToken || !userId) {
    throw new Error(
      `Failed to login as super admin. Status: ${response.status}. ` +
        'Ensure seeds have been run (npm run seed:all) and credentials match.'
    );
  }

  return { token, refreshToken, userId };
};

export const getSuperAdminAuthHeader = async (): Promise<{ Authorization: string }> => {
  const { token } = await loginAsSuperAdmin();
  return { Authorization: `Bearer ${token}` };
};

export const getAdminToken = async (): Promise<string> => {
  const login = await loginAsAdmin();
  return login.token;
};

export const getAdminAuthHeader = async (): Promise<{ Authorization: string }> => {
  const token = await getAdminToken();
  return { Authorization: `Bearer ${token}` };
};
