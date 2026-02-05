import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Users', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('gets users by role name', async () => {
    const res = await request(app)
      .get('/api/users/by-role/Admin')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates create user payload', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates user id on get', async () => {
    const res = await request(app)
      .get('/api/users/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates user id on update', async () => {
    const res = await request(app)
      .put('/api/users/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('updates own profile with empty payload', async () => {
    const res = await request(app)
      .put('/api/users/profile/me')
      .set(authHeader)
      .send({});
    expect([200, 400]).toContain(res.status);
  });

  it('validates change password payload', async () => {
    const res = await request(app)
      .post('/api/users/profile/change-password')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates assign role payload', async () => {
    const res = await request(app)
      .post('/api/users/1/roles')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates remove role params', async () => {
    const res = await request(app)
      .delete('/api/users/1/roles/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates delete user params', async () => {
    const res = await request(app)
      .delete('/api/users/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates activate user params', async () => {
    const res = await request(app)
      .patch('/api/users/1/activate')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates deactivate user params', async () => {
    const res = await request(app)
      .patch('/api/users/1/deactivate')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates user permissions params', async () => {
    const res = await request(app)
      .get('/api/users/1/permissions')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates user roles params', async () => {
    const res = await request(app)
      .get('/api/users/1/roles')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates user activity params', async () => {
    const res = await request(app)
      .get('/api/users/1/activity')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates user login history params', async () => {
    const res = await request(app)
      .get('/api/users/1/login-history')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
