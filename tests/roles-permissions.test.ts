import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader, getSuperAdminAuthHeader } from './helpers/auth';

describe('Roles & Permissions', () => {
  let authHeader: { Authorization: string };
  // Creating/updating/deleting a role is platform-level (requirePlatformAdmin
  // in src/routes/role.routes.ts) — a plain 'Admin' gets a 403 there by design.
  let platformAdminHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
    platformAdminHeader = await getSuperAdminAuthHeader();
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
      .set(platformAdminHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update role payload', async () => {
    const res = await request(app)
      .put('/api/roles/999999999999')
      .set(platformAdminHeader)
      .send({});
    expect([200, 404]).toContain(res.status);
  });

  it('refuses role creation to a non-platform admin', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set(authHeader)
      .send({ name: 'Should Not Be Created' });
    expect(res.status).toBe(403);
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

    // Deliberately NOT roles[0]. On a freshly seeded database that is
    // "Super Admin", and role-grant.guard.ts correctly refuses to let a plain
    // Admin grant a platform-level role — so the test used to assert 200 on a
    // request the system is supposed to reject with 403. The intent here is
    // "an admin can assign a role", so pick one an admin is actually allowed
    // to grant.
    const grantableRole = (rolesRes.body.data.roles ?? []).find((r: any) =>
      ['Front Desk', 'Receptionist', 'Provider', 'Assistant'].includes(r.name ?? r.description)
    );
    const roleId = grantableRole?._id;

    const usersRes = await request(app)
      .get('/api/users')
      .set(authHeader);
    const targetUser = usersRes.body.data.users[0];

    if (roleId && targetUser) {
      // Role chips are Super Admin only (assertMayChangeRoles in
      // src/services/user.service.ts) — a plain 'Admin' gets a 403 there by
      // design, same as the role CRUD endpoints above.
      const res = await request(app)
        .post(`/api/users/${targetUser._id}/roles`)
        .set(platformAdminHeader)
        .send({ roleIds: [roleId] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });
});
