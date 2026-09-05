import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createSuperAdminAuthHeader, createTenantAdmin, type Tenant } from './helpers/tenant';

describe('Practice Group tenant isolation', () => {
  let systemAuthHeader: { Authorization: string };
  let tenantA: Tenant;
  let tenantB: Tenant;

  beforeAll(async () => {
    // NOT getAdminAuthHeader() — the seeded admin@example.com holds the
    // per-practice 'Admin' role, exactly the role this suite proves should NOT
    // have cross-group reach. A true platform operator is a distinct fixture.
    systemAuthHeader = await createSuperAdminAuthHeader();
    // practice-group.routes.ts gates on requireRoles('Admin') exactly, so the
    // realistic "per-practice Admin from Tenant A" caller holds the 'Admin' role
    // (not 'Group Admin') — see helpers/tenant.ts for why that distinction matters
    // (the 'Admin' role's '*' permission wildcard is what item 1's fix has to see
    // past, not just the presence of *a* group-scope check).
    tenantA = await createTenantAdmin('groupA');
    tenantB = await createTenantAdmin('groupB');
  });

  it("allows a Group Admin to provision a branch in their own group", async () => {
    const res = await request(app)
      .post(`/api/practice-groups/${tenantA.groupId}/branches`)
      .set(tenantA.authHeader)
      .send({ name: 'Tenant A Second Branch' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("blocks a Group Admin from provisioning a branch in another tenant's group", async () => {
    const res = await request(app)
      .post(`/api/practice-groups/${tenantB.groupId}/branches`)
      .set(tenantA.authHeader)
      .send({ name: 'Hostile takeover branch' });

    expect(res.status).toBe(403);

    // Confirm the branch was genuinely never created, not just that the response lied.
    const groupB = await request(app)
      .get(`/api/practice-groups/${tenantB.groupId}`)
      .set(tenantB.authHeader);
    expect(groupB.status).toBe(200);
    const branchNames = groupB.body.data.branches.map((b: any) => b.name);
    expect(branchNames).not.toContain('Hostile takeover branch');
  });

  it("blocks a Group Admin from creating a Group Admin account in another tenant's group", async () => {
    const res = await request(app)
      .post(`/api/practice-groups/${tenantB.groupId}/admin`)
      .set(tenantA.authHeader)
      .send({
        email: `hostile.${Date.now()}@example.com`,
        firstName: 'Hostile',
        lastName: 'Actor',
        clinicId: tenantB.clinicId,
      });

    expect(res.status).toBe(403);
  });

  it('allows a true Super Admin (platform:manage_practice_groups) to operate on any group', async () => {
    const res = await request(app)
      .post(`/api/practice-groups/${tenantA.groupId}/branches`)
      .set(systemAuthHeader)
      .send({ name: 'System-provisioned branch' });

    expect(res.status).toBe(201);
  });

  it('rejects a Group Admin from another tenant even when targeting their own clinicId in the body', async () => {
    // Regression guard: the scope check must key off the :groupId route param,
    // not anything caller-supplied in the body.
    const res = await request(app)
      .post(`/api/practice-groups/${tenantB.groupId}/admin`)
      .set(tenantA.authHeader)
      .send({
        email: `hostile2.${Date.now()}@example.com`,
        firstName: 'Hostile',
        lastName: 'Actor',
        clinicId: tenantA.clinicId,
      });

    expect(res.status).toBe(403);
  });
});
