import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createTenant, createTenantMember, type Tenant } from './helpers/tenant';
import { uniqueToken } from './helpers/unique';

/**
 * Which branches a user belongs to decides what data they can reach, so an
 * admin may only place users in branches they manage — and may not move
 * another practice's staff at all. Both endpoints used to skip these checks:
 * a group admin could move any user into any branch.
 */
describe('Assigning users to branches stays inside the admin\'s practice', () => {
  let a: Tenant;
  let b: Tenant;
  let memberOfB: string;

  beforeAll(async () => {
    a = await createTenant('assign-a');
    b = await createTenant('assign-b');
    memberOfB = (await createTenantMember(b)).userId;
  });

  it('refuses to move another practice\'s staff (PUT /clinics)', async () => {
    const res = await request(app)
      .put(`/api/users/${memberOfB}/clinics`)
      .set(a.authHeader)
      .send({ defaultId: a.clinicId, restrictedIds: [a.clinicId] });
    expect(res.status).toBe(404);
  });

  it('refuses to move another practice\'s staff (PATCH /branches)', async () => {
    const res = await request(app)
      .patch(`/api/users/${memberOfB}/branches`)
      .set(a.authHeader)
      .send({ branchIds: [a.clinicId] });
    expect(res.status).toBe(404);
  });

  it('lets an admin place a user they just created in their own branch, but not in another practice\'s', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(a.authHeader)
      .send({
        email: `${uniqueToken('new-staff')}@example.com`.toLowerCase(),
        firstName: 'New',
        lastName: 'Staff',
        password: 'TestPass123!',
      });
    expect(created.status).toBe(201);
    const newUserId = created.body.data.user._id;

    const elsewhere = await request(app)
      .put(`/api/users/${newUserId}/clinics`)
      .set(a.authHeader)
      .send({ defaultId: b.clinicId, restrictedIds: [b.clinicId] });
    expect(elsewhere.status).toBe(403);

    const own = await request(app)
      .put(`/api/users/${newUserId}/clinics`)
      .set(a.authHeader)
      .send({ defaultId: a.clinicId, restrictedIds: [a.clinicId] });
    expect(own.status).toBe(200);
  });
});
