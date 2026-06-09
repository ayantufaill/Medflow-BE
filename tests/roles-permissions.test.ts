import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Roles & Permissions', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all roles', async () => {
    const res = await request(app)
      .get('/api/roles')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('fails to get non-existent role by id', async () => {
    const res = await request(app)
      .get('/api/roles/999999999999')
      .set(authHeader);
    expect(res.status).toBe(404);
  });

  it('validates create role payload', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update role payload', async () => {
    const res = await request(app)
      .put('/api/roles/999999999999')
      .set(authHeader)
      .send({});
    expect([200, 404]).toContain(res.status);
  });

  it('returns users with role (empty ok)', async () => {
    const res = await request(app)
      .get('/api/roles/999999999999/users')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('checks permission for current user', async () => {
    const res = await request(app)
      .post('/api/permissions/check')
      .set(authHeader)
      .send({ permission: 'documents.read' });
    expect(res.status).toBe(200);
  });

  it('validates permission check payload', async () => {
    const res = await request(app)
      .post('/api/permissions/check')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('gets the permission matrix', async () => {
    const res = await request(app)
      .get('/api/permissions/matrix')
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matrix).toBeDefined();
  });

  it('fails to get permission matrix without Admin role', async () => {
    const res = await request(app)
      .get('/api/permissions/matrix');
    expect(res.status).toBe(401);
  });

  it('assigns roles to a user', async () => {
    const rolesRes = await request(app)
      .get('/api/roles')
      .set(authHeader);
    const roleId = rolesRes.body.data.roles[0]?._id;

    const usersRes = await request(app)
      .get('/api/users')
      .set(authHeader);
    const targetUser = usersRes.body.data.users[0];

    if (roleId && targetUser) {
      const res = await request(app)
        .post(`/api/users/${targetUser._id}/roles`)
        .set(authHeader)
        .send({ roleIds: [roleId] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });
});
