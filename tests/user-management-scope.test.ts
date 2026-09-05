import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { createTenantAdmin, createTenantMember, type Tenant } from './helpers/tenant';

describe('User management tenant isolation', () => {
  let tenantA: Tenant;
  let tenantB: Tenant;
  let memberA: { userId: string; email: string };
  let memberB: { userId: string; email: string };
  let providerRoleId: string;

  beforeAll(async () => {
    tenantA = await createTenantAdmin('userscopeA');
    tenantB = await createTenantAdmin('userscopeB');
    memberA = await createTenantMember(tenantA);
    memberB = await createTenantMember(tenantB);

    const providerRole = await prisma.usergroup.findFirstOrThrow({ where: { Description: 'Provider' } });
    providerRoleId = providerRole.UserGroupNum.toString();
  });

  it("allows an Admin to read a user in their own tenant", async () => {
    const res = await request(app)
      .get(`/api/users/${memberA.userId}`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(200);
  });

  it("blocks an Admin from reading a user in another tenant (404, not leaking existence)", async () => {
    const res = await request(app)
      .get(`/api/users/${memberB.userId}`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(404);
  });

  it("allows an Admin to update a user in their own tenant", async () => {
    const res = await request(app)
      .put(`/api/users/${memberA.userId}`)
      .set(tenantA.authHeader)
      .send({ firstName: 'Updated' });
    expect(res.status).toBe(200);
  });

  it("blocks an Admin from updating a user in another tenant", async () => {
    const res = await request(app)
      .put(`/api/users/${memberB.userId}`)
      .set(tenantA.authHeader)
      .send({ firstName: 'Hijacked' });
    expect(res.status).toBe(404);

    // Confirm the update genuinely never landed.
    const check = await request(app)
      .get(`/api/users/${memberB.userId}`)
      .set(tenantB.authHeader);
    expect(check.body.data.user.firstName).not.toBe('Hijacked');
  });

  it("blocks an Admin from deactivating a user in another tenant", async () => {
    const res = await request(app)
      .patch(`/api/users/${memberB.userId}/deactivate`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(404);

    const check = await request(app)
      .get(`/api/users/${memberB.userId}`)
      .set(tenantB.authHeader);
    expect(check.body.data.user.isActive).not.toBe(false);
  });

  it("blocks an Admin from activating a user in another tenant", async () => {
    const res = await request(app)
      .patch(`/api/users/${memberB.userId}/activate`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(404);
  });

  it("blocks an Admin from assigning a role to a user in another tenant", async () => {
    const res = await request(app)
      .post(`/api/users/${memberB.userId}/roles`)
      .set(tenantA.authHeader)
      .send({ roleIds: [providerRoleId] });
    expect(res.status).toBe(404);
  });

  it("allows an Admin to assign a role to a user in their own tenant", async () => {
    const res = await request(app)
      .post(`/api/users/${memberA.userId}/roles`)
      .set(tenantA.authHeader)
      .send({ roleIds: [providerRoleId] });
    expect(res.status).toBe(200);
  });

  it("blocks an Admin from removing a role from a user in another tenant", async () => {
    const res = await request(app)
      .delete(`/api/users/${memberB.userId}/roles/${providerRoleId}`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(404);
  });

  it("blocks an Admin from deleting a user in another tenant", async () => {
    const res = await request(app)
      .delete(`/api/users/${memberB.userId}`)
      .set(tenantA.authHeader);
    expect(res.status).toBe(404);

    // Confirm the user genuinely still exists.
    const check = await request(app)
      .get(`/api/users/${memberB.userId}`)
      .set(tenantB.authHeader);
    expect(check.status).toBe(200);
  });
});
