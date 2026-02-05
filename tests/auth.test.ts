import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { loginAsAdmin } from './helpers/auth';

describe('Auth', () => {
  it('logs in as admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
      });

    expect(res.status).toBe(200);
    expect(res.body?.data?.tokens?.accessToken).toBeTruthy();
    expect(res.body?.data?.tokens?.refreshToken).toBeTruthy();
  });

  it('gets profile with token', async () => {
    const { token } = await loginAsAdmin();
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.user).toBeTruthy();
  });

  it('refreshes token', async () => {
    const { refreshToken } = await loginAsAdmin();
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body?.data?.tokens?.accessToken).toBeTruthy();
  });

  it('logs out', async () => {
    const { token, refreshToken } = await loginAsAdmin();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });

  const validationCases: Array<{ name: string; method: 'post'; path: string }> = [
    { name: 'register', method: 'post', path: '/api/auth/register' },
    { name: 'register/initiate', method: 'post', path: '/api/auth/register/initiate' },
    { name: 'register/verify', method: 'post', path: '/api/auth/register/verify' },
    { name: 'register/resend-link', method: 'post', path: '/api/auth/register/resend-link' },
    { name: 'forgot-password', method: 'post', path: '/api/auth/forgot-password' },
    { name: 'forgot-password/verify', method: 'post', path: '/api/auth/forgot-password/verify' },
    { name: 'forgot-password/reset', method: 'post', path: '/api/auth/forgot-password/reset' },
    { name: 'forgot-password/resend-code', method: 'post', path: '/api/auth/forgot-password/resend-code' },
    { name: 'setup-password', method: 'post', path: '/api/auth/setup-password' },
  ];

  for (const testCase of validationCases) {
    it(`validates ${testCase.name}`, async () => {
      const res = await request(app)[testCase.method](testCase.path).send({});
      expect(res.status).toBe(400);
    });
  }
});
